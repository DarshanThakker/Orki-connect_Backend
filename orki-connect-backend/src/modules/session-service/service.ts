import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { SessionStatus, Prisma, Chain, ConnectionType, ComplianceMode } from '@prisma/client';

import { logger } from '../../utils/logger.js';
import { getOrgConfig } from '../org-config-service/service.js';
import { registerAddress, deregisterAddress } from '../deposit-address-registry/service.js';
import { prisma } from '../../lib/prisma.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const SESSION_STATUS = SessionStatus;

/**
 * Creates a new Connect Session.
 */
export async function createSession(params: {
  organization_id: string;
  user_id: string;
  deposit_address: string;
  network: Chain;
  token: string;
  mode?: ComplianceMode;
  kyc_name?: string;
  connection_type?: ConnectionType;
}) {
  const { organization_id, user_id, deposit_address, network, token, mode, kyc_name, connection_type } = params;
  const orgConfig = await getOrgConfig(organization_id);

  const finalMode = mode || (orgConfig.compliance_mode as ComplianceMode);
  const finalConnectionType = connection_type || (orgConfig.connection_methods[0] as ConnectionType);

  // ── Validate mode + exchange requires kyc_name ────────────────────────────
  if (finalMode === ComplianceMode.VALIDATE && finalConnectionType === ConnectionType.EXCHANGE && !kyc_name) {
    const err: any = new Error('kyc_name is required when mode is validate and connection_type is exchange');
    err.status = 422;
    err.code = 'KYC_NAME_REQUIRED';
    throw err;
  }

  // ── Validate requested network is configured for this org ─────────────────
  if (!orgConfig.supported_chains.includes(network)) {
    const err: any = new Error(`Network '${network}' is not enabled for this organisation`);
    err.status = 400;
    err.code = 'NETWORK_NOT_SUPPORTED';
    throw err;
  }

  // ── Validate token is supported ───────────────────────────────────────────
  if (!orgConfig.supported_tokens.includes(token)) {
    const err: any = new Error(`Token '${token}' is not supported`);
    err.status = 400;
    err.code = 'TOKEN_NOT_SUPPORTED';
    throw err;
  }

  // ── Register deposit address ──────────────────────────────────────────────
  await registerAddress(`pending_${user_id}`, deposit_address, network);

  const session_id = `sess_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date();
  const expires_at = new Date(now.getTime() + SESSION_TIMEOUT_MS);

  const session = await prisma.session.create({
    data: {
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
    },
  });

  // ── Re-register address under session_id ─────────────────────────────────
  await registerAddress(session_id, deposit_address, network);

  // ── Issue session JWT (frontend-safe, short-lived) ────────────────────────
  const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKey) throw new Error('JWT_PRIVATE_KEY not configured');

  const session_jwt = jwt.sign(
    {
      session_id,
      organization_id,
      mode: session.mode,
      connection_type: session.connection_type,
      network,
      token,
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '30m' }
  );

  logger.info('Session created', { session_id, organization_id, user_id, network, mode: session.mode });

  return { session_id, session_jwt, expires_at: expires_at.toISOString() };
}

/**
 * Retrieves a session by ID.
 */
export async function getSession(session_id: string) {
  const session = await prisma.session.findUnique({
    where: { session_id },
  });

  if (!session) {
    const err: any = new Error(`Session not found: ${session_id}`);
    err.status = 404;
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }
  return session;
}

/**
 * Transitions a session to a new status.
 */
export async function updateSessionStatus(session_id: string, new_status: SessionStatus, updates: Partial<Prisma.SessionUpdateInput> = {}) {
  const session = await getSession(session_id);

  const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
    [SessionStatus.CREATED]: [SessionStatus.ACTIVE, SessionStatus.FAILED, SessionStatus.EXPIRED],
    [SessionStatus.ACTIVE]: [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.EXPIRED, SessionStatus.EXTENDED_MONITORING],
    [SessionStatus.EXTENDED_MONITORING]: [SessionStatus.COMPLETED, SessionStatus.FAILED],
    [SessionStatus.COMPLETED]: [],
    [SessionStatus.FAILED]: [],
    [SessionStatus.EXPIRED]: [],
  };

  const allowed = VALID_TRANSITIONS[session.status as SessionStatus] || [];
  if (!allowed.includes(new_status)) {
    logger.warn('Invalid session state transition', { session_id, from: session.status, to: new_status });
  }

  const updated = await prisma.session.update({
    where: { session_id },
    data: { ...updates, status: new_status },
  });

  logger.info('Session status updated', { session_id, from: session.status, to: new_status });
  return updated;
}

/**
 * Expires a session after the 30-minute timeout.
 */
export async function expireSession(session_id: string) {
  const session = await prisma.session.findUnique({
    where: { session_id },
  });

  if (!session) return;

  const nonExpirable: SessionStatus[] = [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.EXTENDED_MONITORING];
  if (nonExpirable.includes(session.status as SessionStatus)) return;

  if (session.tx_hash) {
    await updateSessionStatus(session_id, SessionStatus.EXTENDED_MONITORING);
    logger.info('Session expired but tx in-flight — extended monitoring', { session_id });
  } else {
    await updateSessionStatus(session_id, SessionStatus.EXPIRED);
    await deregisterAddress(session_id);

    const { dispatchWebhookEvent } = await import('../webhook-dispatcher/service.js');
    await dispatchWebhookEvent(session_id, 'connect.deposits.abandoned', {});

    logger.info('Session expired — no deposit received', { session_id });
  }
}
