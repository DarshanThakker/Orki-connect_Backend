import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { DEFAULT_ORG_CONFIG, OrgConfig } from '../../domain/org/org.entity';
import { redis, TTL } from '../../infrastructure/cache/redis.client';
import {
  findOrgById,
  findOrgByClientId,
  findOrgByCredentials,
  createOrg as dbCreateOrg,
  updateOrgConfig as dbUpdateOrgConfig,
} from '../../infrastructure/database/repositories/org.repository';

export { findOrgByClientId, findOrgByCredentials };

const orgConfigCacheKey = (id: string) => `org:config:${id}`;

export async function getOrgConfig(organization_id: string): Promise<OrgConfig & { webhook_url?: string }> {
  const cacheKey = orgConfigCacheKey(organization_id);
  const cached = await redis.get(cacheKey);
  if (cached) {
    logger.info('Org config cache hit', { organization_id });
    return JSON.parse(cached);
  }

  logger.info('Org config cache miss — loading from DB', { organization_id });
  const org = await findOrgById(organization_id);
  if (!org) {
    logger.warn('Organisation not found', { organization_id });
    throw Object.assign(new Error(`Organisation not found: ${organization_id}`), { status: 404, code: 'ORG_NOT_FOUND' });
  }
  const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  const result = { ...DEFAULT_ORG_CONFIG, ...config, webhook_url: org.webhook_url ?? undefined };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', TTL.ORG_CONFIG);
  logger.info('Org config cached', { organization_id, ttl: TTL.ORG_CONFIG });
  return result;
}

export async function createOrg(params: {
  organization_id: string;
  client_id: string;
  client_secret: string;
  webhook_url?: string;
  config?: Partial<OrgConfig>;
}) {
  const { config = {}, ...rest } = params;
  const org = await dbCreateOrg({ ...rest, config: { ...DEFAULT_ORG_CONFIG, ...config } });
  logger.info('Organisation created', { organization_id: params.organization_id });
  return org;
}

export async function updateDepositAddresses(organization_id: string, addresses: Partial<Record<string, string>>) {
  const org = await findOrgById(organization_id);
  if (!org) throw Object.assign(new Error('Organisation not found'), { status: 404 });

  const current = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  const updated = await dbUpdateOrgConfig(organization_id, { ...current, deposit_addresses: { ...current.deposit_addresses, ...addresses } });
  await redis.del(orgConfigCacheKey(organization_id));
  logger.info('Org deposit addresses updated', { organization_id, chains: Object.keys(addresses) });
  return (updated.config as any).deposit_addresses;
}

export async function updateOrgConfig(organization_id: string, updates: Partial<OrgConfig>) {
  const org = await findOrgById(organization_id);
  if (!org) throw Object.assign(new Error('Organisation not found'), { status: 404 });

  validateConfigUpdate(updates);

  const current = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  const updated = await dbUpdateOrgConfig(organization_id, { ...current, ...updates });
  await redis.del(orgConfigCacheKey(organization_id));
  logger.info('Org config updated', { organization_id, fields: Object.keys(updates) });
  return updated.config;
}

function validateConfigUpdate(updates: Partial<OrgConfig>) {
  if (updates.supported_tokens) {
    const invalid = updates.supported_tokens.filter((t) => !['USDC', 'USDT'].includes(t));
    if (invalid.length) {
      logger.warn('Config validation failed: unsupported tokens', { invalid_tokens: invalid });
      throw new Error(`Unsupported tokens: ${invalid.join(', ')}`);
    }
  }
  if (updates.supported_chains) {
    const valid = Object.values(Chain);
    const invalid = updates.supported_chains.filter((c) => !valid.includes(c));
    if (invalid.length) {
      logger.warn('Config validation failed: unsupported chains', { invalid_chains: invalid });
      throw new Error(`Unsupported chains: ${invalid.join(', ')}`);
    }
  }
  if (updates.compliance_mode && !Object.values(ComplianceMode).includes(updates.compliance_mode)) {
    logger.warn('Config validation failed: invalid compliance_mode', { compliance_mode: updates.compliance_mode });
    throw new Error(`compliance_mode must be one of: ${Object.values(ComplianceMode).join(', ')}`);
  }
  if (updates.connection_methods) {
    const valid = Object.values(ConnectionType);
    const invalid = updates.connection_methods.filter((m) => !valid.includes(m));
    if (invalid.length) {
      logger.warn('Config validation failed: invalid connection methods', { invalid_methods: invalid });
      throw new Error(`Invalid connection methods: ${invalid.join(', ')}`);
    }
  }
  if (updates.min_per_transaction !== undefined && updates.min_per_transaction < 0) {
    logger.warn('Config validation failed: negative min_per_transaction', { min_per_transaction: updates.min_per_transaction });
    throw new Error('min_per_transaction must be >= 0');
  }
  if (updates.max_per_transaction !== undefined && updates.min_per_transaction !== undefined) {
    if (updates.max_per_transaction <= updates.min_per_transaction) {
      logger.warn('Config validation failed: max <= min', { min: updates.min_per_transaction, max: updates.max_per_transaction });
      throw new Error('max_per_transaction must be greater than min_per_transaction');
    }
  }
}
