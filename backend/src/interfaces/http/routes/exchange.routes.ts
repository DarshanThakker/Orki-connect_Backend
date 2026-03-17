import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getAuthorize, getCallback, postWithdraw } from '../controllers/exchange.controller';

const router = Router();
router.get('/authorize', getAuthorize);
router.get('/callback', getCallback);
router.post('/withdraw', authMiddleware, postWithdraw);
export default router;
