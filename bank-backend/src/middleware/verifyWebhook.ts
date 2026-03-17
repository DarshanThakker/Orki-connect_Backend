import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const DEPOSIT_CONFIRMED_EVENT = 'connect.deposits.confirmed';

// Events that carry a balance credit — add others as needed
export const CREDITABLE_EVENTS = new Set([DEPOSIT_CONFIRMED_EVENT]);

let jwks: ReturnType<typeof jwksClient> | null = null;

function getJwksClient() {
  if (!jwks && process.env.ORKI_JWKS_URL) {
    jwks = jwksClient({ jwksUri: process.env.ORKI_JWKS_URL, cache: true, rateLimit: true });
  }
  return jwks;
}

function getPublicKey(): string | null {
  return process.env.ORKI_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? null;
}

async function resolveSigningKey(header: jwt.JwtHeader): Promise<string> {
  const staticKey = getPublicKey();
  if (staticKey) return staticKey;

  const client = getJwksClient();
  if (!client) throw new Error('No ORKI_PUBLIC_KEY or ORKI_JWKS_URL configured');

  return new Promise((resolve, reject) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('No signing key found'));
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyWebhook(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-orki-signature'] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: 'Missing X-Orki-Signature header' });
    return;
  }

  try {
    const decoded = jwt.decode(signature, { complete: true });
    if (!decoded || typeof decoded === 'string') throw new Error('Invalid JWT structure');

    const signingKey = await resolveSigningKey(decoded.header);
    const verified = jwt.verify(signature, signingKey, { algorithms: ['RS256'], issuer: 'orki-connect' });

    // Attach verified payload to request for downstream use
    (req as any).orkiPayload = verified;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid webhook signature', detail: err.message });
  }
}
