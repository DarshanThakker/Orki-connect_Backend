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
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { logger } from '../../utils/logger.js';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session-service/service.js';
import { dispatchWebhookEvent } from '../webhook-dispatcher/service.js';
import { screenWalletAddress } from '../elliptic-risk-service/service.js';
const SIGN_MESSAGE = 'Sign to connect'; // Must match SDK exactly
/**
 * Verifies an EVM wallet signature using personal_sign.
 */
export function verifyEVMSignature(wallet_address, signature) {
    try {
        const recoveredAddress = ethers.verifyMessage(SIGN_MESSAGE, signature);
        return recoveredAddress.toLowerCase() === wallet_address.toLowerCase();
    }
    catch {
        return false;
    }
}
/**
 * Verifies a Ledger / EIP-712 typed data signature.
 */
export function verifyEIP712Signature(wallet_address, signature, typedData) {
    try {
        const { domain, types, value } = typedData;
        const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
        return recoveredAddress.toLowerCase() === wallet_address.toLowerCase();
    }
    catch {
        return false;
    }
}
/**
 * Verifies a Solana wallet signature.
 */
export async function verifySolanaSignature(wallet_address, signature) {
    try {
        const messageBytes = Buffer.from(SIGN_MESSAGE);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = bs58.decode(wallet_address);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    }
    catch {
        return false;
    }
}
/**
 * Main entry point — verifies wallet ownership for a session.
 */
export async function verifyWalletOwnership(params) {
    const { session_id, wallet_address, signature, wallet_type = 'generic', typed_data } = params;
    const session = await getSession(session_id);
    let isValid = false;
    if (session.network === 'SOLANA') {
        isValid = await verifySolanaSignature(wallet_address, signature);
    }
    else if (wallet_type === 'ledger' && typed_data) {
        isValid = verifyEIP712Signature(wallet_address, signature, typed_data);
    }
    else {
        isValid = verifyEVMSignature(wallet_address, signature);
    }
    if (!isValid) {
        logger.warn('Wallet signature verification failed', { session_id, wallet_address, wallet_type });
        const err = new Error('Wallet signature verification failed');
        err.status = 401;
        err.code = 'SIGNATURE_INVALID';
        throw err;
    }
    logger.info('Wallet signature verified', { session_id, wallet_address, wallet_type });
    const connection_id = `conn_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { connection_id, wallet_address });
    await dispatchWebhookEvent(session_id, 'connect.connection.approved', { connection_id, wallet_address });
    const riskResult = await screenWalletAddress(session_id, wallet_address);
    if (riskResult.status === 'HIGH') {
        await updateSessionStatus(session_id, SESSION_STATUS.FAILED, { risk_flag: riskResult });
        await dispatchWebhookEvent(session_id, 'connect.connection.flagged', { risk_result: riskResult });
        logger.warn('Wallet flagged by Elliptic — flow stopped', { session_id, wallet_address });
        return { connection_id, risk_status: 'FLAGGED' };
    }
    // Only reaches here if risk passed
    await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { connection_id, wallet_address });
    await dispatchWebhookEvent(session_id, 'connect.connection.approved', { connection_id, wallet_address });
    return { connection_id, risk_status: 'PASS' };
}
//# sourceMappingURL=service.js.map