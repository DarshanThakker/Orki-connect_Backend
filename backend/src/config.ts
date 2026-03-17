import 'dotenv/config';

// ─── Typed application config ──────────────────────────────────────────────
// All process.env access is centralised here. Import `config` everywhere else.
// ──────────────────────────────────────────────────────────────────────────

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function optionalInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  // ── Server ────────────────────────────────────────────────────────────────
  port: optionalInt('PORT', 3000),
  nodeEnv: optional('NODE_ENV', 'production'),
  get isDev() { return this.nodeEnv === 'development'; },

  // ── Database ──────────────────────────────────────────────────────────────
  databaseUrl: required('DATABASE_URL'),

  // ── Redis ─────────────────────────────────────────────────────────────────
  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: optionalInt('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: optionalInt('REDIS_DB', 0),
    get url(): string {
      return process.env.REDIS_URL || `redis://${this.host}:${this.port}`;
    },
  },

  // ── JWT / Auth ────────────────────────────────────────────────────────────
  jwt: {
    privateKeyPath: optional('JWT_PRIVATE_KEY', '.keys/private.pem'),
    publicKeyPath: optional('JWT_PUBLIC_KEY', '.keys/public.pem'),
    jwksKeyN: optional('JWKS_PUBLIC_KEY_N', 'PLACEHOLDER'),
    jwksKeyE: optional('JWKS_PUBLIC_KEY_E', 'AQAB'),
  },

  // ── Blockchain ────────────────────────────────────────────────────────────
  blockchain: {
    solanaCluster: optional('SOLANA_CLUSTER', 'devnet') as 'mainnet' | 'devnet',
    solanaRpcUrl: process.env.SOLANA_RPC_URL || undefined,
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || undefined,
    polygonRpcUrl: process.env.POLYGON_RPC_URL || undefined,
    bscRpcUrl: process.env.BSC_RPC_URL || undefined,
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL || undefined,
  },

  // ── Webhook ───────────────────────────────────────────────────────────────
  webhook: {
    defaultUrl: process.env.DEFAULT_WEBHOOK_URL || undefined,
  },

  // ── Logging ───────────────────────────────────────────────────────────────
  logLevel: optional('LOG_LEVEL', 'info'),

  // ── Risk / Elliptic ───────────────────────────────────────────────────────
  elliptic: {
    apiKey: process.env.ELLIPTIC_API_KEY || undefined,
    mock: optionalBool('ELLIPTIC_MOCK', true),
    get isLive(): boolean { return !!this.apiKey && !this.mock; },
  },

  // ── Exchange OAuth ────────────────────────────────────────────────────────
  coinbase: {
    clientId: optional('COINBASE_CLIENT_ID', ''),
    clientSecret: optional('COINBASE_CLIENT_SECRET', ''),
    redirectUri: optional('COINBASE_REDIRECT_URI', ''),
  },

  binance: {
    clientId: optional('BINANCE_CLIENT_ID', ''),
    clientSecret: optional('BINANCE_CLIENT_SECRET', ''),
    redirectUri: optional('BINANCE_REDIRECT_URI', ''),
  },
} as const;
