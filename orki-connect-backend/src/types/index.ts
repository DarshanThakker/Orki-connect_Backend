import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';

export enum WebhookEvent {
  CONNECTION_APPROVED = 'CONNECTION_APPROVED',
  CONNECTION_FLAGGED = 'CONNECTION_FLAGGED',
  CONNECTION_IDENTITY_MISMATCH = 'CONNECTION_IDENTITY_MISMATCH',
  DEPOSITS_PENDING = 'DEPOSITS_PENDING',
  DEPOSITS_SUBMITTED = 'DEPOSITS_SUBMITTED',
  DEPOSITS_DETECTED = 'DEPOSITS_DETECTED',
  DEPOSITS_CONFIRMED = 'DEPOSITS_CONFIRMED',
  DEPOSITS_FAILED = 'DEPOSITS_FAILED',
  DEPOSITS_ABANDONED = 'DEPOSITS_ABANDONED',
  DEPOSITS_UNEXPECTED = 'DEPOSITS_UNEXPECTED',
  WITHDRAWAL_SUBMITTED = 'WITHDRAWAL_SUBMITTED',
  WITHDRAWAL_CONFIRMED = 'WITHDRAWAL_CONFIRMED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
}

// ─── Re-export Prisma enums for convenience ───────────────────────────
export { Chain, ComplianceMode, ConnectionType };

// ─── Confirmation thresholds per network ─────────────────────────────
// WARNING: Do NOT adjust without a formal risk review.
// These are based on historical reorg data.
export const CONFIRMATION_THRESHOLDS: Record<Chain, number> = {
  ETHEREUM: 12,  // ~2.5 minutes
  POLYGON: 128,  // ~4 minutes — higher reorg risk
  SOLANA: 32,    // ~15 seconds (slots)
};

// ─── Billing plan session limits ─────────────────────────────────────
export const PLAN_SESSION_LIMITS = {
  STARTER: 3_000,
  GROWTH: 15_000,
  ENTERPRISE: Infinity,
} as const;

// ─── Connection fee tiers ─────────────────────────────────────────────
export const CONNECTION_FEE_TIERS = [
  { upTo: 5_000, fee: 1.00 },
  { upTo: 20_000, fee: 0.75 },
  { upTo: Infinity, fee: 0.50 },
] as const;

// ─── Session defaults ─────────────────────────────────────────────────
export const SESSION_TIMEOUT_MINUTES = 30;

// ─── Jaro-Winkler threshold for name matching (Validate mode) ─────────
export const NAME_MATCH_THRESHOLD = 0.92;

// ─── Webhook event names (as sent in payload) ─────────────────────────
export const WEBHOOK_EVENT_NAMES: Record<WebhookEvent, string> = {
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

// ─── API response types ───────────────────────────────────────────────

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
  kyc_name?: string; // Required when mode = VALIDATE + exchange flow
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
  event: string; // human-readable event name e.g. "connect.deposits.confirmed"
  idempotency_key: string;
  timestamp: string;
  // Validate mode identity mismatch extras
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

// ─── Error types ──────────────────────────────────────────────────────

export class OrkiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'OrkiError';
  }
}

export class ValidationError extends OrkiError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
  }
}

export class AuthError extends OrkiError {
  constructor(message = 'Unauthorized') {
    super('AUTH_ERROR', message, 401);
  }
}

export class NotFoundError extends OrkiError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class RiskFlaggedError extends OrkiError {
  constructor() {
    super('RISK_FLAGGED', 'Address flagged by AML screening', 403);
  }
}
