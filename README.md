# Orki Connect

B2B SDK platform enabling fintechs to accept crypto deposits from their users via self-custody wallets and exchange accounts — without ever holding private keys.

---

## Repository Structure

```
orki-connect/
├── backend/          # Orki Connect API — the central coordination server
└── sdk/              # React Native SDK — embeds in partner mobile apps
```

---

## How It Works

```
Partner App (mobile)
  └─ Orki SDK (React Native)
       └─ Partner Backend (bank-backend pattern)
            └─ Orki Connect API  ──► Blockchain nodes (Solana / EVM)
                                 ──► Partner Webhook endpoint
```

1. **Partner backend** authenticates with Orki using `client_id` / `client_secret`.
2. Partner backend calls `POST /v1/connect/sessions` — Orki infers the deposit address from the org's registered addresses and returns `session_jwt` + `deposit_address`.
3. **SDK modal** is opened in the mobile app with the session JWT. The user connects their wallet (Phantom, MetaMask, etc.) and signs a transfer.
4. SDK calls `POST /v1/connect/sessions/:id/transactions` with the `tx_hash`. Orki watches the chain for confirmation.
5. Once confirmed, Orki fires a **signed webhook** to the partner's configured URL (`connect.deposits.confirmed`).

---

## Backend (`backend/`)

### Architecture

Four-layer clean architecture with a strict inward dependency rule:

```
interfaces → application → infrastructure → domain
```

| Layer | Path | Responsibility |
|---|---|---|
| **domain** | `src/domain/` | Pure business rules — entities, state machines. Zero external deps. |
| **infrastructure** | `src/infrastructure/` | Prisma, Redis, blockchain providers, JWT, risk screening, exchange adapters. |
| **application** | `src/application/` | Use-case orchestration. No HTTP concerns. |
| **interfaces** | `src/interfaces/http/` | Routes, controllers, middleware. Delegates to application layer. |

### Setup

**Prerequisites:** Node 20+, PostgreSQL, Redis.

```bash
cd backend
npm install

# Generate RSA key pair for JWT signing
mkdir -p .keys
openssl genrsa -out .keys/private.pem 2048
openssl rsa -in .keys/private.pem -pubout -out .keys/public.pem

cp .env.example .env
# Edit .env — see Environment Variables below
npx prisma migrate dev
make start
```

The server starts on port `3000`. In `NODE_ENV=development` the seed runs automatically, creating a demo org and printing an access token to the logs.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `JWT_PRIVATE_KEY` | No | `.keys/private.pem` | Path to RS256 private key |
| `JWT_PUBLIC_KEY` | No | `.keys/public.pem` | Path to RS256 public key |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `production` | `development` enables seed + query logs |
| `SOLANA_CLUSTER` | No | `devnet` | `mainnet` or `devnet` |
| `SOLANA_RPC_URL` | No | — | Solana RPC endpoint |
| `ETHEREUM_RPC_URL` | No | — | Ethereum RPC (WebSocket preferred) |
| `POLYGON_RPC_URL` | No | — | Polygon RPC endpoint |
| `ELLIPTIC_API_KEY` | No | — | Elliptic AML key (mock used if absent) |
| `COINBASE_CLIENT_ID` | No | — | Coinbase OAuth client ID |
| `COINBASE_CLIENT_SECRET` | No | — | Coinbase OAuth client secret |
| `BINANCE_CLIENT_ID` | No | — | Binance OAuth client ID |
| `BINANCE_CLIENT_SECRET` | No | — | Binance OAuth client secret |
| `DEFAULT_WEBHOOK_URL` | No | — | Fallback webhook URL if org has none set |
| `LOG_LEVEL` | No | `info` | Winston log level |

### API Reference

#### Authentication

```
POST /oauth/token
Body: { client_id, client_secret, grant_type: "client_credentials" }
Response: { access_token, expires_in, token_type }
```

#### Organisation Management

All org routes (except `POST /v1/org`) require `Authorization: Bearer <access_token>`.

