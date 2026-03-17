import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getSession } from '../session/session.service';
import { getOrgConfig } from '../org/org.service';
import { signToken } from '../../infrastructure/security/jwt.service';
import {
  findWebhookLog,
  upsertWebhookLog,
  updateWebhookStatus,
  findDeliveryHistory,
} from '../../infrastructure/database/repositories/webhook.repository';

const MAX_RETRY_DURATION_MS = 72 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 300_000;

export async function dispatchWebhookEvent(session_id: string, event_name: string, event_data: any = {}) {
  let session, orgConfig;

  try {
    session = await getSession(session_id);
    orgConfig = await getOrgConfig(session.organization_id);
  } catch (err: any) {
    logger.error('Failed to load session/org for webhook', { session_id, event_name, error: err.message });
    return;
  }

  const webhook_url = orgConfig.webhook_url || config.webhook.defaultUrl;
  if (!webhook_url) {
    logger.warn('No webhook URL configured', { org_id: session.organization_id });
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

  const signature = signWebhookPayload(payload);

  logger.info('Dispatching webhook', { session_id, event: event_name });

  await deliverWithRetry({ payload, signature, webhook_url, idempotency_key, event_name, session_id, org_id: session.organization_id });
}

async function deliverWithRetry(params: {
  payload: any;
  signature: string;
  webhook_url: string;
  idempotency_key: string;
  event_name: string;
  session_id: string;
  org_id: string;
}) {
  const { payload, signature, webhook_url, idempotency_key, event_name, session_id, org_id } = params;
  const startTime = Date.now();
  let attempt = 0;

  const attempt_deliver = async () => {
    attempt++;

    const existing = await findWebhookLog(idempotency_key);
    if (existing?.status === 'delivered') return;

    try {
      const start = Date.now();
      const response = await axios.post(webhook_url, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Orki-Signature': signature, 'X-Orki-Event': event_name, 'X-Idempotency-Key': idempotency_key },
        timeout: 10000,
      });
      const response_time_ms = Date.now() - start;

      await upsertWebhookLog({ idempotency_key, organization_id: org_id, session_id, event: event_name, payload, status: 'delivered', http_status: response.status, response_time_ms, attempt });
      logger.info('Webhook delivered', { event: event_name, attempt, http_status: response.status });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);

      await upsertWebhookLog({ idempotency_key, organization_id: org_id, session_id, event: event_name, payload, status: 'failed', http_status: err.response?.status ?? null, error: err.message, attempt });
      logger.warn('Webhook delivery failed', { event: event_name, attempt, error: err.message });

      if (elapsed + backoff < MAX_RETRY_DURATION_MS) {
        setTimeout(attempt_deliver, backoff);
      } else {
        await updateWebhookStatus(idempotency_key, 'dead_letter');
        logger.error('Webhook dead-lettered — 72h retry window expired', { event: event_name, session_id });
      }
    }
  };

  await attempt_deliver();
}

export function signWebhookPayload(payload: any): string {
  return signToken(payload, { expiresIn: '5m' });
}

export function getJWKS() {
  return {
    keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid: 'orki-webhook-key-1', n: config.jwt.jwksKeyN, e: config.jwt.jwksKeyE }],
  };
}

export async function getDeliveryHistory(org_id: string, limit = 50) {
  return findDeliveryHistory(org_id, limit);
}
