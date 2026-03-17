import { ethers } from 'ethers';
import { Chain, SessionStatus } from '@prisma/client';
import { logger } from '../../utils/logger';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session/session.service';
import { getAddressBySession, deregisterAddress } from '../session/deposit.service';
import { dispatchWebhookEvent } from '../webhook/webhook.service';
import { recordConfirmedDeposit } from '../limits/limits.service';
import {
  getConfirmationThreshold,
  getUsdcContract,
  createWebSocketProvider,
  createErc20Contract,
} from '../../infrastructure/blockchain/evm.provider';
import { getRequiredSlots, getMonitoringConnection } from '../../infrastructure/blockchain/solana.provider';

const activeMonitors = new Map<string, { stop: () => void }>();

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

  logger.info('Blockchain monitoring started', { session_id, network, address });
}

async function startEVMMonitoring(session_id: string, deposit_address: string, network: Chain, session: any) {
  const provider = createWebSocketProvider(network);
  const usdcContract = createErc20Contract(getUsdcContract(network), provider);
  const requiredConfirmations = getConfirmationThreshold(network);

  logger.info('EVM monitoring initialised', { session_id, network, deposit_address, required_confirmations: requiredConfirmations });

  const filter = usdcContract.filters.Transfer ? usdcContract.filters.Transfer(null, deposit_address) : null;
  if (!filter) { logger.error('Transfer filter undefined — cannot monitor', { session_id, network }); return; }

  const onTransfer = async (from: string, _to: string, value: any, event: any) => {
    const tx_hash = event.log.transactionHash;
    const detected_block = event.log.blockNumber;
    const amount_usdc = ethers.formatUnits(value, 6);

    logger.info('EVM Transfer detected', { session_id, tx_hash, from, amount_usdc, network });

    await updateSessionStatus(session_id, SessionStatus.ACTIVE, { tx_hash });
    await dispatchWebhookEvent(session_id, 'connect.deposits.detected', { tx_hash, from_address: from, amount: amount_usdc, network });

    monitorConfirmations({ session_id, session, tx_hash, detected_block, required_confirmations: requiredConfirmations, network, amount: amount_usdc, from, provider });
  };

  usdcContract.on(filter, onTransfer);
  activeMonitors.set(session_id, { stop: () => { usdcContract.off(filter, onTransfer); provider.destroy(); } });
}

async function monitorConfirmations(params: {
  session_id: string; session: any; tx_hash: string; detected_block: number;
  required_confirmations: number; network: Chain; amount: string; from: string;
  provider: ethers.WebSocketProvider;
}) {
  const { session_id, session, tx_hash, detected_block, required_confirmations, network, amount, from, provider } = params;

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - detected_block + 1;
      const receipt = await provider.getTransactionReceipt(tx_hash);

      if (!receipt) {
        logger.warn('Transaction disappeared — possible reorg', { session_id, tx_hash });
        await dispatchWebhookEvent(session_id, 'connect.deposits.failed', { tx_hash, reason: 'blockchain_reorg' });
        stopMonitoring(session_id);
        return;
      }

      if (confirmations >= required_confirmations) {
        logger.info('EVM deposit confirmed', { session_id, tx_hash, confirmations, required: required_confirmations, network, amount });
        await updateSessionStatus(session_id, SessionStatus.COMPLETED);
        await recordConfirmedDeposit(session.organization_id, session.user_id, amount);
        await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', { tx_hash, from_address: from, amount, network, confirmations, deposit_address: session.deposit_address });
        stopMonitoring(session_id);
        await deregisterAddress(session_id);
      } else {
        logger.info('EVM confirmations pending', { session_id, tx_hash, confirmations, required: required_confirmations });
        setTimeout(poll, 15_000);
      }
    } catch (err: any) {
      logger.error('Error in confirmation monitor', { session_id, error: err.message });
      setTimeout(poll, 15_000);
    }
  };

  setTimeout(poll, 15_000);
}

async function startSolanaMonitoring(session_id: string, deposit_address: string, session: any) {
  const { PublicKey } = await import('@solana/web3.js');
  const connection = getMonitoringConnection();
  const pubkey = new PublicKey(deposit_address);
  const requiredSlots = getRequiredSlots();

  logger.info('Solana monitoring initialised', { session_id, deposit_address, required_slots: requiredSlots });

  const subscriptionId = connection.onAccountChange(pubkey, async (_info, context) => {
    logger.info('Solana account change detected', { session_id, slot: context.slot });
    await dispatchWebhookEvent(session_id, 'connect.deposits.detected', { network: Chain.SOLANA, slot: context.slot });

    const confirm = async () => {
      const currentSlot = await connection.getSlot('finalized');
      const slotDiff = currentSlot - context.slot;
      if (slotDiff >= requiredSlots) {
        logger.info('Solana deposit confirmed', { session_id, slot: context.slot, current_slot: currentSlot, required_slots: requiredSlots });
        await updateSessionStatus(session_id, SessionStatus.COMPLETED);
        await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', { network: Chain.SOLANA, slot: context.slot, confirmations: requiredSlots });
        connection.removeAccountChangeListener(subscriptionId);
        activeMonitors.delete(session_id);
      } else {
        logger.info('Solana slots pending', { session_id, slot_diff: slotDiff, required_slots: requiredSlots });
        setTimeout(confirm, 2_000);
      }
    };
    confirm();
  }, { commitment: 'confirmed' });

  activeMonitors.set(session_id, { stop: () => connection.removeAccountChangeListener(subscriptionId) });
}

export function stopMonitoring(session_id: string) {
  const monitor = activeMonitors.get(session_id);
  if (monitor) {
    monitor.stop();
    activeMonitors.delete(session_id);
    logger.info('Monitoring stopped', { session_id });
  }
}

export function getActiveMonitorCount() {
  return activeMonitors.size;
}
