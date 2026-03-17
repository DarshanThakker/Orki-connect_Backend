import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';
export declare enum WebhookEvent {
    CONNECTION_APPROVED = "CONNECTION_APPROVED",
    CONNECTION_FLAGGED = "CONNECTION_FLAGGED",
    CONNECTION_IDENTITY_MISMATCH = "CONNECTION_IDENTITY_MISMATCH",
    DEPOSITS_PENDING = "DEPOSITS_PENDING",
    DEPOSITS_SUBMITTED = "DEPOSITS_SUBMITTED",
    DEPOSITS_DETECTED = "DEPOSITS_DETECTED",
    DEPOSITS_CONFIRMED = "DEPOSITS_CONFIRMED",
    DEPOSITS_FAILED = "DEPOSITS_FAILED",
    DEPOSITS_ABANDONED = "DEPOSITS_ABANDONED",
    DEPOSITS_UNEXPECTED = "DEPOSITS_UNEXPECTED",
    WITHDRAWAL_SUBMITTED = "WITHDRAWAL_SUBMITTED",
    WITHDRAWAL_CONFIRMED = "WITHDRAWAL_CONFIRMED",
    WITHDRAWAL_FAILED = "WITHDRAWAL_FAILED"
}
export { Chain, ComplianceMode, ConnectionType };
export declare const CONFIRMATION_THRESHOLDS: Record<Chain, number>;
export declare const PLAN_SESSION_LIMITS: {
    readonly STARTER: 3000;
    readonly GROWTH: 15000;
    readonly ENTERPRISE: number;
};
export declare const CONNECTION_FEE_TIERS: readonly [{
    readonly upTo: 5000;
    readonly fee: 1;
}, {
    readonly upTo: 20000;
    readonly fee: 0.75;
}, {
    readonly upTo: number;
    readonly fee: 0.5;
}];
export declare const SESSION_TIMEOUT_MINUTES = 30;
export declare const NAME_MATCH_THRESHOLD = 0.92;
export declare const WEBHOOK_EVENT_NAMES: Record<WebhookEvent, string>;
export interface AccessTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
}
export interface CreateSessionRequest {
    user_id: string;
    deposit_address: string;
    network: Chain;
    token: string;
    mode: ComplianceMode;
    kyc_name?: string;
}
export interface CreateSessionResponse {
    session_id: string;
    session_jwt: string;
    expires_at: string;
}
export interface WebhookPayload {
    organization_id: string;
    user_id: string;
    deposit_address: string;
    from_address?: string;
    amount?: string;
    token?: string;
    network?: Chain;
    tx_hash?: string;
    confirmations?: number;
    mode: ComplianceMode;
    session_id: string;
    event: string;
    idempotency_key: string;
    timestamp: string;
    exchange_name_returned?: string;
    kyc_name_provided?: string;
    similarity_score?: number;
    fuzzy_match?: boolean;
}
export interface EllipticRiskResponse {
    result: 'PASS' | 'FAIL';
    riskScore: number;
    flagCategories: string[];
    rawResponse: Record<string, unknown>;
}
export interface IdentityMatchResult {
    matched: boolean;
    fuzzyMatch: boolean;
    similarityScore: number;
    exchangeNameReturned: string;
    kycNameProvided: string;
}
export declare class OrkiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
export declare class ValidationError extends OrkiError {
    constructor(message: string);
}
export declare class AuthError extends OrkiError {
    constructor(message?: string);
}
export declare class NotFoundError extends OrkiError {
    constructor(resource: string);
}
export declare class RiskFlaggedError extends OrkiError {
    constructor();
}
//# sourceMappingURL=index.d.ts.map