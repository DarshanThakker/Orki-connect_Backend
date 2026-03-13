import { Chain } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';
// ─── Network Address Validators ───────────────────────────────────────────────
const VALIDATORS = {
    [Chain.ETHEREUM]: (addr) => ethers.isAddress(addr),
    [Chain.POLYGON]: (addr) => ethers.isAddress(addr),
    [Chain.SOLANA]: (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr), // Base58 validation
};
/**
 * Validates a deposit address for the given network.
 */
export function validateAddress(address, network) {
    const validator = VALIDATORS[network];
    if (!validator) {
        const err = new Error(`Unsupported network: ${network}`);
        err.status = 400;
        err.code = 'UNSUPPORTED_NETWORK';
        throw err;
    }
    if (!validator(address)) {
        const err = new Error(`Invalid ${network} address format: ${address}`);
        err.status = 400;
        err.code = 'INVALID_ADDRESS_FORMAT';
        throw err;
    }
}
/**
 * Registers a deposit address for a session.
 */
export async function registerAddress(session_id, deposit_address, network) {
    validateAddress(deposit_address, network);
    const entry = await prisma.depositAddress.upsert({
        where: { session_id },
        update: {
            address: deposit_address,
            network,
        },
        create: {
            session_id,
            address: deposit_address,
            network,
        },
    });
    logger.info('Deposit address registered', { session_id, network, address: deposit_address });
    return entry;
}
/**
 * Retrieves the registered deposit address for a session.
 */
export async function getAddressBySession(session_id) {
    return prisma.depositAddress.findUnique({
        where: { session_id },
    });
}
/**
 * Deregisters a deposit address when the session ends.
 */
export async function deregisterAddress(session_id) {
    try {
        const deleted = await prisma.depositAddress.delete({
            where: { session_id },
        });
        logger.info('Deposit address deregistered', { session_id });
        return deleted;
    }
    catch (err) {
        // If not found, skip
        if (err.code === 'P2025')
            return null;
        throw err;
    }
}
//# sourceMappingURL=service.js.map