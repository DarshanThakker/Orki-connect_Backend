import { logger } from '../../utils/logger';

// In-memory mock — replace with AWS KMS in production
const store = new Map<string, any>();

export async function storeToken(
  session_id: string,
  tokenData: { access_token: string; refresh_token: string; exchange: string; expires_in: number }
) {
  store.set(session_id, {
    encrypted: Buffer.from(JSON.stringify(tokenData)).toString('base64'),
    exchange: tokenData.exchange,
    stored_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  });
  logger.info('OAuth token stored in vault', { session_id, exchange: tokenData.exchange });
}

export async function retrieveToken(session_id: string) {
  const entry = store.get(session_id);
  if (!entry) {
    throw Object.assign(new Error(`No token found for session: ${session_id}`), { status: 404, code: 'TOKEN_NOT_FOUND' });
  }

  const tokenData = JSON.parse(Buffer.from(entry.encrypted, 'base64').toString());

  if (new Date(entry.expires_at) <= new Date()) {
    logger.info('Token expired — refreshing', { session_id });
    const adapter = await import(`../exchange/adapters/${entry.exchange}.adapter`);
    const newTokens = await adapter.exchangeCode(tokenData.refresh_token);
    await storeToken(session_id, { ...newTokens, exchange: entry.exchange });
    return newTokens;
  }

  return tokenData;
}

export async function deleteToken(session_id: string, retain = false) {
  if (retain) {
    logger.info('Token retained for withdrawal flow', { session_id });
    return;
  }
  store.delete(session_id);
  logger.info('OAuth token securely deleted', { session_id });
}
