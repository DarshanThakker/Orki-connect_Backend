#!/usr/bin/env ts-node
/**
 * Standalone seed runner — delegates to src/seed.ts.
 *
 * Usage:
 *   make seed            # create org (skips if already exists)
 *   make seed-reset      # delete org first, then recreate
 *
 * After running, copy ORKI_ORG_ACCESS_TOKEN from the log into bank-backend/.env
 */

import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.client';
import { redis } from '../src/infrastructure/cache/redis.client';
import { runSeed } from '../src/seed';

async function main() {
  if (process.argv.includes('--reset')) {
    await prisma.organization.deleteMany({ where: { organization_id: 'org_bank_demo' } });
    console.log('[seed] Deleted existing org: org_bank_demo');
  }
  await runSeed();
}

main()
  .catch((e) => { console.error('[seed] Error:', e.message); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
