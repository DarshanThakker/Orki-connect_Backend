import { Request, Response, NextFunction } from 'express';
import { createSession, getSession, refreshSession } from '../../../application/session/session.service';
import { confirmTransaction } from '../../../application/transaction/transaction.service';
import { findOrgByClientId } from '../../../application/org/org.service';

export async function postSession(req: any, res: Response, next: NextFunction) {
  try {
    const { user_id, network, token, mode, kyc_name, connection_type } = req.body;
    if (!user_id || !network || !token) {
      return res.status(400).json({ error: 'user_id, network, and token are required', code: 'MISSING_REQUIRED_FIELDS' });
    }
    res.status(201).json(await createSession({ organization_id: req.org_id, user_id, network, token, mode, kyc_name, connection_type }));
  } catch (err) { next(err); }
}

export async function postPublicSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { client_id, user_id, network, token, mode, kyc_name, connection_type } = req.body;
    if (!client_id || !user_id || !network || !token) {
      return res.status(400).json({ error: 'client_id, user_id, network, and token are required', code: 'MISSING_REQUIRED_FIELDS' });
    }
    const org = await findOrgByClientId(client_id);
    if (!org) return res.status(401).json({ error: 'Invalid client_id', code: 'UNAUTHORIZED' });
    res.status(201).json(await createSession({ organization_id: org.organization_id, user_id, network, token, mode, kyc_name, connection_type }));
  } catch (err) { next(err); }
}

export async function postRefreshSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token is required', code: 'MISSING_TOKEN' });
    res.json(await refreshSession(refresh_token));
  } catch (err) { next(err); }
}

export async function getSessionById(req: any, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req.params['session_id']);
    if (session.organization_id !== req.org_id) return res.status(403).json({ error: 'Forbidden', code: 'SESSION_ACCESS_DENIED' });
    res.json(session);
  } catch (err) { next(err); }
}

export async function postTransaction(req: any, res: Response, next: NextFunction) {
  try {
    if (req.session_id !== req.params['session_id']) {
      return res.status(403).json({ error: 'Session ID mismatch', code: 'SESSION_MISMATCH' });
    }
    const { tx_hash, amount, token, network, user_id, deposit_address } = req.body;
    if (!tx_hash || !amount) return res.status(400).json({ error: 'tx_hash and amount are required', code: 'MISSING_FIELDS' });

    const session = await getSession(req.session_id);
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
  } catch (err) { next(err); }
}
