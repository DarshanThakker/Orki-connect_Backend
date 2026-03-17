import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { findOrgByCredentials } from '../../infrastructure/database/repositories/org.repository';
import { signToken, verifyApiToken } from '../../infrastructure/security/jwt.service';

const TOKEN_EXPIRY = 60 * 60 * 24 * 90; // 90 days — org tokens are server-to-server, long-lived

export async function issueAccessToken(client_id: string, client_secret: string) {
  const org = await findOrgByCredentials(client_id, client_secret);
  if (!org) {
    throw Object.assign(new Error('Invalid client credentials'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const access_token = signToken(
    { sub: client_id, org_id: org.organization_id, scope: 'connect:write connect:read', jti: uuidv4() },
    { expiresIn: TOKEN_EXPIRY, audience: 'orki-api' }
  );

  logger.info('Access token issued', { org_id: org.organization_id, client_id });
  return { access_token, expires_in: TOKEN_EXPIRY, token_type: 'Bearer' };
}

export function verifyAccessToken(token: string) {
  try {
    return verifyApiToken(token);
  } catch {
    throw Object.assign(new Error('Invalid or expired access token'), { status: 401, code: 'TOKEN_INVALID' });
  }
}
