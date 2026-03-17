import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorMiddleware } from './interfaces/http/middleware/error.middleware';
import authRoutes from './interfaces/http/routes/auth.routes';
import sessionRoutes from './interfaces/http/routes/session.routes';
import webhookRoutes from './interfaces/http/routes/webhook.routes';
import exchangeRoutes from './interfaces/http/routes/exchange.routes';
import orgRoutes from './interfaces/http/routes/org.routes';

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/oauth', authRoutes);
app.use('/v1/connect', sessionRoutes);
app.use('/v1/connect/oauth', exchangeRoutes);
app.use('/v1/webhooks', webhookRoutes);
app.use('/v1/org', orgRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
