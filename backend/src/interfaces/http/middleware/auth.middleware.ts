import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../../application/auth/auth.service';

export function authMiddleware(req: any, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(Object.assign(new Error('Authorization header required'), { status: 401, code: 'MISSING_TOKEN' }));
  }
  try {
    const payload = verifyAccessToken(authHeader.slice(7)) as any;
    req.org_id = payload.org_id;
    req.client_id = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
