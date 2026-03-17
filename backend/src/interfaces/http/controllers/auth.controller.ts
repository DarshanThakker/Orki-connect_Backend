import { Request, Response, NextFunction } from 'express';
import { issueAccessToken } from '../../../application/auth/auth.service';

export async function postToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { client_id, client_secret, grant_type } = req.body;
    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'client_id and client_secret are required', code: 'MISSING_CREDENTIALS' });
    }
    if (grant_type !== 'client_credentials') {
      return res.status(400).json({ error: 'Only client_credentials grant type is supported', code: 'UNSUPPORTED_GRANT_TYPE' });
    }
    res.json(await issueAccessToken(client_id, client_secret));
  } catch (err) { next(err); }
}
