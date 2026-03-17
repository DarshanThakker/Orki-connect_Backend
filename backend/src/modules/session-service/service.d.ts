import { SessionStatus, Prisma, Chain, ConnectionType, ComplianceMode } from '@prisma/client';
export declare const SESSION_STATUS: any;
/**
 * Creates a new Connect Session.
 */
export declare function createSession(params: {
    organization_id: string;
    user_id: string;
    deposit_address: string;
    network: Chain;
    token: string;
    mode?: ComplianceMode;
    kyc_name?: string;
    connection_type?: ConnectionType;
}): Promise<{
    session_id: string;
    session_jwt: string;
    refresh_token: string;
    expires_at: string;
}>;
/**
 * Retrieves a session by ID.
 */
export declare function getSession(session_id: string): Promise<any>;
/**
 * Transitions a session to a new status.
 */
export declare function updateSessionStatus(session_id: string, new_status: SessionStatus, updates?: Partial<Prisma.SessionUpdateInput>): Promise<any>;
/**
 * Expires a session after the 15-minute timeout.
 * If a tx_hash is already present (user signed at e.g. 14:59), transitions to
 * EXTENDED_MONITORING instead of EXPIRED so confirmation can still complete.
 */
export declare function expireSession(session_id: string): Promise<void>;
/**
 * Refreshes an existing session, granting a new 15-minute lease.
 */
export declare function refreshSession(refresh_token: string): Promise<{
    session_id: any;
    session_jwt: string;
    expires_at: string;
}>;
//# sourceMappingURL=service.d.ts.map