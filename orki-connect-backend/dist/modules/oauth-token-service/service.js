/**
 * MODULE 01 — OAuth Token Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Issues and validates JWT access tokens for client backends.
 * Uses RS256 (asymmetric) — private key for signing, public JWKS for verification.
 *
 * Risk: LOW | Dependencies: None — build first
 * ─────────────────────────────────────────────────────────────────────────────
 */
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { getOrgByCredentials } from '../org-config-service/service.js';
const TOKEN_EXPIRY = 3600; // 1 hour
/**
 * Issues a JWT access token for a valid client_id + client_secret pair.
 */
export async function issueAccessToken(client_id, client_secret) {
    const org = await getOrgByCredentials(client_id, client_secret);
    if (!org) {
        const err = new Error('Invalid client credentials');
        err.status = 401;
        err.code = 'INVALID_CREDENTIALS';
        throw err;
    }
    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey)
        throw new Error('JWT_PRIVATE_KEY not configured');
    const payload = {
        sub: client_id,
        org_id: org.organization_id,
        scope: 'connect:write connect:read',
        jti: uuidv4(),
    };
    const access_token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: TOKEN_EXPIRY,
        issuer: 'orki-connect',
        audience: 'orki-api',
    });
    logger.info('Access token issued', { org_id: org.organization_id, client_id });
    return {
        access_token,
        expires_in: TOKEN_EXPIRY,
        token_type: 'Bearer',
    };
}
/**
 * Verifies an incoming JWT access token from a client backend request.
 */
export function verifyAccessToken(token) {
    const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
    if (!publicKey)
        throw new Error('JWT_PUBLIC_KEY not configured');
    try {
        return jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
            issuer: 'orki-connect',
            audience: 'orki-api',
        });
    }
    catch (err) {
        const authErr = new Error('Invalid or expired access token');
        authErr.status = 401;
        authErr.code = 'TOKEN_INVALID';
        throw authErr;
    }
}
//# sourceMappingURL=service.js.map