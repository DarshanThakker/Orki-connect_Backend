import { Organization, Chain, ComplianceMode, ConnectionType } from '@prisma/client';
import bcrypt from 'bcrypt';

import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';

// ─── Default Config ───────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  supported_tokens: ['USDC'],
  supported_chains: [Chain.ETHEREUM],
  connection_methods: [ConnectionType.WALLET],
  compliance_mode: ComplianceMode.LITE,
  min_per_transaction: 10,    // USD
  max_per_transaction: 50000, // USD
  daily_user_limit: 100000,   // USD
  session_timeout_minutes: 30,
};

/**
 * Retrieves org record by client credentials.
 * Called by the OAuth Token Service to validate client_id + client_secret.
 */
export async function getOrgByCredentials(client_id: string, client_secret: string): Promise<Organization | null> {
  const org = await prisma.organization.findUnique({
    where: { client_id },
  });

  if (!org) return null;

  const isMatch = await bcrypt.compare(client_secret, org.client_secret_hash);
  return isMatch ? org : null;
}

/**
 * Retrieves org record by client_id only (public endpoint usage).
 */
export async function getOrgByClientId(client_id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({
    where: { client_id },
  });
}

/**
 * Retrieves the full config for an organisation.
 */
export async function getOrgConfig(organization_id: string) {
  const org = await prisma.organization.findUnique({
    where: { organization_id },
  });

  if (!org) {
    const err: any = new Error(`Organisation not found: ${organization_id}`);
    err.status = 404;
    err.code = 'ORG_NOT_FOUND';
    throw err;
  }

  const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * Creates a new organisation. Called during Orki onboarding.
 */
export async function createOrg(params: {
  organization_id: string;
  client_id: string;
  client_secret: string;
  webhook_url?: string;
  config?: any;
}) {
  const { organization_id, client_id, client_secret, webhook_url, config = {} } = params;

  // Hash the client secret for production security
  const saltRounds = 10;
  const client_secret_hash = await bcrypt.hash(client_secret, saltRounds);

  const org = await prisma.organization.create({
    data: {
      organization_id,
      client_id,
      client_secret_hash,
      webhook_url: webhook_url || null,
      config: { ...DEFAULT_CONFIG, ...config },
    },
  });

  logger.info('Organisation created', { organization_id });
  return org;
}

/**
 * Updates org config fields. Validates all values before saving.
 */
export async function updateOrgConfig(organization_id: string, updates: any) {
  const org = await prisma.organization.findUnique({
    where: { organization_id },
  });

  if (!org) {
    const err: any = new Error('Organisation not found');
    err.status = 404;
    throw err;
  }

  validateConfigUpdate(updates);

  const currentConfig = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  const newConfig = { ...currentConfig, ...updates };

  const updatedOrg = await prisma.organization.update({
    where: { organization_id },
    data: { config: newConfig },
  });

  logger.info('Org config updated', { organization_id, updated_fields: Object.keys(updates) });
  return updatedOrg.config;
}

/**
 * Validates a config update object before applying.
 */
function validateConfigUpdate(updates: any) {
  const VALID_TOKENS = ['USDC', 'USDT'];
  const VALID_CHAINS = Object.values(Chain);
  const VALID_MODES = Object.values(ComplianceMode);
  const VALID_METHODS = Object.values(ConnectionType);

  if (updates.supported_tokens) {
    const invalid = updates.supported_tokens.filter((t: string) => !VALID_TOKENS.includes(t));
    if (invalid.length) throw new Error(`Unsupported tokens: ${invalid.join(', ')}`);
  }

  if (updates.supported_chains) {
    const invalid = updates.supported_chains.filter((c: Chain) => !VALID_CHAINS.includes(c));
    if (invalid.length) throw new Error(`Unsupported chains: ${invalid.join(', ')}`);
  }

  if (updates.compliance_mode && !VALID_MODES.includes(updates.compliance_mode)) {
    throw new Error(`compliance_mode must be one of: ${VALID_MODES.join(', ')}`);
  }

  if (updates.connection_methods) {
    const invalid = updates.connection_methods.filter((m: ConnectionType) => !VALID_METHODS.includes(m));
    if (invalid.length) throw new Error(`Invalid connection methods: ${invalid.join(', ')}`);
  }

  if (updates.min_per_transaction !== undefined && updates.min_per_transaction < 0) {
    throw new Error('min_per_transaction must be >= 0');
  }

  if (updates.max_per_transaction !== undefined && updates.min_per_transaction !== undefined) {
    if (updates.max_per_transaction <= updates.min_per_transaction) {
      throw new Error('max_per_transaction must be greater than min_per_transaction');
    }
  }
}
