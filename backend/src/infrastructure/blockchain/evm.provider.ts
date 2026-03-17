import { ethers } from 'ethers';
import { Chain } from '@prisma/client';
import { logger } from '../../utils/logger';

const POLL_INTERVAL_MS = 5_000;
const CONFIRMATION_TIMEOUT_MS = 30 * 60 * 1000;

const CONFIRMATION_THRESHOLDS: Record<string, number> = {
  ETHEREUM: 12,
  POLYGON: 128,
  BSC: 15,
  ARBITRUM: 20,
};

const USDC_CONTRACTS: Record<string, string> = {
  [Chain.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [Chain.POLYGON]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
};

const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

export function getConfirmationThreshold(network: string): number {
  return CONFIRMATION_THRESHOLDS[network] ?? 12;
}

export function getUsdcContract(network: string): string {
  const addr = USDC_CONTRACTS[network];
  if (!addr) throw new Error(`No USDC contract for network: ${network}`);
  return addr;
}

export function getRpcUrl(network: string): string {
  const envKey = `${network}_RPC_URL`;
  if (process.env[envKey]) return process.env[envKey]!;

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

export async function confirmTransaction(txHash: string, network: string): Promise<void> {
  const threshold = getConfirmationThreshold(network);
  const provider = new ethers.JsonRpcProvider(getRpcUrl(network));
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (receipt) {
      if (receipt.status === 0) throw new Error(`EVM transaction reverted: ${txHash}`);

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      logger.debug('[EVM] Confirmation count', { txHash, confirmations, threshold, network });

      if (confirmations >= threshold) {
        logger.info('[EVM] Transaction confirmed', { txHash, confirmations, network });
        return;
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`EVM confirmation timeout after 30 minutes: ${txHash}`);
}

export function createWebSocketProvider(network: Chain): ethers.WebSocketProvider {
  const wsUrl = process.env[`ALCHEMY_WS_URL_${network}`];
  if (!wsUrl) throw new Error(`ALCHEMY_WS_URL_${network} not configured`);
  return new ethers.WebSocketProvider(wsUrl);
}

export function createErc20Contract(address: string, provider: ethers.WebSocketProvider): ethers.Contract {
  return new ethers.Contract(address, ERC20_TRANSFER_ABI, provider);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
