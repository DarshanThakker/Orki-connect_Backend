import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const orgId = "org_123456789";
  const clientId = "client_abc123";
  const clientSecret = "secret_xyz789";
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  const org = await prisma.organization.upsert({
    where: { organization_id: orgId },
    update: {
      webhook_url: "http://localhost:4000/webhook",
    },
    create: {
      organization_id: orgId,
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      webhook_url: "http://localhost:4000/webhook",
      config: {
        supported_tokens: ['USDC', 'USDT'],
        supported_chains: ['ETHEREUM', 'SOLANA', 'POLYGON'],
        connection_methods: ['WALLET', 'EXCHANGE'],
        compliance_mode: 'VALIDATE'
      }
    }
  });

  console.log("Org setup:", org.organization_id);
}
main().catch(console.error).finally(() => prisma.$disconnect());
