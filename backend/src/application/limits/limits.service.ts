import { logger } from '../../utils/logger';
import { redis, TTL } from '../../infrastructure/cache/redis.client';
import { getOrgConfig } from '../org/org.service';
import { getSession } from '../session/session.service';

export async function enforceTransferLimits(params: { session_id: string; amount: string | number; exchange_fee?: number }) {
  const { session_id, amount, exchange_fee = 0 } = params;
  const session = await getSession(session_id);
  const config = await getOrgConfig(session.organization_id);
  const { min_per_transaction, max_per_transaction, daily_user_limit } = config;
  const num = toNumber(amount);
  logger.info('Enforcing transfer limits', { session_id, amount: num, min_per_transaction, max_per_transaction, daily_user_limit });

  if (num < min_per_transaction) {
    logger.warn('Amount below minimum', { session_id, amount: num, minimum: min_per_transaction });
    throw Object.assign(new Error(`Amount $${num} is below minimum $${min_per_transaction}`), { status: 400, code: 'BELOW_MINIMUM', details: { amount: num, minimum: min_per_transaction } });
  }
  if (num > max_per_transaction) {
    logger.warn('Amount exceeds maximum', { session_id, amount: num, maximum: max_per_transaction });
    throw Object.assign(new Error(`Amount $${num} exceeds maximum $${max_per_transaction}`), { status: 400, code: 'ABOVE_MAXIMUM', details: { amount: num, maximum: max_per_transaction } });
  }
  if (exchange_fee > 0 && (num - exchange_fee) < min_per_transaction) {
    logger.warn('Net amount after fee below minimum', { session_id, amount: num, exchange_fee, net: num - exchange_fee, minimum: min_per_transaction });
    throw Object.assign(new Error(`Net amount after fee falls below minimum`), { status: 400, code: 'NET_AMOUNT_BELOW_MINIMUM' });
  }

  const dailyKey = getDailyKey(session.organization_id, session.user_id);
  const currentTotal = await getDailyTotal(dailyKey);
  logger.info('Daily usage fetched', { session_id, organization_id: session.organization_id, user_id: session.user_id, current_daily_total: currentTotal, daily_limit: daily_user_limit });

  if (currentTotal + num > daily_user_limit) {
    const remaining = daily_user_limit - currentTotal;
    logger.warn('Daily limit exceeded', { session_id, amount: num, current_daily_total: currentTotal, daily_limit: daily_user_limit, remaining });
    throw Object.assign(new Error(`Transfer exceeds daily limit. Remaining: $${remaining}`), { status: 400, code: 'DAILY_LIMIT_EXCEEDED', details: { amount: num, daily_limit: daily_user_limit, remaining } });
  }

  logger.info('Limit check passed', { session_id, amount: num, current_daily_total: currentTotal, daily_limit: daily_user_limit });
  return { amount: num, net_amount: num - exchange_fee, daily_total_after: currentTotal + num, remaining_daily: daily_user_limit - (currentTotal + num) };
}

export async function recordConfirmedDeposit(organization_id: string, user_id: string, amount: string | number) {
  const key = getDailyKey(organization_id, user_id);
  const num = toNumber(amount);
  // Atomic increment — safe across multiple instances
  const newTotal = await redis.incrbyfloat(key, num);
  // Set expiry only on first write (when value equals what we just added)
  if (parseFloat(newTotal) === num) {
    await redis.expire(key, TTL.DAILY_LIMIT_EXPIRY);
  }
  logger.info('Daily total updated', { organization_id, user_id, amount: num, new_total: newTotal });
}

export async function getDailyUsage(organization_id: string, user_id: string): Promise<number> {
  return getDailyTotal(getDailyKey(organization_id, user_id));
}

async function getDailyTotal(key: string): Promise<number> {
  const val = await redis.get(key);
  return val ? parseFloat(val) : 0;
}

function getDailyKey(org: string, user: string) {
  return `daily:${org}:${user}:${new Date().toISOString().slice(0, 10)}`;
}

function toNumber(val: string | number): number {
  return typeof val === 'string' ? parseFloat(val) : val;
}
