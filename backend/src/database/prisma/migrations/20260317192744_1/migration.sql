-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('ETHEREUM', 'POLYGON', 'SOLANA');

-- CreateEnum
CREATE TYPE "ComplianceMode" AS ENUM ('LITE', 'VALIDATE');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('WALLET', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED', 'EXTENDED_MONITORING');

-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('CONNECTION_APPROVED', 'CONNECTION_FLAGGED', 'CONNECTION_IDENTITY_MISMATCH', 'DEPOSITS_PENDING', 'DEPOSITS_SUBMITTED', 'DEPOSITS_DETECTED', 'DEPOSITS_CONFIRMED', 'DEPOSITS_FAILED', 'DEPOSITS_ABANDONED', 'DEPOSITS_UNEXPECTED', 'WITHDRAWAL_SUBMITTED', 'WITHDRAWAL_CONFIRMED', 'WITHDRAWAL_FAILED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "webhook_url" TEXT,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deposit_address" TEXT NOT NULL,
    "network" "Chain" NOT NULL,
    "token" TEXT NOT NULL,
    "mode" "ComplianceMode" NOT NULL,
    "kyc_name" TEXT,
    "connection_type" "ConnectionType" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "tx_hash" TEXT,
    "connection_id" TEXT,
    "exchange" TEXT,
    "wallet_address" TEXT,
    "risk_flag" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositAddress" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" "Chain" NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "http_status" INTEGER,
    "response_time_ms" INTEGER,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedDeposit" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmedDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_organization_id_key" ON "Organization"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_client_id_key" ON "Organization"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_id_key" ON "Session"("session_id");

-- CreateIndex
CREATE INDEX "Session_organization_id_idx" ON "Session"("organization_id");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_session_id_key" ON "DepositAddress"("session_id");

-- CreateIndex
CREATE INDEX "DepositAddress_address_network_idx" ON "DepositAddress"("address", "network");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_idempotency_key_key" ON "WebhookLog"("idempotency_key");

-- CreateIndex
CREATE INDEX "WebhookLog_organization_id_idx" ON "WebhookLog"("organization_id");

-- CreateIndex
CREATE INDEX "WebhookLog_session_id_idx" ON "WebhookLog"("session_id");

-- CreateIndex
CREATE INDEX "ConfirmedDeposit_organization_id_user_id_idx" ON "ConfirmedDeposit"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedDeposit" ADD CONSTRAINT "ConfirmedDeposit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
