import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';
export var WebhookEvent;
(function (WebhookEvent) {
    WebhookEvent["CONNECTION_APPROVED"] = "CONNECTION_APPROVED";
    WebhookEvent["CONNECTION_FLAGGED"] = "CONNECTION_FLAGGED";
    WebhookEvent["CONNECTION_IDENTITY_MISMATCH"] = "CONNECTION_IDENTITY_MISMATCH";
    WebhookEvent["DEPOSITS_PENDING"] = "DEPOSITS_PENDING";
    WebhookEvent["DEPOSITS_SUBMITTED"] = "DEPOSITS_SUBMITTED";
    WebhookEvent["DEPOSITS_DETECTED"] = "DEPOSITS_DETECTED";
    WebhookEvent["DEPOSITS_CONFIRMED"] = "DEPOSITS_CONFIRMED";
    WebhookEvent["DEPOSITS_FAILED"] = "DEPOSITS_FAILED";
    WebhookEvent["DEPOSITS_ABANDONED"] = "DEPOSITS_ABANDONED";
    WebhookEvent["DEPOSITS_UNEXPECTED"] = "DEPOSITS_UNEXPECTED";
    WebhookEvent["WITHDRAWAL_SUBMITTED"] = "WITHDRAWAL_SUBMITTED";
    WebhookEvent["WITHDRAWAL_CONFIRMED"] = "WITHDRAWAL_CONFIRMED";
    WebhookEvent["WITHDRAWAL_FAILED"] = "WITHDRAWAL_FAILED";
})(WebhookEvent || (WebhookEvent = {}));
// ─── Re-export Prisma enums for convenience ───────────────────────────
export { Chain, ComplianceMode, ConnectionType };
// ─── Confirmation thresholds per network ─────────────────────────────
// WARNING: Do NOT adjust without a formal risk review.
// These are based on historical reorg data.
export const CONFIRMATION_THRESHOLDS = {
    ETHEREUM: 12, // ~2.5 minutes
    POLYGON: 128, // ~4 minutes — higher reorg risk
    SOLANA: 32, // ~15 seconds (slots)
};
// ─── Billing plan session limits ─────────────────────────────────────
export const PLAN_SESSION_LIMITS = {
    STARTER: 3_000,
    GROWTH: 15_000,
    ENTERPRISE: Infinity,
};
// ─── Connection fee tiers ─────────────────────────────────────────────
export const CONNECTION_FEE_TIERS = [
    { upTo: 5_000, fee: 1.00 },
    { upTo: 20_000, fee: 0.75 },
    { upTo: Infinity, fee: 0.50 },
];
// ─── Session defaults ─────────────────────────────────────────────────
export const SESSION_TIMEOUT_MINUTES = 30;
// ─── Jaro-Winkler threshold for name matching (Validate mode) ─────────
export const NAME_MATCH_THRESHOLD = 0.92;
// ─── Webhook event names (as sent in payload) ─────────────────────────
export const WEBHOOK_EVENT_NAMES = {
    CONNECTION_APPROVED: 'connect.connection.approved',
    CONNECTION_FLAGGED: 'connect.connection.flagged',
    CONNECTION_IDENTITY_MISMATCH: 'connect.connection.identity_mismatch',
    DEPOSITS_PENDING: 'connect.deposits.pending',
    DEPOSITS_SUBMITTED: 'connect.deposits.submitted',
    DEPOSITS_DETECTED: 'connect.deposits.detected',
    DEPOSITS_CONFIRMED: 'connect.deposits.confirmed',
    DEPOSITS_FAILED: 'connect.deposits.failed',
    DEPOSITS_ABANDONED: 'connect.deposits.abandoned',
    DEPOSITS_UNEXPECTED: 'connect.deposits.unexpected',
    WITHDRAWAL_SUBMITTED: 'connect.withdrawal.submitted',
    WITHDRAWAL_CONFIRMED: 'connect.withdrawal.confirmed',
    WITHDRAWAL_FAILED: 'connect.withdrawal.failed',
};
// ─── Error types ──────────────────────────────────────────────────────
export class OrkiError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'OrkiError';
    }
}
export class ValidationError extends OrkiError {
    constructor(message) {
        super('VALIDATION_ERROR', message, 422);
    }
}
export class AuthError extends OrkiError {
    constructor(message = 'Unauthorized') {
        super('AUTH_ERROR', message, 401);
    }
}
export class NotFoundError extends OrkiError {
    constructor(resource) {
        super('NOT_FOUND', `${resource} not found`, 404);
    }
}
export class RiskFlaggedError extends OrkiError {
    constructor() {
        super('RISK_FLAGGED', 'Address flagged by AML screening', 403);
    }
}
//# sourceMappingURL=index.js.map