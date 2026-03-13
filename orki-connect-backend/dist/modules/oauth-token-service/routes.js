import express from 'express';
const router = express.Router();
import { issueAccessToken } from './service.js';
router.post('/token', async (req, res, next) => {
    try {
        const { client_id, client_secret, grant_type } = req.body;
        if (!client_id || !client_secret) {
            return res.status(400).json({ error: 'client_id and client_secret are required', code: 'MISSING_CREDENTIALS' });
        }
        if (grant_type !== 'client_credentials') {
            return res.status(400).json({ error: 'Only client_credentials grant type is supported', code: 'UNSUPPORTED_GRANT_TYPE' });
        }
        const token = await issueAccessToken(client_id, client_secret);
        res.json(token);
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map