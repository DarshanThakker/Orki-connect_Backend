import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { RiskResult } from '../../domain/shared/types';

const ELLIPTIC_BASE_URL = 'https://aml.elliptic.co/v2';

const HIGH_RISK_CATEGORIES = ['sanctions', 'darknet_market', 'stolen_funds', 'mixer', 'ransomware', 'scam', 'terrorist_financing'];

export async function screenAddress(session_id: string, address: string): Promise<RiskResult> {
  if (!config.elliptic.isLive) return mockScreen(session_id, address);

  try {
    const response = await axios.post(
      `${ELLIPTIC_BASE_URL}/wallet/synchronous`,
      { subject: { asset: 'holistic', type: 'address', blockchain_info: { address } }, type: 'wallet_exposure', customer_reference: session_id },
      { headers: { 'x-elliptic-api-key': config.elliptic.apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return parseResponse(session_id, address, response.data);
  } catch (err: any) {
    logger.error('Elliptic API call failed', { session_id, address, error: err.message });
    return { status: 'UNKNOWN', risk_score: null, flags: ['elliptic_api_error'], error: err.message };
  }
}

function parseResponse(session_id: string, address: string, raw: any): RiskResult {
  const riskScore = raw.risk_score || 0;
  const highRiskFlags = (raw.exposures || [])
    .filter((e: any) => HIGH_RISK_CATEGORIES.includes(e.category) && e.value > 0)
    .map((e: any) => e.category);

  const status = highRiskFlags.length > 0 ? 'HIGH' : 'ACCEPTABLE';
  logger.info('Elliptic screening result', { session_id, address, status, risk_score: riskScore });
  return { status, risk_score: riskScore, flags: highRiskFlags };
}

function mockScreen(session_id: string, address: string): RiskResult {
  logger.warn('Using MOCK Elliptic risk screen — DO NOT USE IN PRODUCTION', { session_id });
  if (address.toUpperCase().endsWith('FLAGGED')) {
    return { status: 'HIGH', risk_score: 95, flags: ['darknet_market'], mock: true };
  }
  return { status: 'ACCEPTABLE', risk_score: 2, flags: [], mock: true };
}
