# Orki Connect — Backend API

B2B SDK backend for crypto account-to-account transfers. UAE/MENA Fintech.

---

## Architecture

Four-layer clean architecture with strict dependency flow:

```
interfaces → application → infrastructure → domain
```

| Layer | Path | Responsibility |
|---|---|---|
| **domain** | `src/domain/` | Pure business rules — entities, state machines, error types. Zero external dependencies. |
| **infrastructure** | `src/infrastructure/` | Adapters for external systems — Prisma, Redis, blockchain providers, JWT, risk screening, token vault, exchange adapters. |
| **application** | `src/application/` | Use cases — orchestrates domain logic and infrastructure. No HTTP concerns. |
| **interfaces** | `src/interfaces/http/` | HTTP only — routes, controllers, middleware. Delegates everything to application layer. |

### Directory Tree

```
src/
├── domain/
│   ├── session/session.entity.ts       # State machine, timeout constant
│   ├── org/org.entity.ts               # OrgConfig type, defaults
│   └── shared/
│       ├── errors.ts                   # OrkiError, ValidationError, AuthError, …
│       └── types.ts                    # WebhookEvent enum, shared interfaces
├── infrastructure/
│   ├── cache/redis.client.ts           # ioredis singleton, TTL constants
│   ├── database/
│   │   ├── prisma.client.ts            # PrismaClient singleton (PrismaPg adapter)
│   │   └── repositories/              # Typed Prisma calls, one file per model
│   │       ├── session.repository.ts
│   │       ├── org.repository.ts
│   │       ├── deposit.repository.ts
│   │       └── webhook.repository.ts
│   ├── security/jwt.service.ts         # RS256 sign/verify (API + session tokens)
│   ├── blockchain/
│   │   ├── evm.provider.ts             # ethers.js — confirmations, WebSocket
│   │   └── solana.provider.ts          # @solana/web3.js — slot confirmations
│   ├── risk/elliptic.provider.ts       # AML address screening
│   ├── vault/token.vault.ts            # Encrypted OAuth token storage (TODO: AWS KMS)
│   └── exchange/adapters/
│       ├── coinbase.adapter.ts
│       └── binance.adapter.ts
├── application/
│   ├── auth/auth.service.ts            # Issue/verify API access tokens
│   ├── session/
│   │   ├── session.service.ts          # Full session lifecycle
│   │   └── deposit.service.ts          # Address validation and registration
│   ├── org/org.service.ts              # Org CRUD + config validation
│   ├── webhook/webhook.service.ts      # Dispatch, retry (72h backoff), JWKS
│   ├── exchange/exchange.service.ts    # OAuth callback, identity match, withdrawal
│   ├── wallet/wallet.service.ts        # Signature verification + AML
│   ├── limits/limits.service.ts        # Daily limit enforcement (Redis-backed)
│   ├── transaction/transaction.service.ts  # tx_hash recording, async confirmation
│   └── blockchain/blockchain.service.ts   # EVM WebSocket + Solana account monitoring
└── interfaces/http/
    ├── middleware/
    │   ├── auth.middleware.ts           # API access token guard
    │   ├── session-auth.middleware.ts   # Session JWT guard
    │   └── error.middleware.ts          # Centralised error → HTTP response
    ├── controllers/                     # Parse req/res, call application services
    └── routes/                          # Wire middleware + controllers
```

---

## Redis Caching

| Key pattern | TTL | Purpose |
|---|---|---|
| `org:config:<id>` | 5 min | Org config (read on every request, rarely written). Invalidated on `PATCH /v1/org/config`. |
| `session:<id>` | 2 min | Session reads. Invalidated on every status change or refresh. |
| `daily:<org>:<user>:<date>` | 26 hours | Atomic daily transfer totals via `INCRBYFLOAT`. Expires past midnight. |

---

## Setup

```bash
npm install
cp .env.example .env
# Fill in .env values
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string (default: `redis://localhost:6379`) |
| `JWT_PRIVATE_KEY` | Yes | RS256 private key (PEM) for signing tokens |
| `JWT_PUBLIC_KEY` | Yes | RS256 public key (PEM) for verifying tokens |
| `PORT` | No | HTTP port (default: `3000`) |
| `NODE_ENV` | No | `development` enables query logging |
| `ELLIPTIC_API_KEY` | No | Elliptic AML API key (mock mode used if absent) |
| `COINBASE_CLIENT_ID` | Yes | Coinbase OAuth client ID |
| `COINBASE_CLIENT_SECRET` | Yes | Coinbase OAuth client secret |
| `BINANCE_CLIENT_ID` | Yes | Binance OAuth client ID |
| `BINANCE_CLIENT_SECRET` | Yes | Binance OAuth client secret |
| `ETH_RPC_URL` | Yes | Ethereum RPC endpoint (WebSocket preferred) |
| `POLYGON_RPC_URL` | Yes | Polygon RPC endpoint |
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |

