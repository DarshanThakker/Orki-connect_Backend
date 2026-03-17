import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';

export { Chain, ComplianceMode, ConnectionType };

// ─── Webhook Events ───────────────────────────────────────────────────────────
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

// ─── Confirmation thresholds per network ─────────────────────────────────────
// WARNING: Do NOT adjust without a formal risk review.
export const CONFIRMATION_THRESHOLDS: Record<Chain, number> = {
  ETHEREUM: 12,
  POLYGON: 128,
  SOLANA: 32,
};

// ─── Billing plan session limits ─────────────────────────────────────────────
export const PLAN_SESSION_LIMITS = {
  STARTER: 3_000,
  GROWTH: 15_000,
  ENTERPRISE: Infinity,
} as const;

// ─── Session defaults ─────────────────────────────────────────────────────────
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
export const SESSION_TIMEOUT_MINUTES = 30;
export const NAME_MATCH_THRESHOLD = 0.92;

// ─── API types ────────────────────────────────────────────────────────────────
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

export interface RiskResult {
  status: 'ACCEPTABLE' | 'HIGH' | 'UNKNOWN';
  risk_score: number | null;
  flags: string[];
  mock?: boolean;
  error?: string;
}

export interface IdentityMatchResult {
  matched: boolean;
  fuzzy?: boolean;
  score?: number;
}
