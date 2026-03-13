import express from 'express';
export const router = express.Router();
import { getJWKS, getDeliveryHistory } from './service.js';
import { authMiddleware } from '../../middleware/auth.js';
/**
 * GET /v1/webhooks/.well-known/jwks.json
 * Public JWKS endpoint — clients use this to verify webhook signatures.
 * Provided to clients at onboarding.
 */
router.get('/.well-known/jwks.json', (req, res) => {
    res.json(getJWKS());
});
/**
 * GET /v1/webhooks/delivery-log
 * Returns webhook delivery history for the client dashboard.
 */
router.get('/delivery-log', authMiddleware, async (req, res) => {
    const history = await getDeliveryHistory({ org_id: req.org_id, limit: 100 });
    res.json({ events: history, count: history.length });
});
export default router;
//# sourceMappingURL=routes.js.map