import { Request, Response, NextFunction } from 'express';
import { createOrg, getOrgConfig, updateOrgConfig } from '../../../application/org/org.service';

export async function postOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const { organization_id, client_id, client_secret, webhook_url, config } = req.body;
    if (!organization_id || !client_id || !client_secret) {
      return res.status(400).json({ error: 'organization_id, client_id, and client_secret are required', code: 'MISSING_ORG_PARAMS' });
    }
    res.status(201).json(await createOrg({ organization_id, client_id, client_secret, webhook_url, config }));
  } catch (err) { next(err); }
}

export async function getConfig(req: any, res: Response, next: NextFunction) {
  try {
    res.json(await getOrgConfig(req.org_id));
  } catch (err) { next(err); }
}

export async function patchConfig(req: any, res: Response, next: NextFunction) {
  try {
    res.json(await updateOrgConfig(req.org_id, req.body));
  } catch (err) { next(err); }
}
