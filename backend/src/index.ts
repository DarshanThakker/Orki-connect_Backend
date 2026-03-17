import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';

// Route modules
import authRoutes from './modules/oauth-token-service/routes.js';
import sessionRoutes from './modules/session-service/routes.js';
import webhookRoutes from './modules/webhook-dispatcher/routes.js';
import exchangeRoutes from './modules/exchange-oauth-manager/routes.js';
import orgRoutes from './modules/org-config-service/routes.js';

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/oauth', authRoutes);
app.use('/v1/connect', sessionRoutes);
app.use('/v1/connect/oauth', exchangeRoutes);
app.use('/v1/webhooks', webhookRoutes);
app.use('/v1/org', orgRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Orki Connect API running on port ${PORT}`);
});

export default app;
