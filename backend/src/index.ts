import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { disconnectDatabase } from './infrastructure/database/prisma.client';
import { disconnectRedis } from './infrastructure/cache/redis.client';
import { runSeed } from './seed';

const server = app.listen(config.port, async () => {
  logger.info('Orki Connect API started', { port: config.port, env: config.nodeEnv });
  if (config.isDev) {
    await runSeed().catch((err) => logger.warn('Seed failed', { error: err.message }));
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  logger.info('Shutting down server...');
  server.close(async () => {
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
