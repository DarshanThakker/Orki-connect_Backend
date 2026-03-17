import { PrismaClient } from '@prisma/client';
declare class DatabaseClient {
    private static instance;
    private constructor();
    static getInstance(): PrismaClient;
    static disconnect(): Promise<void>;
}
export declare const prisma: PrismaClient;
export declare const disconnectDatabase: typeof DatabaseClient.disconnect;
export {};
//# sourceMappingURL=prisma.d.ts.map