import { Connection, clusterApiUrl } from '@solana/web3.js';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const POLL_INTERVAL_MS = 3_000;
const CONFIRMATION_TIMEOUT_MS = 30 * 60 * 1000;
const REQUIRED_SLOTS = 32;

function getConnection(): Connection {
  const cluster = config.blockchain.solanaCluster === 'mainnet' ? 'mainnet-beta' : 'devnet';
  const rpcUrl = config.blockchain.solanaRpcUrl || clusterApiUrl(cluster as 'mainnet-beta' | 'devnet');
  return new Connection(rpcUrl, 'finalized');
}

export async function confirmTransaction(txHash: string): Promise<void> {
  const connection = getConnection();
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await connection.getSignatureStatus(txHash, { searchTransactionHistory: true });

    if (status?.value?.err) {
      throw new Error(`Solana transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
    }
    if (status?.value?.confirmationStatus === 'finalized') {
      logger.info('[Solana] Transaction finalized', { txHash });
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Solana confirmation timeout after 30 minutes: ${txHash}`);
}

export function getRequiredSlots(): number {
  return REQUIRED_SLOTS;
}

export function getMonitoringConnection(): Connection {
  const rpcUrl = config.blockchain.solanaRpcUrl || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
