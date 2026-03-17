import { Chain } from '@prisma/client';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import {
  upsertDepositAddress,
  findDepositBySession,
  deleteDeposit,
} from '../../infrastructure/database/repositories/deposit.repository';

const VALIDATORS: Record<string, (addr: string) => boolean> = {
  [Chain.ETHEREUM]: (addr) => ethers.isAddress(addr),
  [Chain.POLYGON]: (addr) => ethers.isAddress(addr),
  [Chain.SOLANA]: (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr),
};

function validateAddress(address: string, network: Chain) {
  const validator = VALIDATORS[network];
  if (!validator) throw Object.assign(new Error(`Unsupported network: ${network}`), { status: 400, code: 'UNSUPPORTED_NETWORK' });
  if (!validator(address)) throw Object.assign(new Error(`Invalid ${network} address: ${address}`), { status: 400, code: 'INVALID_ADDRESS_FORMAT' });
}

export async function registerAddress(session_id: string, deposit_address: string, network: Chain) {
  validateAddress(deposit_address, network);
  const entry = await upsertDepositAddress(session_id, deposit_address, network);
  logger.info('Deposit address registered', { session_id, network, address: deposit_address });
  return entry;
}

export async function getAddressBySession(session_id: string) {
  return findDepositBySession(session_id);
}

export async function deregisterAddress(session_id: string) {
  const result = await deleteDeposit(session_id);
  if (result) logger.info('Deposit address deregistered', { session_id });
  return result;
}
