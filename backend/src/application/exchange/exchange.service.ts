import { v4 as uuidv4 } from 'uuid';
import jaroWinkler from 'jaro-winkler';
import { logger } from '../../utils/logger';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session/session.service';
import { storeToken, retrieveToken } from '../../infrastructure/vault/token.vault';
import { dispatchWebhookEvent } from '../webhook/webhook.service';
import { screenAddress } from '../../infrastructure/risk/elliptic.provider';
import { NAME_MATCH_THRESHOLD } from '../../domain/shared/types';

import * as coinbase from '../../infrastructure/exchange/adapters/coinbase.adapter';
import * as binance from '../../infrastructure/exchange/adapters/binance.adapter';

const ADAPTERS: Record<string, any> = { coinbase, binance };

function getAdapter(exchange: string) {
  const adapter = ADAPTERS[exchange];
  if (!adapter) throw Object.assign(new Error(`Unsupported exchange: ${exchange}`), { status: 400, code: 'UNSUPPORTED_EXCHANGE' });
  return adapter;
}

export function getAuthorizationUrl(exchange: string, session_id: string): string {
  logger.info('Building OAuth authorization URL', { exchange, session_id });
  return getAdapter(exchange).buildAuthUrl(session_id);
}

export async function handleOAuthCallback({ exchange, session_id, authorization_code }: { exchange: string; session_id: string; authorization_code: string }) {
  const adapter = getAdapter(exchange);
  const session = await getSession(session_id);

  logger.info('OAuth callback received', { exchange, session_id, mode: session.mode });

  const { access_token, refresh_token, expires_in } = await adapter.exchangeCode(authorization_code);
  logger.info('OAuth code exchanged for token', { exchange, session_id, expires_in });

  await storeToken(session_id, { access_token, refresh_token, exchange, expires_in });
  logger.info('OAuth token stored in vault', { exchange, session_id });

  const connection_id = `conn_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { connection_id, exchange });
  await dispatchWebhookEvent(session_id, 'connect.connection.approved', { connection_id, exchange });

  logger.info('Fetching exchange address for AML screening', { exchange, session_id });
  const exchangeAddress = await adapter.getDepositAddress(access_token);
  const risk = await screenAddress(session_id, exchangeAddress);

  if (risk.status === 'HIGH') {
    logger.warn('Exchange address flagged by AML — terminating session', { exchange, session_id, flags: risk.flags });
    await updateSessionStatus(session_id, SESSION_STATUS.FAILED);
    await dispatchWebhookEvent(session_id, 'connect.connection.flagged', { risk_result: risk });
    return { connection_id, identity_status: 'RISK_FLAGGED' };
  }

  logger.info('AML screening passed', { exchange, session_id, risk_score: risk.risk_score });

  if (session.mode === 'VALIDATE') {
    logger.info('Running identity match (VALIDATE mode)', { exchange, session_id });
    const identity = await matchIdentity({ session, adapter, access_token });
    if (!identity.matched) {
      logger.warn('Identity match failed', { exchange, session_id, score: identity.score });
      return { connection_id, identity_status: 'MISMATCH' };
    }
    logger.info('Identity match passed', { exchange, session_id, fuzzy: identity.fuzzy, score: identity.score });
  }

  return { connection_id, identity_status: 'PASS' };
}

export async function matchIdentity({ session, adapter, access_token }: { session: any; adapter: any; access_token: string }) {
  const profile = await adapter.getAccountProfile(access_token);
  const exchange_name = profile.account_holder_name;

  const normalize = (name: string) =>
    name.toLowerCase().replace(/[-]/g, ' ').replace(/\b(mr|ms|dr|sheikh|sheikha|h\.h\.)\b\.?\s*/gi, '').replace(/\s+/g, ' ').trim();

  const norm_exchange = normalize(exchange_name);
  const norm_kyc = normalize(session.kyc_name);

  logger.info('Identity comparison', { session_id: session.session_id, norm_exchange, norm_kyc });

  if (norm_exchange === norm_kyc) {
    logger.info('Identity exact match', { session_id: session.session_id });
    return { matched: true, fuzzy: false };
  }

  const score = (jaroWinkler as any)(norm_exchange, norm_kyc);
  logger.info('Jaro-Winkler score computed', { session_id: session.session_id, score, threshold: NAME_MATCH_THRESHOLD });

  if (score >= NAME_MATCH_THRESHOLD) {
    await dispatchWebhookEvent(session.session_id, 'connect.connection.approved', { fuzzy_match: true });
    return { matched: true, fuzzy: true, score };
  }

  logger.warn('Identity mismatch — score below threshold', { session_id: session.session_id, score, threshold: NAME_MATCH_THRESHOLD });
  await dispatchWebhookEvent(session.session_id, 'connect.connection.identity_mismatch', {
    exchange_name_returned: exchange_name, kyc_name_provided: session.kyc_name, similarity_score: score,
  });
  await updateSessionStatus(session.session_id, SESSION_STATUS.FAILED);
  return { matched: false, score };
}

export async function initiateExchangeWithdrawal({ session_id, amount, token }: { session_id: string; amount: string; token: string }) {
  logger.info('Initiating exchange withdrawal', { session_id, amount, token });

  const session = await getSession(session_id);
  const tokenData = await retrieveToken(session_id);
  const adapter = getAdapter(tokenData.exchange);

  const fee = await adapter.getWithdrawalFee(tokenData.access_token, token);
  const net_amount = parseFloat(amount) - fee;
  logger.info('Withdrawal fee resolved', { session_id, token, fee, net_amount, exchange: tokenData.exchange });

  await dispatchWebhookEvent(session_id, 'connect.deposits.pending', { amount, token, fee });

  const withdrawal = await adapter.initiateWithdrawal({ access_token: tokenData.access_token, asset: token, amount, destination_address: session.deposit_address });
  logger.info('Exchange withdrawal submitted', { session_id, withdrawal_id: withdrawal.id, tx_hash: withdrawal.tx_hash, exchange: tokenData.exchange });

  await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { tx_hash: withdrawal.tx_hash });
  await dispatchWebhookEvent(session_id, 'connect.deposits.submitted', { withdrawal_id: withdrawal.id, amount, net_amount, fee });

  return { withdrawal_id: withdrawal.id };
}
