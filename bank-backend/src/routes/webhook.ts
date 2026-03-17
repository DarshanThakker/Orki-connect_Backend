import { Router, Request, Response } from 'express';
import { verifyWebhook, CREDITABLE_EVENTS } from '../middleware/verifyWebhook.js';
import { creditUser } from '../services/balance.js';
import { WebhookPayload } from '../types.js';

const router = Router();

router.post('/', verifyWebhook, (req: Request, res: Response) => {
  const payload: WebhookPayload = (req as any).orkiPayload;

  console.log(`[webhook] event=${payload.event} user=${payload.user_id} key=${payload.idempotency_key}`);

  if (CREDITABLE_EVENTS.has(payload.event)) {
    const { credited, balance } = creditUser(payload);

    if (credited) {
      console.log(
        `[webhook] credited user=${payload.user_id} +${payload.amount} ${payload.token} → balances:`,
        balance.balances,
      );
    } else {
      console.log(`[webhook] skipped (duplicate or zero amount) key=${payload.idempotency_key}`);
    }
  } else {
    console.log(`[webhook] no-op for event=${payload.event}`);
  }

  // Orki expects a 2xx within 10 seconds
  res.status(200).json({ received: true });
});

export default router;