---

## API Endpoints

### Authentication

```
POST /oauth/token
Body: { client_id, client_secret, grant_type: "client_credentials" }
Response: { access_token, expires_in, token_type }
```

### Organisation Management

```
POST /v1/org
Body: { organization_id, client_id, client_secret, webhook_url?, config? }

GET /v1/org/config
Authorization: Bearer <access_token>

PATCH /v1/org/config
Authorization: Bearer <access_token>
Body: { supported_chains?, supported_tokens?, compliance_mode?, min_per_transaction?, max_per_transaction?, daily_user_limit?, connection_methods? }
```

### Connect Sessions

```
POST /v1/connect/sessions
Authorization: Bearer <access_token>
Body: { user_id, deposit_address, network, token, mode?, kyc_name?, connection_type? }
Response: { session_id, session_jwt, refresh_token, expires_at }

GET /v1/connect/sessions/:session_id
Authorization: Bearer <access_token>

POST /v1/connect/sessions/:session_id/refresh
Body: { refresh_token }

POST /v1/connect/sessions/:session_id/wallet
Authorization: Bearer <session_jwt>
Body: { wallet_address, signature, network }

POST /v1/connect/sessions/:session_id/transaction
Authorization: Bearer <session_jwt>
Body: { tx_hash, amount, token }
```

### Exchange OAuth

```
GET /v1/connect/oauth/authorize?exchange=coinbase&session_id=...
(Redirects to exchange authorization page)

GET /v1/connect/oauth/callback?exchange=coinbase&state=...&code=...
(Exchange redirect handler — stores token, matches identity)

POST /v1/connect/oauth/withdraw
Authorization: Bearer <access_token>
Body: { session_id, amount, token }
```

### Webhooks

```
GET /v1/webhooks/.well-known/jwks.json   (public — for webhook signature verification)
GET /v1/webhooks/delivery-log            (Authorization: Bearer <access_token>)
```

---

## Webhook Events

| Event | Trigger |
|---|---|
| `connect.session.created` | New session opened |
| `connect.session.expired` | Session timed out without deposit |
| `connect.deposits.detected` | On-chain deposit detected |
| `connect.deposits.confirmed` | Required confirmations reached |
| `connect.deposits.abandoned` | Session expired before deposit confirmed |
| `connect.identity.verified` | Exchange identity matched KYC name |
| `connect.identity.failed` | Identity match below threshold |
| `connect.risk.flagged` | AML screening returned risk flag |

Webhooks are signed with RS256. Verify using the public key at `/v1/webhooks/.well-known/jwks.json`.
Retries use exponential backoff up to 72 hours.

---

## Session State Machine

```
CREATED → ACTIVE → COMPLETED
                 → FAILED
                 → EXTENDED_MONITORING → COMPLETED
                                       → FAILED
        → FAILED
        → EXPIRED
```

Sessions expire after 15 minutes. If a `tx_hash` is recorded before expiry, the session enters `EXTENDED_MONITORING` while waiting for on-chain confirmation.

---

## Confirmation Thresholds

> **Do not change without a formal risk review.**

| Network | Confirmations | Approx. time |
|---|---|---|
| Ethereum | 12 | ~2.5 min |
| Solana | 32 slots | ~15 sec |
| Polygon | 128 | ~4 min |

---

## Security Notes

- **Non-custodial** — Orki never generates or holds private keys.
- **Client secrets** are bcrypt-hashed (10 rounds) before storage — never stored in plaintext.
- **OAuth tokens** must be encrypted at rest via AWS KMS (current vault is an in-memory mock — replace before production).
- **Webhook signatures** use RS256; consumers should verify against the JWKS endpoint.
- **Monitoring is session-scoped** — blockchain subscriptions are torn down when the session ends.
- **Daily limits** are enforced atomically via Redis `INCRBYFLOAT` — safe across multiple server instances.

---

## Day 1 Actions

1. Submit Coinbase OAuth application → developer.coinbase.com
2. Submit Binance OAuth application → binance.com/en/developers _(longest lead time)_
3. Contact Elliptic for API key → sales@elliptic.co
4. Register WalletConnect v2 project → cloud.walletconnect.com _(free)_
5. Provision AWS KMS key for token vault

## Postman Collection

Import `docs/orki_connect_api.postman_collection.json` and set the `baseUrl`, `accessToken`, and `sessionId` collection variables.
