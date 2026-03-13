import { SessionStatus, Prisma, Chain, ConnectionType, ComplianceMode } from '@prisma/client';
export declare const SESSION_STATUS: {
    CREATED: "CREATED";
    ACTIVE: "ACTIVE";
    COMPLETED: "COMPLETED";
    FAILED: "FAILED";
    EXPIRED: "EXPIRED";
    EXTENDED_MONITORING: "EXTENDED_MONITORING";
};
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
    expires_at: string;
}>;
/**
 * Retrieves a session by ID.
 */
export declare function getSession(session_id: string): Promise<{
    id: string;
    organization_id: string;
    created_at: Date;
    updated_at: Date;
    session_id: string;
    user_id: string;
    deposit_address: string;
    network: import("@prisma/client").$Enums.Chain;
    token: string;
    mode: import("@prisma/client").$Enums.ComplianceMode;
    kyc_name: string | null;
    connection_type: import("@prisma/client").$Enums.ConnectionType;
    status: import("@prisma/client").$Enums.SessionStatus;
    tx_hash: string | null;
    connection_id: string | null;
    exchange: string | null;
    wallet_address: string | null;
    risk_flag: Prisma.JsonValue | null;
    expires_at: Date;
}>;
/**
 * Transitions a session to a new status.
 */
export declare function updateSessionStatus(session_id: string, new_status: SessionStatus, updates?: Partial<Prisma.SessionUpdateInput>): Promise<{
    id: string;
    organization_id: string;
    created_at: Date;
    updated_at: Date;
    session_id: string;
    user_id: string;
    deposit_address: string;
    network: import("@prisma/client").$Enums.Chain;
    token: string;
    mode: import("@prisma/client").$Enums.ComplianceMode;
    kyc_name: string | null;
    connection_type: import("@prisma/client").$Enums.ConnectionType;
    status: import("@prisma/client").$Enums.SessionStatus;
    tx_hash: string | null;
    connection_id: string | null;
    exchange: string | null;
    wallet_address: string | null;
    risk_flag: Prisma.JsonValue | null;
    expires_at: Date;
}>;
/**
 * Expires a session after the 30-minute timeout.
 */
export declare function expireSession(session_id: string): Promise<void>;
//# sourceMappingURL=service.d.ts.map