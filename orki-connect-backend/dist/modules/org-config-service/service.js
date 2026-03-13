import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';
// ─── Default Config ───────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
    supported_tokens: ['USDC'],
    supported_chains: [Chain.ETHEREUM],
    connection_methods: [ConnectionType.WALLET],
    compliance_mode: ComplianceMode.LITE,
    min_per_transaction: 10, // USD
    max_per_transaction: 50000, // USD
    daily_user_limit: 100000, // USD
    session_timeout_minutes: 30,
};
/**
 * Retrieves org record by client credentials.
 * Called by the OAuth Token Service to validate client_id + client_secret.
 */
export async function getOrgByCredentials(client_id, client_secret) {
    // In production: Use secure hash comparison. For this refactor, we match direct string (as per original logic but moving to DB)
    return prisma.organization.findFirst({
        where: {
            client_id,
            client_secret_hash: client_secret, // Should be hashed in production
        },
    });
}
/**
 * Retrieves the full config for an organisation.
 */
export async function getOrgConfig(organization_id) {
    const org = await prisma.organization.findUnique({
        where: { organization_id },
    });
    if (!org) {
        const err = new Error(`Organisation not found: ${organization_id}`);
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
export async function createOrg(params) {
    const { organization_id, client_id, client_secret, webhook_url, config = {} } = params;
    const org = await prisma.organization.create({
        data: {
            organization_id,
            client_id,
            client_secret_hash: client_secret, // Hash this in production!
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
export async function updateOrgConfig(organization_id, updates) {
    const org = await prisma.organization.findUnique({
        where: { organization_id },
    });
    if (!org) {
        const err = new Error('Organisation not found');
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
function validateConfigUpdate(updates) {
    const VALID_TOKENS = ['USDC', 'USDT'];
    const VALID_CHAINS = Object.values(Chain);
    const VALID_MODES = Object.values(ComplianceMode);
    const VALID_METHODS = Object.values(ConnectionType);
    if (updates.supported_tokens) {
        const invalid = updates.supported_tokens.filter((t) => !VALID_TOKENS.includes(t));
        if (invalid.length)
            throw new Error(`Unsupported tokens: ${invalid.join(', ')}`);
    }
    if (updates.supported_chains) {
        const invalid = updates.supported_chains.filter((c) => !VALID_CHAINS.includes(c));
        if (invalid.length)
            throw new Error(`Unsupported chains: ${invalid.join(', ')}`);
    }
    if (updates.compliance_mode && !VALID_MODES.includes(updates.compliance_mode)) {
        throw new Error(`compliance_mode must be one of: ${VALID_MODES.join(', ')}`);
    }
    if (updates.connection_methods) {
        const invalid = updates.connection_methods.filter((m) => !VALID_METHODS.includes(m));
        if (invalid.length)
            throw new Error(`Invalid connection methods: ${invalid.join(', ')}`);
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
//# sourceMappingURL=service.js.map