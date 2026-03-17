import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger.js';
class DatabaseClient {
    static instance;
    constructor() { }
    static getInstance() {
        if (!DatabaseClient.instance) {
            const adapter = new PrismaPg({
                connectionString: process.env.DATABASE_URL,
            });
            DatabaseClient.instance = new PrismaClient({
                //@ts-ignore
                adapter,
                log: [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'stdout' },
                    { level: 'warn', emit: 'stdout' },
                ],
            });
            if (process.env.NODE_ENV === 'development') {
                DatabaseClient.instance.$on('query', (e) => {
                    logger.debug(`Query: ${e.query}`);
                    logger.debug(`Duration: ${e.duration}ms`);
                });
            }
        }
        return DatabaseClient.instance;
    }
    static async disconnect() {
        if (DatabaseClient.instance) {
            await DatabaseClient.instance.$disconnect();
            logger.info('Database disconnected');
        }
    }
}
// Export singleton instance
export const prisma = DatabaseClient.getInstance();
// Export disconnect function for graceful shutdown
export const disconnectDatabase = DatabaseClient.disconnect;
//# sourceMappingURL=prisma.js.map