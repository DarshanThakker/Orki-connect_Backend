import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { logger } from '../../utils/logger';
import { getSession, updateSessionStatus, SESSION_STATUS } from '../session/session.service';
import { dispatchWebhookEvent } from '../webhook/webhook.service';
import { screenAddress } from '../../infrastructure/risk/elliptic.provider';

const SIGN_MESSAGE = 'Sign to connect';

export function verifyEVMSignature(wallet_address: string, signature: string): boolean {
  try {
    return ethers.verifyMessage(SIGN_MESSAGE, signature).toLowerCase() === wallet_address.toLowerCase();
  } catch { return false; }
}

export function verifyEIP712Signature(wallet_address: string, signature: string, typedData: any): boolean {
  try {
    const { domain, types, value } = typedData;
    return ethers.verifyTypedData(domain, types, value, signature).toLowerCase() === wallet_address.toLowerCase();
  } catch { return false; }
}

export async function verifySolanaSignature(wallet_address: string, signature: string): Promise<boolean> {
  try {
    return nacl.sign.detached.verify(Buffer.from(SIGN_MESSAGE), bs58.decode(signature), bs58.decode(wallet_address));
  } catch { return false; }
}

export async function verifyWalletOwnership(params: {
  session_id: string;
  wallet_address: string;
  signature: string;
  wallet_type?: string;
  typed_data?: any;
}) {
  const { session_id, wallet_address, signature, wallet_type = 'generic', typed_data } = params;

  logger.info('Verifying wallet ownership', { session_id, wallet_address, wallet_type });
  const session = await getSession(session_id);

  let isValid: boolean;
  const sigMethod = session.network === 'SOLANA' ? 'solana' : wallet_type === 'ledger' && typed_data ? 'eip712' : 'evm';
  logger.info('Signature method selected', { session_id, network: session.network, sig_method: sigMethod });

  if (session.network === 'SOLANA') {
    isValid = await verifySolanaSignature(wallet_address, signature);
  } else if (wallet_type === 'ledger' && typed_data) {
    isValid = verifyEIP712Signature(wallet_address, signature, typed_data);
  } else {
    isValid = verifyEVMSignature(wallet_address, signature);
  }

  if (!isValid) {
    logger.warn('Wallet signature verification failed', { session_id, wallet_address, sig_method: sigMethod });
    throw Object.assign(new Error('Wallet signature verification failed'), { status: 401, code: 'SIGNATURE_INVALID' });
  }

  logger.info('Wallet signature verified — running AML screen', { session_id, wallet_address });

  const connection_id = `conn_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const risk = await screenAddress(session_id, wallet_address);
  logger.info('AML screen result', { session_id, wallet_address, risk_status: risk.status, risk_score: risk.risk_score, flags: risk.flags });

  if (risk.status === 'HIGH') {
    logger.warn('Wallet flagged by AML — session terminated', { session_id, wallet_address, flags: risk.flags });
    await updateSessionStatus(session_id, SESSION_STATUS.FAILED, { risk_flag: risk as any });
    await dispatchWebhookEvent(session_id, 'connect.connection.flagged', { risk_result: risk });
    return { connection_id, risk_status: 'FLAGGED' };
  }

  await updateSessionStatus(session_id, SESSION_STATUS.ACTIVE, { connection_id, wallet_address });
  await dispatchWebhookEvent(session_id, 'connect.connection.approved', { connection_id, wallet_address });
  logger.info('Wallet connected successfully', { session_id, wallet_address, connection_id });
  return { connection_id, risk_status: 'PASS' };
}
