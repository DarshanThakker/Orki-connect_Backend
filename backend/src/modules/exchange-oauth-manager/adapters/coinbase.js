/**
 * Coinbase Advanced Trade API — OAuth Adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Apply for credentials: developer.coinbase.com
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios from 'axios';
const BASE_URL = 'https://api.coinbase.com';
const AUTH_URL = 'https://www.coinbase.com/oauth/authorize';
const TOKEN_URL = 'https://api.coinbase.com/oauth/token';
const CLIENT_ID = process.env.COINBASE_CLIENT_ID;
const CLIENT_SECRET = process.env.COINBASE_CLIENT_SECRET;
const REDIRECT_URI = process.env.COINBASE_REDIRECT_URI;
export function buildAuthUrl(session_id) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'wallet:accounts:read wallet:withdrawals:create wallet:user:read',
        state: session_id,
        account: 'all',
    });
    return `${AUTH_URL}?${params.toString()}`;
}
export async function exchangeCode(authorization_code) {
    const response = await axios.post(TOKEN_URL, {
        grant_type: 'authorization_code',
        code: authorization_code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
    });
    return response.data;
}
export async function getAccountProfile(access_token) {
    const response = await axios.get(`${BASE_URL}/v2/user`, {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    return {
        account_holder_name: response.data.data.name,
        email: response.data.data.email,
    };
}
export async function getDepositAddress(access_token) {
    const response = await axios.get(`${BASE_URL}/v2/accounts`, {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    const usdcAccount = response.data.data.find((a) => a.currency?.code === 'USDC');
    return usdcAccount?.primary_address || null;
}
export async function getWithdrawalFee(access_token, asset) {
    return 1.00; // USD
}
export async function initiateWithdrawal({ access_token, asset, amount, destination_address }) {
    const accountsRes = await axios.get(`${BASE_URL}/v2/accounts`, {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    const account = accountsRes.data.data.find((a) => a.currency?.code === asset);
    if (!account)
        throw new Error(`No ${asset} account found on Coinbase`);
    const withdrawalRes = await axios.post(`${BASE_URL}/v2/accounts/${account.id}/withdrawals`, { type: 'crypto', amount, currency: asset, crypto_address: destination_address }, { headers: { Authorization: `Bearer ${access_token}` } });
    return {
        id: withdrawalRes.data.data.id,
        tx_hash: withdrawalRes.data.data.network?.hash || null,
    };
}
//# sourceMappingURL=coinbase.js.map