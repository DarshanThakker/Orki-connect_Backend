import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function sessionAuthMiddleware(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session authorization required', code: 'MISSING_SESSION_TOKEN' });
  }

  const token = authHeader.slice(7);
  const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (!publicKey) {
    return res.status(500).json({ error: 'JWT_PUBLIC_KEY not configured' });
  }

  try {
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: 'orki-connect' }) as any;
    req.session_id = payload.session_id;
    req.organization_id = payload.organization_id;
    req.network = payload.network;
    req.token_name = payload.token;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired session token', code: 'INVALID_SESSION_TOKEN', detail: err.message });
  }
}
