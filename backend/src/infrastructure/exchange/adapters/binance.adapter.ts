import axios from 'axios';
import { config } from '../../../config';

const BASE_URL = 'https://api.binance.com';
const AUTH_URL = 'https://accounts.binance.com/en/oauth/authorize';
const TOKEN_URL = 'https://accounts.binance.com/oauth/token';

export function buildAuthUrl(session_id: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.binance.clientId,
    redirect_uri: config.binance.redirectUri,
    scope: 'user:openId,user:name,user:withdraw',
    state: session_id,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const response = await axios.post(
    TOKEN_URL,
    new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.binance.clientId, client_secret: config.binance.clientSecret, redirect_uri: config.binance.redirectUri }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data;
}

export async function getAccountProfile(access_token: string) {
  const response = await axios.get(`${BASE_URL}/v1/openapi/v1/user/info`, { headers: { Authorization: `Bearer ${access_token}` } });
  return { account_holder_name: response.data.name || response.data.realName, email: response.data.email };
}

export async function getDepositAddress(access_token: string) {
  const response = await axios.get(`${BASE_URL}/sapi/v1/capital/deposit/address`, { headers: { Authorization: `Bearer ${access_token}` }, params: { coin: 'USDC', network: 'ETH' } });
  return response.data.address;
}

export async function getWithdrawalFee(access_token: string, asset: string): Promise<number> {
  const response = await axios.get(`${BASE_URL}/sapi/v1/capital/config/getall`, { headers: { Authorization: `Bearer ${access_token}` } });
  const coin = response.data.find((c: any) => c.coin === asset);
  const network = coin?.networkList?.find((n: any) => n.network === 'ETH');
  return parseFloat(network?.withdrawFee || '1.00');
}

export async function initiateWithdrawal({ access_token, asset, amount, destination_address }: { access_token: string; asset: string; amount: string; destination_address: string }) {
  const response = await axios.post(
    `${BASE_URL}/sapi/v1/capital/withdraw/apply`,
    { coin: asset, address: destination_address, amount, network: 'ETH' },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return { id: response.data.id, tx_hash: null };
}
