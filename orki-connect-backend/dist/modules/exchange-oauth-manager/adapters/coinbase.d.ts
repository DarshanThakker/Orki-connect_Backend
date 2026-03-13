/**
 * Coinbase Advanced Trade API — OAuth Adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Apply for credentials: developer.coinbase.com
 * ─────────────────────────────────────────────────────────────────────────────
 */
export declare function buildAuthUrl(session_id: string): string;
export declare function exchangeCode(authorization_code: string): Promise<any>;
export declare function getAccountProfile(access_token: string): Promise<{
    account_holder_name: any;
    email: any;
}>;
export declare function getDepositAddress(access_token: string): Promise<any>;
export declare function getWithdrawalFee(access_token: string, asset: string): Promise<number>;
export declare function initiateWithdrawal({ access_token, asset, amount, destination_address }: {
    access_token: string;
    asset: string;
    amount: string;
    destination_address: string;
}): Promise<{
    id: any;
    tx_hash: any;
}>;
//# sourceMappingURL=coinbase.d.ts.map