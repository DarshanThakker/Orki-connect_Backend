import { Request, Response } from 'express';
import { getJWKS, getDeliveryHistory } from '../../../application/webhook/webhook.service';

export function getJwks(_req: Request, res: Response) {
  res.json(getJWKS());
}

export async function getDeliveryLog(req: any, res: Response) {
  const history = await getDeliveryHistory(req.org_id, 100);
  res.json({ events: history, count: history.length });
}
