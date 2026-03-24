import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// POST /api/session — creates an Orki Connect session on behalf of the bank app
// Deposit address is inferred by Orki backend from the org's registered deposit addresses
router.post('/', async (req: Request, res: Response) => {
  const { user_id, network = 'SOLANA', token = 'USDC' } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  const response = await fetch(`${config.ORKI_BACKEND_URL}/v1/connect/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ORKI_ORG_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ user_id, network, token }),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    res.status(response.status).json({ error: data.error ?? 'Failed to create session' });
    return;
  }

  res.status(201).json(data); // { session_id, session_jwt, expires_at, deposit_address }
});

export default router;
