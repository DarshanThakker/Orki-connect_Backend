import { Response, NextFunction } from 'express';
import { verifySessionToken } from '../../../infrastructure/security/jwt.service';

export function sessionAuthMiddleware(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session authorization required', code: 'MISSING_SESSION_TOKEN' });
  }

  try {
    const payload = verifySessionToken(authHeader.slice(7)) as any;
    req.session_id = payload.session_id;
    req.organization_id = payload.organization_id;
    req.network = payload.network;
    req.token_name = payload.token;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired session token', code: 'INVALID_SESSION_TOKEN', detail: err.message });
  }
}
