import { Router, Request, Response } from 'express';
import { getBalance, getAllBalances, getTransactions } from '../services/balance.js';

const router = Router();

// GET /api/balance/:userId
router.get('/:userId', (req: Request, res: Response) => {
  const balance = getBalance(req.params.userId!);
  if (!balance) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(balance);
});

// GET /api/balance/:userId/transactions
router.get('/:userId/transactions', (req: Request, res: Response) => {
  const txs = getTransactions(req.params.userId!);
  res.json(txs);
});

// GET /api/balance  — list all users (admin/demo)
router.get('/', (_req: Request, res: Response) => {
  res.json(getAllBalances());
});

export default router;
