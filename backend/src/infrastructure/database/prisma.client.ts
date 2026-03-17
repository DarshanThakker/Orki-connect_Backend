import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../../config';
import { logger } from '../../utils/logger';

class DatabaseClient {
  private static instance: PrismaClient;

  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      const adapter = new PrismaPg({ connectionString: config.databaseUrl });

      DatabaseClient.instance = new PrismaClient({
        //@ts-ignore
        adapter,
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
      });

      if (config.isDev) {
        DatabaseClient.instance.$on('query' as never, (e: any) => {
          logger.debug(`Query: ${e.query} — ${e.duration}ms`);
        });
      }
    }
    return DatabaseClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
      logger.info('Database disconnected');
    }
  }
}

export const prisma = DatabaseClient.getInstance();
export const disconnectDatabase = DatabaseClient.disconnect;
