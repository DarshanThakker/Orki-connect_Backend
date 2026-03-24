import { UserBalance, Transaction, WebhookPayload } from '../types.js';

// In-memory store — swap for a DB in production
const balances = new Map<string, UserBalance>();
const transactions = new Map<string, Transaction>(); // keyed by idempotency_key
const processedKeys = new Set<string>();             // idempotency guard

export function creditUser(payload: WebhookPayload): { credited: boolean; balance: UserBalance } {
  console.log("Crediting user:", payload);
  const { user_id, amount, token, idempotency_key, tx_hash, network, deposit_address, timestamp, event } = payload;

  // Idempotency — skip if already processed
  if (processedKeys.has(idempotency_key)) {
    console.log("Skipping duplicate idempotency key:", idempotency_key);
    return { credited: false, balance: getOrCreate(user_id) };
  }

  const creditAmount = parseFloat(amount ?? '0');
  const assetKey = (token ?? 'UNKNOWN').toUpperCase();

  if (!creditAmount || creditAmount <= 0) {
    return { credited: false, balance: getOrCreate(user_id) };
  }

  const userBalance = getOrCreate(user_id);
  userBalance.balances[assetKey] = (userBalance.balances[assetKey] ?? 0) + creditAmount;
  userBalance.last_updated = new Date().toISOString();
  balances.set(user_id, userBalance);

  transactions.set(idempotency_key, {
    idempotency_key,
    user_id,
    event,
    token: assetKey,
    amount: creditAmount,
    tx_hash,
    network,
    deposit_address,
    timestamp,
  } as any);

  console.log("Added idempotency key:", idempotency_key);
  processedKeys.add(idempotency_key);

  console.log("Credited user:", user_id, "New balance:", userBalance);
  return { credited: true, balance: userBalance };
}

export function getBalance(user_id: string): UserBalance | null {
  console.log("Getting balance for user:", user_id);
  return balances.get(user_id) ?? null;
}

export function getAllBalances(): UserBalance[] {
  console.log("Getting all balances");
  return Array.from(balances.values());
}

export function getTransactions(user_id: string): Transaction[] {
  console.log("Getting transactions for user:", user_id);
  return Array.from(transactions.values()).filter((t) => t.user_id === user_id);
}

function getOrCreate(user_id: string): UserBalance {
  console.log("Getting or creating user:", user_id);
  if (!balances.has(user_id)) {
    balances.set(user_id, { user_id, balances: {}, last_updated: new Date().toISOString() });
  }
  return balances.get(user_id)!;
}
