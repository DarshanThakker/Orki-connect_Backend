import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { createOrg, getOrgConfig, updateOrgConfig } from './service.js';
import { authMiddleware } from '../../middleware/auth.js';

/**
 * POST /v1/org
 * Create a new organization.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { organization_id, client_id, client_secret, webhook_url, config } = req.body;
        if (!organization_id || !client_id || !client_secret) {
            return res.status(400).json({ error: 'organization_id, client_id, and client_secret are required', code: 'MISSING_ORG_PARAMS' });
        }

        const org = await createOrg({ organization_id, client_id, client_secret, webhook_url, config });
        res.status(201).json(org);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /v1/org/config
 * Get configuration for the authenticated organization.
 */
router.get('/config', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
    try {
        const config = await getOrgConfig(req.org_id);
        res.json(config);
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /v1/org/config
 * Update configuration for the authenticated organization.
 */
router.patch('/config', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
    try {
        const config = await updateOrgConfig(req.org_id, req.body);
        res.json(config);
    } catch (err) {
        next(err);
    }
});

export default router;
