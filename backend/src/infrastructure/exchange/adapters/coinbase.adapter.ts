import axios from 'axios';
import { config } from '../../../config';

const BASE_URL = 'https://api.coinbase.com';
const AUTH_URL = 'https://www.coinbase.com/oauth/authorize';
const TOKEN_URL = 'https://api.coinbase.com/oauth/token';

export function buildAuthUrl(session_id: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.coinbase.clientId,
    redirect_uri: config.coinbase.redirectUri,
    scope: 'wallet:accounts:read wallet:withdrawals:create wallet:user:read',
    state: session_id,
    account: 'all',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const response = await axios.post(TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    client_id: config.coinbase.clientId,
    client_secret: config.coinbase.clientSecret,
    redirect_uri: config.coinbase.redirectUri,
  });
  return response.data;
}

export async function getAccountProfile(access_token: string) {
  const response = await axios.get(`${BASE_URL}/v2/user`, { headers: { Authorization: `Bearer ${access_token}` } });
  return { account_holder_name: response.data.data.name, email: response.data.data.email };
}

export async function getDepositAddress(access_token: string) {
  const accountsRes = await axios.get(`${BASE_URL}/v2/accounts`, { headers: { Authorization: `Bearer ${access_token}` } });
  const usdcAccount = accountsRes.data.data.find((a: any) => a.currency?.code === 'USDC');
  if (!usdcAccount) return null;

  // Generate a deposit address via the Coinbase v2 addresses endpoint.
  // primary_address is not returned by the accounts list — this is the correct way.
  const addrRes = await axios.post(
    `${BASE_URL}/v2/accounts/${usdcAccount.id}/addresses`,
    {},
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return addrRes.data.data.address || null;
}

export async function getWithdrawalFee(_access_token: string, _asset: string): Promise<number> {
  return 1.00;
}

export async function initiateWithdrawal({ access_token, asset, amount, destination_address }: { access_token: string; asset: string; amount: string; destination_address: string }) {
  const accountsRes = await axios.get(`${BASE_URL}/v2/accounts`, { headers: { Authorization: `Bearer ${access_token}` } });
  const account = accountsRes.data.data.find((a: any) => a.currency?.code === asset);
  if (!account) throw new Error(`No ${asset} account found on Coinbase`);

  const res = await axios.post(
    `${BASE_URL}/v2/accounts/${account.id}/withdrawals`,
    { type: 'crypto', amount, currency: asset, crypto_address: destination_address },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return { id: res.data.data.id, tx_hash: res.data.data.network?.hash || null };
}