```
POST /v1/org
Body: { organization_id, client_id, client_secret, webhook_url?, config? }

GET  /v1/org/config
PATCH /v1/org/config
Body: {
  supported_chains?,       // ["SOLANA", "ETHEREUM", ...]
  supported_tokens?,       // ["USDC", "USDT"]
  compliance_mode?,        // "LITE" | "VALIDATE"
  connection_methods?,     // ["WALLET"] | ["EXCHANGE"] | ["WALLET", "EXCHANGE"]
  min_per_transaction?,
  max_per_transaction?,
  daily_user_limit?,
  kyc_required?
}

PUT /v1/org/deposit-addresses
Body: { addresses: { SOLANA?: "...", ETHEREUM?: "...", POLYGON?: "..." } }
```

Deposit addresses are stored in the org's config and used automatically when creating sessions. Call this endpoint on your backend startup whenever your deposit addresses change.

#### Connect Sessions

```
POST /v1/connect/sessions
Authorization: Bearer <access_token>
Body: { user_id, network, token, mode?, kyc_name?, connection_type? }
Response: { session_id, session_jwt, refresh_token, expires_at, deposit_address, evm_deposit_address? }
```

`deposit_address` is inferred from the org's registered addresses for the requested `network`. No address is required in the request body.

```
GET  /v1/connect/sessions/:session_id
Authorization: Bearer <access_token>

POST /v1/connect/sessions/refresh
Body: { refresh_token }
Response: { session_id, session_jwt, expires_at }

POST /v1/connect/sessions/:session_id/transactions
Authorization: Bearer <session_jwt>
Body: { tx_hash, amount, token, network, user_id?, deposit_address? }
Response: { accepted: true, session_id }

POST /v1/connect/public/sessions
Body: { client_id, user_id, network, token, mode?, kyc_name? }
Response: { session_id, session_jwt, refresh_token, expires_at, deposit_address }
```

#### Exchange OAuth

```
GET  /v1/connect/oauth/authorize?exchange=coinbase&session_id=...
GET  /v1/connect/oauth/callback?exchange=coinbase&state=...&code=...
POST /v1/connect/oauth/withdraw
     Authorization: Bearer <access_token>
     Body: { session_id, amount, token }
```

#### Webhooks

```
GET /v1/webhooks/.well-known/jwks.json     (public — for signature verification)
GET /v1/webhooks/delivery-log              Authorization: Bearer <access_token>
```

### Webhook Events

Orki sends a signed JWT (`X-Orki-Signature`) to your `webhook_url` for each event. Verify the signature using the public key at `/v1/webhooks/.well-known/jwks.json`.

| Event | Trigger |
|---|---|
| `connect.deposits.submitted` | `tx_hash` received from SDK |
| `connect.deposits.confirmed` | Required on-chain confirmations reached |
| `connect.deposits.abandoned` | Session expired before deposit confirmed |
| `connect.session.created` | New session opened |
| `connect.session.expired` | Session timed out |
| `connect.identity.verified` | Exchange identity matched KYC name |
| `connect.identity.failed` | Identity match below threshold |
| `connect.risk.flagged` | AML screening returned a risk flag |

Webhook delivery retries use exponential backoff for up to 72 hours. Dead-lettered events are logged and retrievable via `GET /v1/webhooks/delivery-log`.

### Session State Machine

```
CREATED ──► ACTIVE ──► COMPLETED
                   ──► FAILED
                   ──► EXTENDED_MONITORING ──► COMPLETED
                                           ──► FAILED
        ──► EXPIRED
        ──► FAILED
```

Sessions time out after 15 minutes. If a `tx_hash` is recorded before expiry the session moves to `EXTENDED_MONITORING` while awaiting on-chain confirmation.

### Confirmation Thresholds

> Do not change without a formal risk review.

| Network | Confirmations | Approx. time |
|---|---|---|
| Solana | 32 slots | ~15 sec |
| Ethereum | 12 blocks | ~2.5 min |
| Polygon | 128 blocks | ~4 min |

### Redis Caching

| Key | TTL | Purpose |
|---|---|---|
| `org:config:<id>` | 5 min | Org config. Invalidated on config/webhook/address updates. |
| `session:<id>` | 2 min | Session reads. Invalidated on every status change. |
| `daily:<org>:<user>:<date>` | 26 h | Atomic daily transfer totals (`INCRBYFLOAT`). |

