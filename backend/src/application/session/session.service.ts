import { v4 as uuidv4 } from 'uuid';
import { SessionStatus, Chain, ConnectionType, ComplianceMode, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { SESSION_TIMEOUT_MS, isValidTransition, NON_EXPIRABLE_STATUSES } from '../../domain/session/session.entity';
import { getOrgConfig } from '../org/org.service';
import { signToken } from '../../infrastructure/security/jwt.service';
import { redis, TTL } from '../../infrastructure/cache/redis.client';
import { registerAddress, deregisterAddress } from './deposit.service';
import {
  createSession as dbCreate,
  findSessionById,
  updateSession,
  updateSessionStatus as dbUpdateStatus,
} from '../../infrastructure/database/repositories/session.repository';

const sessionCacheKey = (id: string) => `session:${id}`;

export { SESSION_TIMEOUT_MS };
export const SESSION_STATUS = SessionStatus;

export async function createSession(params: {
  organization_id: string;
  user_id: string;
  network: Chain;
  token: string;
  mode?: ComplianceMode;
  kyc_name?: string;
  connection_type?: ConnectionType;
}) {
  const { organization_id, user_id, network, token, mode, kyc_name, connection_type } = params;
  const orgConfig = await getOrgConfig(organization_id);

  const finalMode = mode || orgConfig.compliance_mode;
  const finalConnectionType = connection_type || orgConfig.connection_methods[0]!;

  if (finalMode === ComplianceMode.VALIDATE && finalConnectionType === ConnectionType.EXCHANGE && !kyc_name) {
    throw Object.assign(new Error('kyc_name is required when mode is VALIDATE and connection_type is EXCHANGE'), { status: 422, code: 'KYC_NAME_REQUIRED' });
  }
  if (!orgConfig.supported_chains.includes(network)) {
    throw Object.assign(new Error(`Network '${network}' is not enabled for this organisation`), { status: 400, code: 'NETWORK_NOT_SUPPORTED' });
  }
  if (!orgConfig.supported_tokens.includes(token)) {
    throw Object.assign(new Error(`Token '${token}' is not supported`), { status: 400, code: 'TOKEN_NOT_SUPPORTED' });
  }

  const deposit_address = orgConfig.deposit_addresses?.[network];
  if (!deposit_address) {
    throw Object.assign(new Error(`No deposit address configured for network '${network}'`), { status: 400, code: 'DEPOSIT_ADDRESS_NOT_CONFIGURED' });
  }

  // Provide EVM address alongside when the session is on Solana (so the SDK can show it as an alternative)
  const evm_deposit_address = network === Chain.SOLANA ? orgConfig.deposit_addresses?.[Chain.ETHEREUM] : undefined;

  await registerAddress(`pending_${user_id}`, deposit_address, network);

  const session_id = `sess_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const expires_at = new Date(Date.now() + SESSION_TIMEOUT_MS);

  const session = await dbCreate({
    session_id,
    organization_id,
    user_id,
    deposit_address,
    network,
    token,
    mode: finalMode,
    kyc_name: kyc_name || null,
    connection_type: finalConnectionType,
    status: SessionStatus.CREATED,
    expires_at,
  } as any);

  await registerAddress(session_id, deposit_address, network);

  const session_jwt = signToken(
    { session_id, organization_id, mode: session.mode, connection_type: session.connection_type, network, token },
    { expiresIn: '18m' }
  );

  const refresh_token = signToken({ session_id, organization_id, type: 'refresh' }, { expiresIn: '24h' });

  setTimeout(() => expireSession(session_id), SESSION_TIMEOUT_MS);

  logger.info('Session created', { session_id, organization_id, user_id, network, mode: session.mode });
  return {
    session_id,
    session_jwt,
    refresh_token,
    expires_at: expires_at.toISOString(),
    deposit_address,
    ...(evm_deposit_address && { evm_deposit_address }),
  };
}

export async function getSession(session_id: string) {
  const cacheKey = sessionCacheKey(session_id);
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const session = await findSessionById(session_id);
  if (!session) {
    throw Object.assign(new Error(`Session not found: ${session_id}`), { status: 404, code: 'SESSION_NOT_FOUND' });
  }
  await redis.set(cacheKey, JSON.stringify(session), 'EX', TTL.SESSION);
  return session;
}

async function invalidateSession(session_id: string) {
  await redis.del(sessionCacheKey(session_id));
}

export async function updateSessionStatus(
  session_id: string,
  new_status: SessionStatus,
  extra: Partial<Prisma.SessionUpdateInput> = {}
) {
  const session = await getSession(session_id);

  if (!isValidTransition(session.status as SessionStatus, new_status)) {
    logger.warn('Invalid session state transition', { session_id, from: session.status, to: new_status });
  }

  const updated = await dbUpdateStatus(session_id, new_status, extra);
  await invalidateSession(session_id);
  logger.info('Session status updated', { session_id, from: session.status, to: new_status });
  return updated;
}

export async function expireSession(session_id: string) {
  const session = await findSessionById(session_id);
  if (!session) return;
  if (NON_EXPIRABLE_STATUSES.includes(session.status as SessionStatus)) return;

  if (session.tx_hash) {
    await updateSessionStatus(session_id, SessionStatus.EXTENDED_MONITORING);
    logger.info('Session expired but tx in-flight — extended monitoring', { session_id });
  } else {
    await updateSessionStatus(session_id, SessionStatus.EXPIRED);
    await deregisterAddress(session_id);
    const { dispatchWebhookEvent } = await import('../webhook/webhook.service');
    await dispatchWebhookEvent(session_id, 'connect.deposits.abandoned', {});
    logger.info('Session expired — no deposit received', { session_id });
  }
}

export async function refreshSession(refresh_token: string) {
  try {
    const { verifySessionToken } = await import('../../infrastructure/security/jwt.service');
    const payload = verifySessionToken(refresh_token) as any;
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const session = await getSession(payload.session_id);
    const expires_at = new Date(Date.now() + SESSION_TIMEOUT_MS);

    if (session.status === SessionStatus.EXPIRED) {
      await registerAddress(session.session_id, session.deposit_address, session.network);
    }

    const refreshableStatuses: SessionStatus[] = [SessionStatus.EXPIRED, SessionStatus.CREATED, SessionStatus.ACTIVE];
    const new_status = refreshableStatuses.includes(session.status as SessionStatus) ? SessionStatus.CREATED : session.status;

    await updateSession(session.session_id, { expires_at, status: new_status });
    await invalidateSession(session.session_id);

    const session_jwt = signToken(
      { session_id: session.session_id, organization_id: session.organization_id, mode: session.mode, connection_type: session.connection_type, network: session.network, token: session.token },
      { expiresIn: '18m' }
    );

    setTimeout(() => expireSession(session.session_id), SESSION_TIMEOUT_MS);

    logger.info('Session refreshed', { session_id: session.session_id });
    return { session_id: session.session_id, session_jwt, expires_at: expires_at.toISOString() };
  } catch (err: any) {
    if (!err.status) Object.assign(err, { status: 401, code: 'INVALID_REFRESH_TOKEN' });
    throw err;
  }
}
