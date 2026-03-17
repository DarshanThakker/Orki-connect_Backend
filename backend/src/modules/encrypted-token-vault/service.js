/**
 * MODULE 07 — Encrypted Token Vault
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores OAuth access tokens and refresh tokens for exchange accounts.
 * Exchange tokens represent the ability to withdraw user funds — they MUST
 * NEVER be stored in plaintext. AWS KMS encryption is non-negotiable.
 *
 * Risk: HIGH (security requirements) — must be audited before exchange flow goes live
 * Dependencies: None — standalone security module
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { logger } from '../../utils/logger.js';
// ─── Mock vault for development (replace with KMS in production) ──────────────
const vaultStore = new Map();
/**
 * Encrypts and stores an OAuth token pair for a session.
 */
export async function storeToken(session_id, tokenData) {
    const mockEncrypted = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    vaultStore.set(session_id, {
        encrypted: mockEncrypted,
        exchange: tokenData.exchange,
        stored_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    });
    logger.info('OAuth token stored in vault', { session_id, exchange: tokenData.exchange });
}
/**
 * Retrieves and decrypts an OAuth token for a session.
 */
export async function retrieveToken(session_id) {
    const entry = vaultStore.get(session_id);
    if (!entry) {
        const err = new Error(`No token found for session: ${session_id}`);
        err.status = 404;
        err.code = 'TOKEN_NOT_FOUND';
        throw err;
    }
    const tokenData = JSON.parse(Buffer.from(entry.encrypted, 'base64').toString());
    if (new Date(entry.expires_at) <= new Date()) {
        logger.info('Token expired — refreshing', { session_id, exchange: entry.exchange });
        return await refreshToken(session_id, tokenData);
    }
    return tokenData;
}
/**
 * Refreshes an expired OAuth token using the refresh_token.
 */
export async function refreshToken(session_id, tokenData) {
    const { exchange, refresh_token } = tokenData;
    const { default: adapter } = await import(`../exchange-oauth-manager/adapters/${exchange}.js`);
    const newTokens = await adapter.exchangeCode(refresh_token);
    await storeToken(session_id, { ...newTokens, exchange });
    logger.info('OAuth token refreshed', { session_id, exchange });
    return newTokens;
}
/**
 * Securely deletes token data for a session.
 */
export async function deleteToken(session_id, retain = false) {
    if (retain) {
        logger.info('Token retained for withdrawal flow', { session_id });
        return;
    }
    vaultStore.delete(session_id);
    logger.info('OAuth token securely deleted', { session_id });
}
//# sourceMappingURL=service.js.map