import { Connection, clusterApiUrl } from '@solana/web3.js';
import { ethers } from 'ethers';

import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';
import { updateSessionStatus } from '../session-service/service.js';
import { dispatchWebhookEvent } from '../webhook-dispatcher/service.js';
import { SessionStatus } from '@prisma/client';

// ─── Confirmation Thresholds ──────────────────────────────────────────────────
const EVM_CONFIRMATIONS: Record<string, number> = {
  ETHEREUM: 12,
  POLYGON: 128,
  BSC: 15,
  ARBITRUM: 20,
};
const POLL_INTERVAL_SOLANA_MS = 3_000;
const POLL_INTERVAL_EVM_MS = 5_000;
const CONFIRMATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Solana Confirmation ──────────────────────────────────────────────────────

async function confirmSolanaTransaction(txHash: string): Promise<void> {
  const cluster = process.env.SOLANA_CLUSTER === 'mainnet' ? 'mainnet-beta' : 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster as 'mainnet-beta' | 'devnet');
  const connection = new Connection(rpcUrl, 'finalized');

  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await connection.getSignatureStatus(txHash, { searchTransactionHistory: true });

    if (status?.value?.err) {
      throw new Error(`Solana transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
    }

    if (status?.value?.confirmationStatus === 'finalized') {
      logger.info('[TxConfirmation] Solana tx finalized', { txHash });
      return;
    }

    logger.debug('[TxConfirmation] Solana tx not yet finalized, polling...', {
      txHash,
      confirmationStatus: status?.value?.confirmationStatus ?? 'unknown',
    });

    await sleep(POLL_INTERVAL_SOLANA_MS);
  }

  throw new Error(`Solana transaction confirmation timeout after 30 minutes: ${txHash}`);
}

// ─── EVM Confirmation ─────────────────────────────────────────────────────────

async function confirmEVMTransaction(txHash: string, network: string): Promise<void> {
  const rpcUrl = getEvmRpcUrl(network);
  const threshold = EVM_CONFIRMATIONS[network] ?? 12;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (receipt) {
      if (receipt.status === 0) {
        throw new Error(`EVM transaction reverted on-chain: ${txHash}`);
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      logger.debug('[TxConfirmation] EVM tx confirmation count', { txHash, confirmations, threshold, network });

      if (confirmations >= threshold) {
        logger.info('[TxConfirmation] EVM tx confirmed', { txHash, confirmations, network });
        return;
      }
    } else {
      logger.debug('[TxConfirmation] EVM tx receipt not yet available, polling...', { txHash, network });
    }

    await sleep(POLL_INTERVAL_EVM_MS);
  }

  throw new Error(`EVM transaction confirmation timeout after 30 minutes: ${txHash}`);
}

function getEvmRpcUrl(network: string): string {
  const envKey = `${network}_RPC_URL`;
  if (process.env[envKey]) return process.env[envKey]!;

  // Public fallbacks
  const FALLBACKS: Record<string, string> = {
    ETHEREUM: 'https://eth.llamarpc.com',
    POLYGON: 'https://polygon-rpc.com',
    BSC: 'https://bsc-dataseed.binance.org',
    ARBITRUM: 'https://arb1.arbitrum.io/rpc',
  };

  const url = FALLBACKS[network];
  if (!url) throw new Error(`No RPC URL configured for network: ${network}`);
  return url;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Saves tx_hash to DB synchronously (critical for 14:59 safety),
 * dispatches connect.deposits.submitted immediately,
 * then fires async blockchain polling as fire-and-forget.
 *
 * Returns after the synchronous steps — does NOT wait for blockchain confirmation.
 */
export async function confirmTransaction(params: {
  session_id: string;
  tx_hash: string;
  network: string;
  token: string;
  organization_id: string;
  user_id: string;
  deposit_address: string;
  amount: string;
}): Promise<void> {
  const { session_id, tx_hash, network, token, organization_id, user_id, deposit_address, amount } = params;

  // ── Step 1: Save tx_hash to DB synchronously so expireSession() sees it ──
  await prisma.session.update({
    where: { session_id },
    data: { tx_hash, status: SessionStatus.ACTIVE },
  });

  logger.info('[TxConfirmation] tx_hash saved to session, starting async confirmation', { session_id, tx_hash, network });

  // ── Step 2: Dispatch connect.deposits.submitted immediately ──────────────
  await dispatchWebhookEvent(session_id, 'connect.deposits.submitted', {
    tx_hash,
    amount,
    token,
    network,
    user_id,
    deposit_address,
  });

  // ── Step 3: Fire-and-forget async blockchain polling ─────────────────────
  runConfirmationAsync({ session_id, tx_hash, network, token, user_id, deposit_address, amount });
}

function runConfirmationAsync(params: {
  session_id: string;
  tx_hash: string;
  network: string;
  token: string;
  user_id: string;
  deposit_address: string;
  amount: string;
}) {
  const { session_id, tx_hash, network, token, user_id, deposit_address, amount } = params;

  const poll = async () => {
    try {
      if (network === 'SOLANA') {
        await confirmSolanaTransaction(tx_hash);
      } else {
        await confirmEVMTransaction(tx_hash, network);
      }

      // Confirmed — update session and dispatch confirmed webhook
      await updateSessionStatus(session_id, SessionStatus.COMPLETED);
      await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', {
        tx_hash,
        amount,
        token,
        network,
        user_id,
        deposit_address,
        confirmations: EVM_CONFIRMATIONS[network] ?? (network === 'SOLANA' ? 32 : 12),
      });

      logger.info('[TxConfirmation] Confirmation complete', { session_id, tx_hash, network });
    } catch (err: any) {
      logger.error('[TxConfirmation] Confirmation failed', { session_id, tx_hash, network, error: err.message });

      await updateSessionStatus(session_id, SessionStatus.FAILED).catch(() => {});
      await dispatchWebhookEvent(session_id, 'connect.deposits.failed', {
        tx_hash,
        amount,
        token,
        network,
        user_id,
        deposit_address,
        error: err.message,
      }).catch(() => {});
    }
  };

  // Do not await — intentionally fire-and-forget
  poll();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
