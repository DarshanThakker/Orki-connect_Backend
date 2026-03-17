import { verifyAccessToken } from '../modules/oauth-token-service/service.js';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required', code: 'MISSING_TOKEN' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.org_id = payload.org_id;
        req.client_id = payload.sub;
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auth.js.map