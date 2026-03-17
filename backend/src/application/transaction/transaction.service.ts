import { SessionStatus } from '@prisma/client';
import { logger } from '../../utils/logger';
import { updateSession } from '../../infrastructure/database/repositories/session.repository';
import { confirmTransaction as evmConfirm, getConfirmationThreshold } from '../../infrastructure/blockchain/evm.provider';
import { confirmTransaction as solanaConfirm } from '../../infrastructure/blockchain/solana.provider';
import { updateSessionStatus } from '../session/session.service';
import { dispatchWebhookEvent } from '../webhook/webhook.service';

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
  const { session_id, tx_hash, network, token, user_id, deposit_address, amount } = params;

  // Save tx_hash synchronously — critical for session expiry safety
  await updateSession(session_id, { tx_hash, status: SessionStatus.ACTIVE });

  logger.info('[Transaction] tx_hash saved, starting async confirmation', { session_id, tx_hash, network });

  await dispatchWebhookEvent(session_id, 'connect.deposits.submitted', { tx_hash, amount, token, network, user_id, deposit_address });

  // Fire-and-forget
  runConfirmationAsync(params);
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
    const requiredConfirmations = network === 'SOLANA' ? 32 : getConfirmationThreshold(network);
    logger.info('Confirmation polling started', { session_id, tx_hash, network, required_confirmations: requiredConfirmations });
    try {
      if (network === 'SOLANA') {
        logger.info('Using Solana confirmation path', { session_id, tx_hash });
        await solanaConfirm(tx_hash);
      } else {
        logger.info('Using EVM confirmation path', { session_id, tx_hash, network });
        await evmConfirm(tx_hash, network);
      }

      await updateSessionStatus(session_id, SessionStatus.COMPLETED);
      await dispatchWebhookEvent(session_id, 'connect.deposits.confirmed', {
        tx_hash, amount, token, network, user_id, deposit_address,
        confirmations: requiredConfirmations,
      });

      logger.info('Deposit confirmed', { session_id, tx_hash, network, token, amount, confirmations: requiredConfirmations });
    } catch (err: any) {
      logger.error('Deposit confirmation failed', { session_id, tx_hash, network, error: err.message });
      await updateSessionStatus(session_id, SessionStatus.FAILED).catch(() => {});
      await dispatchWebhookEvent(session_id, 'connect.deposits.failed', { tx_hash, amount, token, network, user_id, deposit_address, error: err.message }).catch(() => {});
    }
  };

  poll();
}
