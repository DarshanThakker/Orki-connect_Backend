import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { sessionAuthMiddleware } from '../middleware/session-auth.middleware';
import { postSession, postPublicSession, postRefreshSession, getSessionById, postTransaction } from '../controllers/session.controller';

const router = Router();
router.post('/sessions', authMiddleware, postSession);
router.post('/public/sessions', postPublicSession);
router.post('/sessions/refresh', postRefreshSession);
router.get('/sessions/:session_id', authMiddleware, getSessionById);
router.post('/sessions/:session_id/transactions', sessionAuthMiddleware, postTransaction);
export default router;
