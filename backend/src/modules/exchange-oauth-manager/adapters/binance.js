/**
 * Binance Open API — OAuth Adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Apply for credentials: binance.com/en/developers
 * ⚠️  Binance has the longest approval time of all integrations. Apply Day 1.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios from 'axios';
const BASE_URL = 'https://api.binance.com';
const AUTH_URL = 'https://accounts.binance.com/en/oauth/authorize';
const TOKEN_URL = 'https://accounts.binance.com/oauth/token';
const CLIENT_ID = process.env.BINANCE_CLIENT_ID;
const CLIENT_SECRET = process.env.BINANCE_CLIENT_SECRET;
const REDIRECT_URI = process.env.BINANCE_REDIRECT_URI;
export function buildAuthUrl(session_id) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'user:openId,user:name,user:withdraw',
        state: session_id,
    });
    return `${AUTH_URL}?${params.toString()}`;
}
export async function exchangeCode(authorization_code) {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorization_code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return response.data;
}
export async function getAccountProfile(access_token) {
    const response = await axios.get(`${BASE_URL}/v1/openapi/v1/user/info`, {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    return {
        account_holder_name: response.data.name || response.data.realName,
        email: response.data.email,
    };
}
export async function getDepositAddress(access_token) {
    const response = await axios.get(`${BASE_URL}/sapi/v1/capital/deposit/address`, {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { coin: 'USDC', network: 'ETH' },
    });
    return response.data.address;
}
export async function getWithdrawalFee(access_token, asset) {
    const response = await axios.get(`${BASE_URL}/sapi/v1/capital/config/getall`, {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    const coin = response.data.find((c) => c.coin === asset);
    const network = coin?.networkList?.find((n) => n.network === 'ETH');
    return parseFloat(network?.withdrawFee || '1.00');
}
export async function initiateWithdrawal({ access_token, asset, amount, destination_address }) {
    const response = await axios.post(`${BASE_URL}/sapi/v1/capital/withdraw/apply`, {
        coin: asset,
        address: destination_address,
        amount,
        network: 'ETH',
    }, { headers: { Authorization: `Bearer ${access_token}` } });
    return {
        id: response.data.id,
        tx_hash: null, // Binance provides tx hash asynchronously
    };
}
//# sourceMappingURL=binance.js.map