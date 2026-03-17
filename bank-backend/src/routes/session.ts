import { Router, Request, Response } from 'express';

const router = Router();

// POST /api/session — creates an Orki Connect session on behalf of the bank app
router.post('/', async (req: Request, res: Response) => {
  // Read env at request time — module-level constants capture before dotenv runs in ESM
  const ORKI_BACKEND_URL = process.env.ORKI_BACKEND_URL ?? 'http://localhost:3000';
  const ORKI_ORG_ACCESS_TOKEN = process.env.ORKI_ORG_ACCESS_TOKEN ?? '';
  const ORKI_SOLANA_DEPOSIT_ADDRESS = process.env.ORKI_SOLANA_DEPOSIT_ADDRESS ?? '';
  const ORKI_EVM_DEPOSIT_ADDRESS = process.env.ORKI_EVM_DEPOSIT_ADDRESS;

  const { user_id, network = 'SOLANA', token = 'USDC' } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  const response = await fetch(`${ORKI_BACKEND_URL}/v1/connect/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ORKI_ORG_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      user_id,
      deposit_address: ORKI_SOLANA_DEPOSIT_ADDRESS,
      ...(ORKI_EVM_DEPOSIT_ADDRESS && { evm_deposit_address: ORKI_EVM_DEPOSIT_ADDRESS }),
      network,
      token,
    }),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    res.status(response.status).json({ error: data.error ?? 'Failed to create session' });
    return;
  }

  res.status(201).json(data); // { session_id, session_jwt, expires_at, deposit_address, evm_deposit_address? }
});

export default router;
