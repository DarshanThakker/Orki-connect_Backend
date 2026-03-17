import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import morgan from 'morgan';
import webhookRouter from './routes/webhook.js';
import balanceRouter from './routes/balance.js';
import sessionRouter from './routes/session.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/webhook', webhookRouter);
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
  console.log(`  POST /webhook               — receive Orki events`);
  console.log(`  GET  /api/balance           — all user balances`);
  console.log(`  GET  /api/balance/:userId   — single user balance`);
  console.log(`  GET  /api/balance/:userId/transactions`);
});
