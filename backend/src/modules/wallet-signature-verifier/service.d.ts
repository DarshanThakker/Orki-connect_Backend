/**
 * MODULE 05 — Wallet Signature Verifier
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies that the user genuinely controls the wallet address they claim to own.
 * Supports EVM (personal_sign, eth_sign, eth_signTypedData) and Solana.
 *
 * IMPORTANT: Each wallet handles signing differently:
 *   MetaMask   → personal_sign
 *   Trust Wallet → personal_sign + eth_sign
 *   Ledger     → eth_signTypedData (EIP-712)
 *
 * Risk: MEDIUM — per-wallet quirks require testing against real wallets
 * Dependencies: Session Service
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * Verifies an EVM wallet signature using personal_sign.
 */
export declare function verifyEVMSignature(wallet_address: string, signature: string): boolean;
/**
 * Verifies a Ledger / EIP-712 typed data signature.
 */
export declare function verifyEIP712Signature(wallet_address: string, signature: string, typedData: any): boolean;
/**
 * Verifies a Solana wallet signature.
 */
export declare function verifySolanaSignature(wallet_address: string, signature: string): Promise<boolean>;
/**
 * Main entry point — verifies wallet ownership for a session.
 */
export declare function verifyWalletOwnership(params: {
    session_id: string;
    wallet_address: string;
    signature: string;
    wallet_type?: string;
    typed_data?: any;
}): Promise<{
    connection_id: string;
    risk_status: string;
}>;
//# sourceMappingURL=service.d.ts.map