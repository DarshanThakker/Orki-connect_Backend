import { prisma } from '../prisma.client';

export async function findWebhookLog(idempotency_key: string) {
  return prisma.webhookLog.findUnique({ where: { idempotency_key } });
}

export async function upsertWebhookLog(params: {
  idempotency_key: string;
  organization_id: string;
  session_id: string;
  event: string;
  payload: any;
  status: string;
  http_status?: number | null;
  response_time_ms?: number;
  error?: string | null;
  attempt: number;
}) {
  const { idempotency_key, ...data } = params;
  return prisma.webhookLog.upsert({
    where: { idempotency_key },
    update: { status: data.status, http_status: data.http_status ?? null, response_time_ms: data.response_time_ms ?? null, error: data.error ?? null, attempt: data.attempt },
    create: { idempotency_key, ...data },
  });
}

export async function updateWebhookStatus(idempotency_key: string, status: string) {
  return prisma.webhookLog.update({ where: { idempotency_key }, data: { status } });
}

export async function findDeliveryHistory(organization_id: string, limit = 50) {
  return prisma.webhookLog.findMany({
    where: { organization_id },
    take: limit,
    orderBy: { created_at: 'desc' },
  });
}
