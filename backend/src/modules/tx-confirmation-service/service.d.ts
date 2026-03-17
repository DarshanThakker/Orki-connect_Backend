/**
 * Saves tx_hash to DB synchronously (critical for 14:59 safety),
 * dispatches connect.deposits.submitted immediately,
 * then fires async blockchain polling as fire-and-forget.
 *
 * Returns after the synchronous steps — does NOT wait for blockchain confirmation.
 */
export declare function confirmTransaction(params: {
    session_id: string;
    tx_hash: string;
    network: string;
    token: string;
    organization_id: string;
    user_id: string;
    deposit_address: string;
    amount: string;
}): Promise<void>;
//# sourceMappingURL=service.d.ts.map