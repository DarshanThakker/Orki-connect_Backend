# Orki Connect — Backend API

B2B SDK backend for crypto account-to-account transfers. UAE/MENA Fintech.

## Module Build Order

Build in this exact sequence — each module depends on the ones before it:

| #   | Module                     | Risk        | Status                             |
| --- | -------------------------- | ----------- | ---------------------------------- |
| 01  | OAuth Token Service        | LOW         | ✅ Scaffolded                      |
| 02  | Org Config Service         | LOW         | ✅ Implemented (Bcrypt Hashing)    |
| 03  | Deposit Address Registry   | LOW         | ✅ Scaffolded                      |
| 04  | Session Service            | MEDIUM      | ✅ Scaffolded                      |
| 05  | Wallet Signature Verifier  | MEDIUM      | ✅ Scaffolded                      |
| 06  | Exchange OAuth Manager     | **HIGH**    | ✅ Implemented (Routes & Adapters) |
| 07  | Encrypted Token Vault      | **HIGH**    | ✅ Scaffolded                      |
| 08  | Elliptic Risk Service      | MEDIUM      | ✅ Scaffolded                      |
| 09  | Limit Enforcement Service  | LOW         | ✅ Implemented (Limit Checks)      |
| 10  | Blockchain Monitor Service | **HIGHEST** | ✅ Implemented (Deposit Recording) |
| 11  | Webhook Dispatcher         | MEDIUM      | ✅ Scaffolded                      |

## Setup

```bash
npm install
cp .env.example .env
# Fill in .env values
npm run dev
```

## Postman Collection

A Postman collection is provided for testing all API endpoints:

- **Location**: `docs/orki_connect_api.postman_collection.json`
- **Setup**: Import the JSON into Postman and set the `baseUrl`, `accessToken`, and `sessionId` variables.

## Day 1 Actions — Do Before Writing Any Code

1. **Submit Coinbase OAuth application** → developer.coinbase.com
2. **Submit Binance OAuth application** → binance.com/en/developers _(longest lead time)_
3. **Contact Elliptic for API key** → sales@elliptic.co
4. **Register WalletConnect v2 project** → cloud.walletconnect.com _(free)_
5. **Provision AWS KMS key** → Required for token vault

## API Endpoints

### Authentication

```
POST /oauth/token
Body: { client_id, client_secret, grant_type: "client_credentials" }
Response: { access_token, expires_in, token_type }
```

### Organization Management

```
POST /v1/org
Body: { organization_id, client_id, client_secret, webhook_url, config? }

GET /v1/org/config
Auth: Bearer <access_token>

PATCH /v1/org/config
Auth: Bearer <access_token>
Body: { ...updates }
```

### Connect Sessions

```
POST /v1/connect/sessions
Auth: Bearer <access_token>
Body: { user_id, deposit_address, network, token, mode, kyc_name? }
Response: { session_id, session_jwt, expires_at }

GET /v1/connect/sessions/:session_id
Auth: Bearer <access_token>
```

### Exchange OAuth (Connect Flow)

```
GET /v1/connect/oauth/authorize?exchange=coinbase&session_id=...
(Redirects to Exchange)

GET /v1/connect/oauth/callback?exchange=coinbase&state=...&code=...
(Handles redirect from Exchange)

POST /v1/connect/oauth/withdraw
Auth: Bearer <access_token>
Body: { session_id, amount, token }
```

### Webhooks

```
GET /v1/webhooks/.well-known/jwks.json  (public — for signature verification)
GET /v1/webhooks/delivery-log           (auth required)
```

## Confirmation Thresholds

⚠️ **DO NOT CHANGE WITHOUT FORMAL RISK REVIEW**

| Network  | Confirmations | Time     |
| -------- | ------------- | -------- |
| Ethereum | 12            | ~2.5 min |
| Solana   | 32 slots      | ~15 sec  |
| Polygon  | 128           | ~4 min   |

## Environment Variables

See `.env.example` for all required configuration.

## Architecture Notes

- **Never generate or hold private keys** — Orki is non-custodial
- **Secure Secret Storage** — Organization `client_secret` is hashed using `bcrypt` (10 rounds) before database storage.
- **OAuth tokens must be KMS-encrypted** — never plaintext in database
- **Monitoring is session-scoped only** — unsubscribe on session end
- **Never surface Orki fees to end users** — B2B billing only
- **Webhook Dispatcher is a generic event bus** — designed for Phase 2 extensibility
