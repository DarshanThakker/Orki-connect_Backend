import express from 'express';
const router = express.Router();
import { createSession, getSession, refreshSession } from './service.js';
import { authMiddleware } from '../../middleware/auth.js';
import { sessionAuthMiddleware } from '../../middleware/sessionAuth.js';
import { confirmTransaction } from '../tx-confirmation-service/service.js';
import { getOrgByClientId } from '../org-config-service/service.js';
router.post('/sessions', authMiddleware, async (req, res, next) => {
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
    }
    catch (err) {
        next(err);
    }
});
// ── Public Endpoint for SDK to create sessions directly ───────────────────────
router.post('/public/sessions', async (req, res, next) => {
    try {
        const { client_id, user_id, deposit_address, network, token, mode, kyc_name, connection_type } = req.body;
        if (!client_id || !user_id || !deposit_address || !network || !token) {
            return res.status(400).json({
                error: 'client_id, user_id, deposit_address, network, and token are required',
                code: 'MISSING_REQUIRED_FIELDS',
            });
        }
        const org = await getOrgByClientId(client_id);
        if (!org) {
            return res.status(401).json({ error: 'Invalid client_id', code: 'UNAUTHORIZED' });
        }
        const session = await createSession({
            organization_id: org.organization_id,
            user_id,
            deposit_address,
            network,
            token,
            mode,
            kyc_name,
            connection_type,
        });
        res.status(201).json(session);
    }
    catch (err) {
        next(err);
    }
});
// ── Endpoint to refresh a session ─────────────────────────────────────────────
router.post('/sessions/refresh', async (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({ error: 'refresh_token is required', code: 'MISSING_TOKEN' });
        }
        const refreshed = await refreshSession(refresh_token);
        res.json(refreshed);
    }
    catch (err) {
        next(err);
    }
});
router.get('/sessions/:session_id', authMiddleware, async (req, res, next) => {
    try {
        const session = await getSession(req.params.session_id);
        if (session.organization_id !== req.org_id) {
            return res.status(403).json({ error: 'Forbidden', code: 'SESSION_ACCESS_DENIED' });
        }
        res.json(session);
    }
    catch (err) {
        next(err);
    }
});
router.post('/sessions/:session_id/transactions', sessionAuthMiddleware, async (req, res, next) => {
    try {
        if (req.session_id !== req.params.session_id) {
            return res.status(403).json({ error: 'Session ID mismatch', code: 'SESSION_MISMATCH' });
        }
        const { tx_hash, amount, token, network, user_id, deposit_address } = req.body;
        if (!tx_hash || !amount) {
            return res.status(400).json({ error: 'tx_hash and amount are required', code: 'MISSING_FIELDS' });
        }
        const session = await getSession(req.session_id);
        // Synchronously saves tx_hash + dispatches submitted webhook,
        // then fires blockchain polling as fire-and-forget.
        await confirmTransaction({
            session_id: req.session_id,
            tx_hash,
            amount: String(amount),
            token: token || req.token_name,
            network: network || req.network,
            organization_id: req.organization_id || session.organization_id,
            user_id: user_id || session.user_id,
            deposit_address: deposit_address || session.deposit_address,
        });
        res.status(202).json({ accepted: true, session_id: req.session_id });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map