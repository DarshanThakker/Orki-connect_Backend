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
/**
 * Encrypts and stores an OAuth token pair for a session.
 */
export declare function storeToken(session_id: string, tokenData: {
    access_token: string;
    refresh_token: string;
    exchange: string;
    expires_in: number;
}): Promise<void>;
/**
 * Retrieves and decrypts an OAuth token for a session.
 */
export declare function retrieveToken(session_id: string): Promise<any>;
/**
 * Refreshes an expired OAuth token using the refresh_token.
 */
export declare function refreshToken(session_id: string, tokenData: any): Promise<any>;
/**
 * Securely deletes token data for a session.
 */
export declare function deleteToken(session_id: string, retain?: boolean): Promise<void>;
//# sourceMappingURL=service.d.ts.map