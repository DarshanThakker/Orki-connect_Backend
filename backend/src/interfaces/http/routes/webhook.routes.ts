import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getJwks, getDeliveryLog } from '../controllers/webhook.controller';

const router = Router();
router.get('/.well-known/jwks.json', getJwks);
router.get('/delivery-log', authMiddleware, getDeliveryLog);
export default router;
