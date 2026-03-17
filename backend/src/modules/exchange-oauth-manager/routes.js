import express from 'express';
const router = express.Router();
import { getAuthorizationUrl, handleOAuthCallback, initiateExchangeWithdrawal } from './service.js';
import { authMiddleware } from '../../middleware/auth.js';
/**
 * GET /v1/connect/oauth/authorize
 * Redirects user to exchange OAuth page.
 */
router.get('/authorize', async (req, res, next) => {
    try {
        const { exchange, session_id } = req.query;
        if (!exchange || !session_id) {
            return res.status(400).json({ error: 'exchange and session_id are required', code: 'MISSING_PARAMS' });
        }
        const url = getAuthorizationUrl(exchange, session_id);
        res.redirect(url);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /v1/connect/oauth/callback
 * Handle exchange OAuth callback.
 */
router.get('/callback', async (req, res, next) => {
    try {
        const { exchange, state: session_id, code: authorization_code } = req.query;
        if (!exchange || !session_id || !authorization_code) {
            return res.status(400).json({ error: 'exchange, state (session_id), and code are required', code: 'MISSING_CALLBACK_PARAMS' });
        }
        const result = await handleOAuthCallback({
            exchange: exchange,
            session_id: session_id,
            authorization_code: authorization_code,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /v1/connect/oauth/withdraw
 * Initiate withdrawal from exchange.
 */
router.post('/withdraw', authMiddleware, async (req, res, next) => {
    try {
        const { session_id, amount, token } = req.body;
        if (!session_id || !amount || !token) {
            return res.status(400).json({ error: 'session_id, amount, and token are required', code: 'MISSING_WITHDRAW_PARAMS' });
        }
        const result = await initiateExchangeWithdrawal({ session_id, amount, token });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=routes.js.map