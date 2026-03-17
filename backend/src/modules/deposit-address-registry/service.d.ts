import { Chain } from '@prisma/client';
/**
 * Validates a deposit address for the given network.
 */
export declare function validateAddress(address: string, network: Chain): void;
/**
 * Registers a deposit address for a session.
 */
export declare function registerAddress(session_id: string, deposit_address: string, network: Chain): Promise<any>;
/**
 * Retrieves the registered deposit address for a session.
 */
export declare function getAddressBySession(session_id: string): Promise<any>;
/**
 * Deregisters a deposit address when the session ends.
 */
export declare function deregisterAddress(session_id: string): Promise<any>;
//# sourceMappingURL=service.d.ts.map