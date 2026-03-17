import jwt, { SignOptions } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

function readKeyFromValue(value: string, label: string): string {
  // File path — read PEM from disk
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.endsWith('.pem')) {
    const resolved = path.resolve(value);
    if (!fs.existsSync(resolved)) throw new Error(`Key file not found: ${resolved} (from ${label})`);
    return fs.readFileSync(resolved, 'utf8');
  }
  // Inline PEM — unescape literal \n
  return value.replace(/\\n/g, '\n');
}

function getPrivateKey(): string { return readKeyFromValue(config.jwt.privateKeyPath, 'JWT_PRIVATE_KEY'); }
function getPublicKey(): string  { return readKeyFromValue(config.jwt.publicKeyPath, 'JWT_PUBLIC_KEY'); }

export function signToken(payload: Record<string, any>, options: SignOptions = {}): string {
  return jwt.sign(payload, getPrivateKey(), { algorithm: 'RS256', issuer: 'orki-connect', ...options });
}

export function verifyApiToken(token: string): any {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'], issuer: 'orki-connect', audience: 'orki-api' });
}

export function verifySessionToken(token: string): any {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'], issuer: 'orki-connect' });
}
