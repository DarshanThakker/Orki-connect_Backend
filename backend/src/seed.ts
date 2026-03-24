import { Chain, ConnectionType, ComplianceMode } from '@prisma/client';
import { createOrg, findOrgByClientId, updateWebhookUrl } from './application/org/org.service';
import { issueAccessToken } from './application/auth/auth.service';
import { logger } from './utils/logger';

const SEED_ORG = {
  organization_id: 'org_bank_demo',
  client_id:       'bank_demo_client',
  client_secret:   'bank_demo_secret_dev',
  webhook_url:     'http://localhost:5000/webhook',
  config: {
    supported_tokens:    ['USDC', 'USDT'],
    supported_chains:    [Chain.SOLANA, Chain.ETHEREUM],
    compliance_mode:     ComplianceMode.LITE,
    connection_methods:  [ConnectionType.WALLET],
    min_per_transaction: 1,
    max_per_transaction: 10000,
    daily_user_limit:    50000,
    kyc_required:        false,
  },
};

export async function runSeed() {
  const existing = await findOrgByClientId(SEED_ORG.client_id);

  if (existing) {
    logger.info('Seed org already exists — skipping creation', { organization_id: SEED_ORG.organization_id });
    await updateWebhookUrl(SEED_ORG.organization_id, SEED_ORG.webhook_url);
  } else {
    await createOrg(SEED_ORG);
    logger.info('Seed org created', { organization_id: SEED_ORG.organization_id });
  }

  const { access_token, expires_in } = await issueAccessToken(SEED_ORG.client_id, SEED_ORG.client_secret);
  logger.info('Seed org access token ready', {
    organization_id: SEED_ORG.organization_id,
    client_id: SEED_ORG.client_id,
    expires_in,
    hint: 'Copy access_token to bank-backend ORKI_ORG_ACCESS_TOKEN',
    access_token,
  });
}
