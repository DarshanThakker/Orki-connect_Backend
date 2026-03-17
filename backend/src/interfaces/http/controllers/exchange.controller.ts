import { Request, Response, NextFunction } from 'express';
import { getAuthorizationUrl, handleOAuthCallback, initiateExchangeWithdrawal } from '../../../application/exchange/exchange.service';

export async function getAuthorize(req: Request, res: Response, next: NextFunction) {
  try {
    const { exchange, session_id } = req.query;
    if (!exchange || !session_id) return res.status(400).json({ error: 'exchange and session_id are required', code: 'MISSING_PARAMS' });
    res.redirect(getAuthorizationUrl(exchange as string, session_id as string));
  } catch (err) { next(err); }
}

export async function getCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { exchange, state: session_id, code: authorization_code } = req.query;
    if (!exchange || !session_id || !authorization_code) {
      return res.status(400).json({ error: 'exchange, state, and code are required', code: 'MISSING_CALLBACK_PARAMS' });
    }
    res.json(await handleOAuthCallback({ exchange: exchange as string, session_id: session_id as string, authorization_code: authorization_code as string }));
  } catch (err) { next(err); }
}

export async function postWithdraw(req: any, res: Response, next: NextFunction) {
  try {
    const { session_id, amount, token } = req.body;
    if (!session_id || !amount || !token) return res.status(400).json({ error: 'session_id, amount, and token are required', code: 'MISSING_WITHDRAW_PARAMS' });
    res.json(await initiateExchangeWithdrawal({ session_id, amount, token }));
  } catch (err) { next(err); }
}
