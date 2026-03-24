import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import morgan from 'morgan';
import webhookRouter from './routes/webhook.js';
import balanceRouter from './routes/balance.js';
import sessionRouter from './routes/session.js';
import { config } from './config/index.js';

const app = express();
const PORT = process.env.PORT ?? 5000;

async function registerDepositAddresses() {
  if (!config.ORKI_SOLANA_DEPOSIT_ADDRESS) {
    console.log('[startup] No deposit addresses configured — skipping registration');
    return;
  }

  const addresses: Record<string, string> = {};
  if (config.ORKI_SOLANA_DEPOSIT_ADDRESS) addresses['SOLANA'] = config.ORKI_SOLANA_DEPOSIT_ADDRESS;

  try {
    const res = await fetch(`${config.ORKI_BACKEND_URL}/v1/org/deposit-addresses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.ORKI_ORG_ACCESS_TOKEN}` },
      body: JSON.stringify({ addresses }),
    });
    if (res.ok) {
      console.log('[startup] Deposit addresses registered:', Object.keys(addresses).join(', '));
    } else {
      const body = await res.json() as any;
      console.error('[startup] Failed to register deposit addresses:', body.error ?? res.status);
    }
  } catch (err: any) {
    console.error('[startup] Could not reach Orki backend to register deposit addresses:', err.message);
  }
}

app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/session', sessionRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`bank-backend running on http://localhost:${PORT}`);
  console.log(`  POST /webhook                          — receive Orki events`);
  console.log(`  POST /api/session                      — create Orki session`);
  console.log(`  GET  /api/balance                      — all user balances`);
  console.log(`  GET  /api/balance/:userId              — single user balance`);
  console.log(`  GET  /api/balance/:userId/transactions — user transaction history`);
  console.log(`  GET  /health                           — health check`);
  registerDepositAddresses();
});
