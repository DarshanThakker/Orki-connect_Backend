/**
 * MODULE 06 — Exchange OAuth Manager
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the full OAuth lifecycle for Coinbase and Binance integrations.
 * Handles auth redirects, token exchange, KMS storage, and identity matching.
 *
 * ⚠️  APPLY NOW: Submit OAuth API applications to Coinbase + Binance immediately.
 *     Approval takes weeks and blocks this entire module.
 *     Coinbase: developer.coinbase.com
 *     Binance:  binance.com/en/developers
 *
 * Risk: HIGH — requires approved OAuth credentials from both exchanges
 * Dependencies: Session Service, Encrypted Token Vault
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import jaroWinkler from 'jaro-winkler';
import { logger } from '../../utils/logger.js';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session-service/service.js';
import { storeToken, retrieveToken } from '../encrypted-token-vault/service.js';
import { dispatchWebhookEvent } from '../webhook-dispatcher/service.js';
import { screenWalletAddress } from '../elliptic-risk-service/service.js';

// ─── Exchange Adapter Registry ────────────────────────────────────────────────
// Each exchange is a pluggable adapter.
import * as coinbaseAdapter from './adapters/coinbase.js';
import * as binanceAdapter from './adapters/binance.js';

const EXCHANGE_ADAPTERS: Record<string, any> = {
  coinbase: coinbaseAdapter,
  binance: binanceAdapter,
};

/**
 * Generates the OAuth redirect URL for the user to authorize at the exchange.
 */
export function getAuthorizationUrl(exchange: string, session_id: string): string {
  const adapter = getAdapter(exchange);
  return adapter.buildAuthUrl(session_id);
}

/**
 * Handles the OAuth callback after user authorizes at the exchange.
 */
export async function handleOAuthCallback({ exchange, session_id, authorization_code }: { exchange: string; session_id: string; authorization_code: string }) {
  const adapter = getAdapter(exchange);
  const session = await getSession(session_id);

  logger.info('Exchanging OAuth authorization code', { exchange, session_id });
  const { access_token, refresh_token, expires_in } = await adapter.exchangeCode(authorization_code);

  await storeToken(session_id, { access_token, refresh_token, exchange, expires_in });

  const connection_id = `conn_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { connection_id, exchange });
  await dispatchWebhookEvent(session_id, 'connect.connection.approved', { connection_id, exchange });

  const exchangeAddress = await adapter.getDepositAddress(access_token);
  const riskResult = await screenWalletAddress(session_id, exchangeAddress);
  if (riskResult.status === 'HIGH') {
    await updateSessionStatus(session_id, SESSION_STATUS.FAILED);
    await dispatchWebhookEvent(session_id, 'connect.connection.flagged', { risk_result: riskResult });
    return { connection_id, identity_status: 'RISK_FLAGGED' };
  }

  if (session.mode === 'VALIDATE') {
    const identityResult = await matchIdentity({ session, adapter, access_token });
    if (identityResult.matched === false) {
      return { connection_id, identity_status: 'MISMATCH' };
    }
  }

  return { connection_id, identity_status: 'PASS' };
}

/**
 * Performs Jaro-Winkler identity matching in Validate mode.
 */
export async function matchIdentity({ session, adapter, access_token }: { session: any; adapter: any; access_token: string }) {
  const profile = await adapter.getAccountProfile(access_token);
  const exchange_name = profile.account_holder_name;

  const normalize = (name: string) => name
    .toLowerCase()
    .replace(/[-]/g, ' ')
    .replace(/\b(mr|ms|dr|sheikh|sheikha|h\.h\.)\b\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized_exchange = normalize(exchange_name);
  const normalized_kyc = normalize(session.kyc_name);

  if (normalized_exchange === normalized_kyc) {
    logger.info('Identity exact match', { session_id: session.session_id });
    return { matched: true, fuzzy: false };
  }

  const score = (jaroWinkler as any)(normalized_exchange, normalized_kyc);
  const THRESHOLD = 0.92;

  if (score >= THRESHOLD) {
    logger.info('Identity fuzzy match', { session_id: session.session_id, score });
    await dispatchWebhookEvent(session.session_id, 'connect.connection.approved', { fuzzy_match: true });
    return { matched: true, fuzzy: true, score };
  }

  logger.warn('Identity mismatch', { session_id: session.session_id, score, exchange_name, kyc_name: session.kyc_name });
  await dispatchWebhookEvent(session.session_id, 'connect.connection.identity_mismatch', {
    exchange_name_returned: exchange_name,
    kyc_name_provided: session.kyc_name,
    similarity_score: score,
  });
  await updateSessionStatus(session.session_id, SESSION_STATUS.FAILED);

  return { matched: false, score };
}

/**
 * Initiates a withdrawal from the exchange to the client's deposit address.
 */
export async function initiateExchangeWithdrawal({ session_id, amount, token }: { session_id: string; amount: string; token: string }) {
  const session = await getSession(session_id);
  const tokenData = await retrieveToken(session_id);
  const adapter = getAdapter(tokenData.exchange);

  const fee = await adapter.getWithdrawalFee(tokenData.access_token, token);
  const net_amount = parseFloat(amount) - fee;

  await dispatchWebhookEvent(session_id, 'connect.deposits.pending', { amount, token, fee });

  const withdrawal = await adapter.initiateWithdrawal({
    access_token: tokenData.access_token,
    asset: token,
    amount,
    destination_address: session.deposit_address,
  });

  await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { tx_hash: withdrawal.tx_hash });
  await dispatchWebhookEvent(session_id, 'connect.deposits.submitted', {
    withdrawal_id: withdrawal.id,
    amount,
    net_amount,
    fee,
  });

  return { withdrawal_id: withdrawal.id };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getAdapter(exchange: string) {
  const adapter = EXCHANGE_ADAPTERS[exchange];
  if (!adapter) {
    const err: any = new Error(`Unsupported exchange: ${exchange}`);
    err.status = 400;
    err.code = 'UNSUPPORTED_EXCHANGE';
    throw err;
  }
  return adapter;
}
