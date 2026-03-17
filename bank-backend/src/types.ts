export interface WebhookPayload {
  organization_id: string;
  user_id: string;
  session_id: string;
  deposit_address: string;
  from_address?: string;
  amount?: string;           // decimal string e.g. "100.00"
  token?: string;            // e.g. "USDC"
  network?: string;          // e.g. "SOLANA"
  tx_hash?: string;
  confirmations?: number;
  mode: string;
  event: string;             // e.g. "connect.deposits.confirmed"
  idempotency_key: string;
  timestamp: string;
}

export interface UserBalance {
  user_id: string;
  balances: Record<string, number>; // token → amount, e.g. { USDC: 250.00 }
  last_updated: string;
}

export interface Transaction {
  idempotency_key: string;
  user_id: string;
  event: string;
  token: string;
  amount: number;
  tx_hash?: string;
  network?: string;
  deposit_address: string;
  timestamp: string;
}
