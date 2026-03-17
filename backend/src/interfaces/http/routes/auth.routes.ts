import { Router } from 'express';
import { postToken } from '../controllers/auth.controller';

const router = Router();
router.post('/token', postToken);
export default router;
