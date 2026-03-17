import { Router, Request, Response } from 'express';

const router = Router();

const ORKI_BACKEND_URL = process.env.ORKI_BACKEND_URL ?? 'http://localhost:3000';
const ORKI_ORG_ACCESS_TOKEN = process.env.ORKI_ORG_ACCESS_TOKEN ?? '';

// POST /api/session — creates an Orki Connect session on behalf of the bank app
router.post('/', async (req: Request, res: Response) => {
  const { user_id, deposit_address, network = 'SOLANA', token = 'USDC', mode = 'MONITOR' } = req.body;

  if (!user_id || !deposit_address) {
    res.status(400).json({ error: 'user_id and deposit_address are required' });
    return;
  }

  const response = await fetch(`${ORKI_BACKEND_URL}/v1/connect/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ORKI_ORG_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ user_id, deposit_address, network, token, mode }),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    res.status(response.status).json({ error: data.error ?? 'Failed to create session' });
    return;
  }

  res.status(201).json(data); // { session_id, session_jwt, expires_at }
});

export default router;
