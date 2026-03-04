import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { createSession, getSession } from './service.js';
import { authMiddleware } from '../../middleware/auth.js';

router.post('/sessions', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { user_id, deposit_address, network, token, mode, kyc_name, connection_type } = req.body;

    if (!user_id || !deposit_address || !network || !token) {
      return res.status(400).json({
        error: 'user_id, deposit_address, network, and token are required',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const session = await createSession({
      organization_id: req.org_id,
      user_id,
      deposit_address,
      network,
      token,
      mode,
      kyc_name,
      connection_type,
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:session_id', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const session = await getSession(req.params.session_id);

    if (session.organization_id !== req.org_id) {
      return res.status(403).json({ error: 'Forbidden', code: 'SESSION_ACCESS_DENIED' });
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

export default router;
