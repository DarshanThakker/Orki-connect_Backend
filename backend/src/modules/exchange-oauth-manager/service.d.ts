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
/**
 * Generates the OAuth redirect URL for the user to authorize at the exchange.
 */
export declare function getAuthorizationUrl(exchange: string, session_id: string): string;
/**
 * Handles the OAuth callback after user authorizes at the exchange.
 */
export declare function handleOAuthCallback({ exchange, session_id, authorization_code }: {
    exchange: string;
    session_id: string;
    authorization_code: string;
}): Promise<{
    connection_id: string;
    identity_status: string;
}>;
/**
 * Performs Jaro-Winkler identity matching in Validate mode.
 */
export declare function matchIdentity({ session, adapter, access_token }: {
    session: any;
    adapter: any;
    access_token: string;
}): Promise<{
    matched: boolean;
    fuzzy: boolean;
    score?: never;
} | {
    matched: boolean;
    fuzzy: boolean;
    score: any;
} | {
    matched: boolean;
    score: any;
    fuzzy?: never;
}>;
/**
 * Initiates a withdrawal from the exchange to the client's deposit address.
 */
export declare function initiateExchangeWithdrawal({ session_id, amount, token }: {
    session_id: string;
    amount: string;
    token: string;
}): Promise<{
    withdrawal_id: any;
}>;
//# sourceMappingURL=service.d.ts.map