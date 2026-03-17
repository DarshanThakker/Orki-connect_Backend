import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { postOrg, getConfig, patchConfig } from '../controllers/org.controller';

const router = Router();
router.post('/', postOrg);
router.get('/config', authMiddleware, getConfig);
router.patch('/config', authMiddleware, patchConfig);
export default router;