---

## SDK (`sdk/`)

React Native library that embeds the deposit flow inside a partner mobile app.

### Install

```bash
cd sdk
npm install
```

### Quick Start

```tsx
import { OrkiConnect, OrkiConnectModal } from 'orki-connect-sdk';

const orki = new OrkiConnect({
  network: 'testnet',                         // "mainnet" | "testnet"
  redirectScheme: 'myapp://orki',             // deep link scheme registered in app.json
  bankBackendUrl: process.env.EXPO_PUBLIC_BANK_BACKEND_URL,
  backendUrl: process.env.EXPO_PUBLIC_ORKI_BACKEND_URL,
  userId: 'user_123',
});

// Open the modal — session + deposit address come from the bank backend
<OrkiConnectModal
  visible={showModal}
  orki={orki}
  onClose={() => setShowModal(false)}
  onSuccess={(txid) => console.log('Deposited:', txid)}
  solanaDepositAddress={depositAddress}       // from session response
  evmDepositAddress={evmDepositAddress}       // from session response (optional)
  sessionId={sessionId}
  sessionJwt={sessionJwt}
/>
```

### OrkiConnect Options

| Option | Type | Description |
|---|---|---|
| `network` | `"mainnet" \| "testnet"` | Maps to Solana mainnet-beta / devnet. Default: `"mainnet"`. |
| `redirectScheme` | `string` | Deep link scheme for wallet callbacks (e.g. `myapp://orki`). Required. |
| `bankBackendUrl` | `string` | Your backend URL — used for session creation proxy. |
| `backendUrl` | `string` | Orki Connect API URL — used for `reportTransaction`. |
| `userId` | `string` | User identifier to attach to sessions. |
| `appUrl` | `string` | HTTPS URL of your app (used in Phantom session validation). |

### OrkiConnectModal Props

| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Controls modal visibility. |
| `orki` | `OrkiConnect` | Initialised SDK instance. |
| `onClose` | `() => void` | Called when the user dismisses the modal. |
| `onSuccess` | `(txid: string) => void` | Called after a confirmed deposit. |
| `solanaDepositAddress` | `string` | Solana deposit address (from session response). |
| `evmDepositAddress` | `string?` | EVM deposit address (from session response, optional). |
| `sessionId` | `string` | Session ID from `POST /api/session`. |
| `sessionJwt` | `string` | Session JWT for authenticating transaction reports. |

### Supported Wallets

| Wallet | Protocol | Networks |
|---|---|---|
| Phantom | Encrypted deep link (x25519 + NaCl) | Solana |
| MetaMask | HTTPS deep link (MetaMask SDK URI) | EVM |
| Coinbase Wallet | EIP-681 URI | EVM |
| Trust Wallet | EIP-681 URI | EVM |

---

## Security

- **Non-custodial** — Orki never generates or holds private keys.
- **Client secrets** are bcrypt-hashed (10 rounds) before storage.
- **Session JWTs** are RS256-signed and expire after 18 minutes.
- **Webhook signatures** use RS256; verify against the public JWKS endpoint.
- **Daily limits** are enforced atomically via Redis `INCRBYFLOAT` — safe across multiple server instances.
- **AML screening** via Elliptic (mock mode used when `ELLIPTIC_API_KEY` is absent).
- **OAuth tokens** must be encrypted at rest via AWS KMS before production (current vault is in-memory).

---

## Integration Checklist

- [ ] Generate RSA key pair and set `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
- [ ] Provision PostgreSQL and Redis
- [ ] Create your org via `POST /v1/org`
- [ ] Obtain an access token via `POST /oauth/token`
- [ ] Register your deposit addresses via `PUT /v1/org/deposit-addresses`
- [ ] Configure `webhook_url` — implement signature verification using the JWKS endpoint
- [ ] Add `ORKI_ORG_ACCESS_TOKEN` to your backend environment
- [ ] Install the SDK in your mobile app and configure `bankBackendUrl` + `backendUrl`
- [ ] Test with Solana devnet before switching to `network: "mainnet"`
