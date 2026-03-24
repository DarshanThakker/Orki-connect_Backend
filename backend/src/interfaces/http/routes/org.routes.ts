import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { postOrg, getConfig, patchConfig, putDepositAddresses } from '../controllers/org.controller';

const router = Router();
router.post('/', postOrg);
router.get('/config', authMiddleware, getConfig);
router.patch('/config', authMiddleware, patchConfig);
router.put('/deposit-addresses', authMiddleware, putDepositAddresses);
export default router;
