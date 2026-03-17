/**
 * MODULE 09 — Limit Enforcement Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces per-transaction and daily user limits before any transfer is initiated.
 * Pure logic module — no external dependencies beyond config and Redis.
 *
 * Checks in order:
 *   1. amount >= org min_per_transaction
 *   2. amount <= org max_per_transaction
 *   3. (daily_total + amount) <= org daily_user_limit
 *   4. (amount - exchange_fee) >= org min_per_transaction [exchange flow only]
 *
 * Risk: LOW — pure logic, no external dependencies
 * Dependencies: Org Config Service, Session Service
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * Validates a transfer amount against all applicable limits.
 */
export declare function enforceTransferLimits(params: {
    session_id: string;
    amount: string | number;
    exchange_fee?: number;
}): Promise<{
    amount: number;
    net_amount: number;
    daily_total_after: number;
    remaining_daily: number;
}>;
/**
 * Updates the daily running total for a user after a confirmed deposit.
 */
export declare function recordConfirmedDeposit(organization_id: string, user_id: string, amount: string | number): Promise<void>;
/**
 * Returns the current daily usage for a user.
 */
export declare function getDailyUsage(organization_id: string, user_id: string): Promise<number>;
//# sourceMappingURL=service.d.ts.map