import jwt from 'jsonwebtoken';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { getSession } from '../session-service/service.js';
import { getOrgConfig } from '../org-config-service/service.js';
import { prisma } from '../../lib/prisma.js';
// ─── Retry Configuration ──────────────────────────────────────────────────────
const MAX_RETRY_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours
const BASE_BACKOFF_MS = 1000; // 1 second initial
const MAX_BACKOFF_MS = 300000; // 5 minutes max backoff
/**
 * Main dispatch function. Called by ALL other services when an event occurs.
 */
export async function dispatchWebhookEvent(session_id, event_name, event_data = {}) {
    let session, orgConfig;
    try {
        session = await getSession(session_id);
        orgConfig = await getOrgConfig(session.organization_id);
    }
    catch (err) {
        logger.error('Failed to load session/org for webhook dispatch', { session_id, event_name, error: err.message });
        return;
    }
    const idempotency_key = `idem_${uuidv4().replace(/-/g, '')}`;
    const payload = {
        organization_id: session.organization_id,
        user_id: session.user_id,
        session_id,
        event: event_name,
        idempotency_key,
        timestamp: new Date().toISOString(),
        deposit_address: session.deposit_address,
        network: session.network,
        token: session.token,
        mode: session.mode,
        ...event_data,
    };
    const signedPayload = signWebhookPayload(payload);
    const webhook_url = orgConfig.webhook_url || process.env.DEFAULT_WEBHOOK_URL;
    if (!webhook_url) {
        logger.warn('No webhook URL configured for org', { org_id: session.organization_id });
        return;
    }
    logger.info('Dispatching webhook event', { session_id, event: event_name, org_id: session.organization_id });
    await deliverWithRetry({ payload, signedPayload, webhook_url, idempotency_key, event_name, session_id, org_id: session.organization_id });
}
/**
 * Delivers a webhook with exponential backoff retry.
 */
async function deliverWithRetry(params) {
    const { payload, signedPayload, webhook_url, idempotency_key, event_name, session_id, org_id } = params;
    const startTime = Date.now();
    let attempt = 0;
    const attempt_deliver = async () => {
        attempt++;
        // ── Idempotency check ─────────────────────────────────────────────────
        const existingLog = await prisma.webhookLog.findUnique({
            where: { idempotency_key },
        });
        if (existingLog && existingLog.status === 'delivered') {
            logger.debug('Skipping duplicate webhook delivery', { idempotency_key, event_name });
            return;
        }
        try {
            const start = Date.now();
            const response = await axios.post(webhook_url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Orki-Signature': signedPayload,
                    'X-Orki-Event': event_name,
                    'X-Idempotency-Key': idempotency_key,
                },
                timeout: 10000,
            });
            const response_time_ms = Date.now() - start;
            await prisma.webhookLog.upsert({
                where: { idempotency_key },
                update: {
                    status: 'delivered',
                    http_status: response.status,
                    response_time_ms,
                    attempt,
                },
                create: {
                    organization_id: org_id,
                    session_id,
                    event: event_name,
                    idempotency_key,
                    payload,
                    status: 'delivered',
                    http_status: response.status,
                    response_time_ms,
                    attempt,
                },
            });
            logger.info('Webhook delivered', { event: event_name, session_id, attempt, http_status: response.status, response_time_ms });
        }
        catch (err) {
            const elapsed = Date.now() - startTime;
            const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
            await prisma.webhookLog.upsert({
                where: { idempotency_key },
                update: {
                    status: 'failed',
                    http_status: err.response?.status || null,
                    error: err.message,
                    attempt,
                },
                create: {
                    organization_id: org_id,
                    session_id,
                    event: event_name,
                    idempotency_key,
                    payload,
                    status: 'failed',
                    http_status: err.response?.status || null,
                    error: err.message,
                    attempt,
                },
            });
            logger.warn('Webhook delivery failed', {
                event: event_name, session_id, attempt, error: err.message,
                next_retry_ms: backoff, elapsed_ms: elapsed,
            });
            if (elapsed + backoff < MAX_RETRY_DURATION_MS) {
                setTimeout(attempt_deliver, backoff);
            }
            else {
                await prisma.webhookLog.update({
                    where: { idempotency_key },
                    data: { status: 'dead_letter' },
                });
                logger.error('Webhook moved to dead letter — 72hr retry window expired', { event: event_name, session_id });
            }
        }
    };
    await attempt_deliver();
}
/**
 * Signs the webhook payload as an RS256 JWT.
 */
export function signWebhookPayload(payload) {
    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey)
        throw new Error('JWT_PRIVATE_KEY not configured');
    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        issuer: 'orki-connect',
        expiresIn: '5m',
    });
}
/**
 * Exposes JWKS endpoint for client-side webhook signature verification.
 */
export function getJWKS() {
    return {
        keys: [
            {
                kty: 'RSA',
                use: 'sig',
                alg: 'RS256',
                kid: 'orki-webhook-key-1',
                n: process.env.JWKS_PUBLIC_KEY_N || 'PLACEHOLDER',
                e: 'AQAB',
            },
        ],
    };
}
/**
 * Returns delivery history for the client dashboard.
 */
export async function getDeliveryHistory(params) {
    const { org_id, limit = 50 } = params;
    return prisma.webhookLog.findMany({
        where: { organization_id: org_id },
        take: limit,
        orderBy: { created_at: 'desc' },
    });
}
//# sourceMappingURL=service.js.map