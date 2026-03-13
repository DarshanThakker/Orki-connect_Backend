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
import { logger } from '../../utils/logger.js';
import { getOrgConfig } from '../org-config-service/service.js';
import { getSession } from '../session-service/service.js';
// ─── Daily totals store (use Redis in production for atomic increments) ────────
const dailyTotals = new Map();
/**
 * Validates a transfer amount against all applicable limits.
 */
export async function enforceTransferLimits(params) {
    const { session_id, amount, exchange_fee = 0 } = params;
    const session = await getSession(session_id);
    const config = await getOrgConfig(session.organization_id);
    const { min_per_transaction, max_per_transaction, daily_user_limit } = config;
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    // ── 1. Minimum per transaction ────────────────────────────────────────────
    if (numAmount < min_per_transaction) {
        throwLimitError(`Amount $${numAmount} is below the minimum transfer of $${min_per_transaction}`, 'BELOW_MINIMUM', { amount: numAmount, minimum: min_per_transaction });
    }
    // ── 2. Maximum per transaction ────────────────────────────────────────────
    if (numAmount > max_per_transaction) {
        throwLimitError(`Amount $${numAmount} exceeds the maximum transfer of $${max_per_transaction}`, 'ABOVE_MAXIMUM', { amount: numAmount, maximum: max_per_transaction });
    }
    // ── 3. Exchange fee check — net amount must still exceed minimum ──────────
    if (exchange_fee > 0) {
        const net_amount = numAmount - exchange_fee;
        if (net_amount < min_per_transaction) {
            throwLimitError(`After exchange fee ($${exchange_fee}), net amount $${net_amount} falls below the minimum $${min_per_transaction}`, 'NET_AMOUNT_BELOW_MINIMUM', { amount: numAmount, exchange_fee, net_amount, minimum: min_per_transaction });
        }
    }
    // ── 4. Daily user limit ───────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `${session.organization_id}:${session.user_id}:${today}`;
    const currentDailyTotal = dailyTotals.get(dailyKey) || 0;
    if (currentDailyTotal + numAmount > daily_user_limit) {
        const remaining = daily_user_limit - currentDailyTotal;
        throwLimitError(`Transfer of $${numAmount} would exceed daily limit of $${daily_user_limit}. Remaining today: $${remaining}`, 'DAILY_LIMIT_EXCEEDED', { amount: numAmount, daily_limit: daily_user_limit, current_total: currentDailyTotal, remaining });
    }
    logger.info('Limit check passed', {
        session_id,
        amount: numAmount,
        daily_total_after: currentDailyTotal + numAmount,
        daily_limit: daily_user_limit,
    });
    return {
        amount: numAmount,
        net_amount: numAmount - exchange_fee,
        daily_total_after: currentDailyTotal + numAmount,
        remaining_daily: daily_user_limit - (currentDailyTotal + numAmount),
    };
}
/**
 * Updates the daily running total for a user after a confirmed deposit.
 */
export async function recordConfirmedDeposit(organization_id, user_id, amount) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `${organization_id}:${user_id}:${today}`;
    const current = dailyTotals.get(dailyKey) || 0;
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    dailyTotals.set(dailyKey, current + numAmount);
    logger.info('Daily total updated', { organization_id, user_id, amount: numAmount, new_total: current + numAmount });
}
/**
 * Returns the current daily usage for a user.
 */
export async function getDailyUsage(organization_id, user_id) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `${organization_id}:${user_id}:${today}`;
    return dailyTotals.get(dailyKey) || 0;
}
function throwLimitError(message, code, details = {}) {
    const err = new Error(message);
    err.status = 400;
    err.code = code;
    err.details = details;
    throw err;
}
//# sourceMappingURL=service.js.map