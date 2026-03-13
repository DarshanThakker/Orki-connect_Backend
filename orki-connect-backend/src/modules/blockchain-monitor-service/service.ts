import { ethers } from 'ethers';
import { Chain, SessionStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session-service/service.js';
import { getAddressBySession, deregisterAddress } from '../deposit-address-registry/service.js';
import { dispatchWebhookEvent } from '../webhook-dispatcher/service.js';
import { recordConfirmedDeposit } from '../limit-enforcement-service/service.js';

// ─── Confirmation Thresholds ──────────────────────────────────────────────────
// ⚠️  DO NOT CHANGE WITHOUT FORMAL RISK REVIEW
const CONFIRMATION_THRESHOLDS: Record<string, number> = {
  [Chain.ETHEREUM]: 12,
  [Chain.POLYGON]: 128,
  [Chain.SOLANA]: 32,
};

// ─── ERC-20 USDC Transfer event ABI ──────────────────────────────────────────
const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// ─── USDC Contract Addresses ──────────────────────────────────────────────────
const USDC_CONTRACTS: Record<string, string> = {
  [Chain.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [Chain.POLYGON]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
};

// ─── Active Monitor Registry ──────────────────────────────────────────────────
// session_id → { stop: Function }
const activeMonitors = new Map<string, { stop: () => void }>();

/**
 * Starts blockchain monitoring for a session's deposit address.
 */
export async function startMonitoring(session_id: string) {
  const session = await getSession(session_id);
  const addressEntry = await getAddressBySession(session_id);
  if (!addressEntry) throw new Error(`No deposit address registered for session: ${session_id}`);

  const { address, network } = addressEntry;

  if (network === Chain.SOLANA) {
    await startSolanaMonitoring(session_id, address, session);
  } else {
    await startEVMMonitoring(session_id, address, network, session);
  }

  logger.info('Blockchain monitoring started', { session_id, network, deposit_address: address });
}

/**
 * EVM monitoring via Alchemy WebSocket.
 */
async function startEVMMonitoring(session_id: string, deposit_address: string, network: Chain, session: any) {
  const alchemyUrl = process.env[`ALCHEMY_WS_URL_${network}`];
  if (!alchemyUrl) throw new Error(`ALCHEMY_WS_URL_${network} not configured`);

  const provider = new ethers.WebSocketProvider(alchemyUrl);
  const usdcContract = new ethers.Contract(USDC_CONTRACTS[network]!, ERC20_TRANSFER_ABI, provider);

  const requiredConfirmations = CONFIRMATION_THRESHOLDS[network]!;

  const filter = usdcContract.filters.Transfer ? usdcContract.filters.Transfer(null, deposit_address) : null;
  if (!filter) {
    logger.error('Transfer filter undefined', { network });
    return;
  }

  const onTransfer = async (from: string, to: string, value: any, event: any) => {
    const tx_hash = event.log.transactionHash;
    const detected_block = event.log.blockNumber;

    logger.info('EVM Transfer detected', { session_id, tx_hash, from, value: value.toString(), network });

    await updateSessionStatus(session_id, SessionStatus.ACTIVE, { tx_hash });

    const amount_usdc = ethers.formatUnits(value, 6); // USDC has 6 decimals
    await dispatchWebhookEvent(session_id, 'connect.deposits.detected', {
      tx_hash,
      from_address: from,
      amount: amount_usdc,
      network,
    });

    monitorConfirmations({
      session_id,
      session,
      tx_hash,
      detected_block,
      required_confirmations: requiredConfirmations,
      network,
      amount: amount_usdc,
      from,
      provider,
    });
  };

  usdcContract.on(filter, onTransfer);

  activeMonitors.set(session_id, {
    stop: () => {
      usdcContract.off(filter, onTransfer);
      provider.destroy();
    },
  });
}

/**
 * Tracks block confirmations for a detected transaction.
 */
async function monitorConfirmations(params: {
  session_id: string;
  session: any;
  tx_hash: string;
  detected_block: number;
  required_confirmations: number;
  network: Chain;
  amount: string;
  from: string;
  provider: ethers.WebSocketProvider;
}) {
  const { session_id, session, tx_hash, detected_block, required_confirmations, network, amount, from, provider } = params;
  const POLL_INTERVAL_MS = 15000;

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - detected_block + 1;

      const receipt = await provider.getTransactionReceipt(tx_hash);
      if (!receipt) {
        logger.warn('Transaction disappeared — possible reorg', { session_id, tx_hash, network });
        await dispatchWebhookEvent(session_id, 'connect.deposits.failed', {
          tx_hash, reason: 'blockchain_reorg',
        });
        stopMonitoring(session_id);
        return;
      }

      if (confirmations >= required_confirmations) {
        logger.info('Deposit confirmed', { session_id, tx_hash, confirmations, network });

        await updateSessionStatus(session_id, SessionStatus.COMPLETED);

        // Record the confirmed deposit in the limit enforcement service
        await recordConfirmedDeposit(session.organization_id, session.user_id, amount);

        await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', {
          tx_hash,
          from_address: from,
          amount,
          network,
          confirmations,
          deposit_address: session.deposit_address,
        });

        stopMonitoring(session_id);
        await deregisterAddress(session_id);
      } else {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err: any) {
      logger.error('Error in confirmation monitor', { session_id, tx_hash, error: err.message });
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  setTimeout(poll, POLL_INTERVAL_MS);
}

/**
 * Solana monitoring via RPC subscription.
 */
async function startSolanaMonitoring(session_id: string, deposit_address: string, session: any) {
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const solanaRpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(solanaRpc, 'confirmed');

  const pubkey = new PublicKey(deposit_address);
  const requiredSlots = CONFIRMATION_THRESHOLDS[Chain.SOLANA]!;

  const subscriptionId = connection.onAccountChange(pubkey, async (accountInfo, context) => {
    logger.info('Solana account change detected', { session_id, deposit_address, slot: context.slot });

    await dispatchWebhookEvent(session_id, 'connect.deposits.detected', {
      network: Chain.SOLANA,
      slot: context.slot,
    });

    const confirm = async () => {
      const currentSlot = await connection.getSlot('finalized');
      if (currentSlot >= context.slot + requiredSlots) {
        await updateSessionStatus(session_id, SessionStatus.COMPLETED);
        await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', {
          network: Chain.SOLANA, slot: context.slot, confirmations: requiredSlots,
        });
        connection.removeAccountChangeListener(subscriptionId);
        activeMonitors.delete(session_id);
      } else {
        setTimeout(confirm, 2000);
      }
    };
    confirm();
  }, { commitment: 'confirmed' });

  activeMonitors.set(session_id, {
    stop: () => connection.removeAccountChangeListener(subscriptionId),
  });
}

/**
 * Stops monitoring for a session.
 */
export function stopMonitoring(session_id: string) {
  const monitor = activeMonitors.get(session_id);
  if (monitor?.stop) {
    monitor.stop();
    activeMonitors.delete(session_id);
    logger.info('Monitoring stopped', { session_id });
  }
}

/**
 * Returns current count of active monitors.
 */
export function getActiveMonitorCount() {
  return activeMonitors.size;
}
