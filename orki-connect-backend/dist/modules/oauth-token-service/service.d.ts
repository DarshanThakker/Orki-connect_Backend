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
/**
 * Issues a JWT access token for a valid client_id + client_secret pair.
 */
export declare function issueAccessToken(client_id: string, client_secret: string): Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
}>;
/**
 * Verifies an incoming JWT access token from a client backend request.
 */
export declare function verifyAccessToken(token: string): string | jwt.JwtPayload;
//# sourceMappingURL=service.d.ts.map