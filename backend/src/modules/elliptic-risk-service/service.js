/**
 * MODULE 08 — Elliptic Risk Service
 * ─────────────────────────────────────────────────────────────────────────────
 * AML risk screening for wallet addresses.
 * Checks against: sanctions lists, darknet markets, known hacks, mixers.
 *
 * ⚠️  Apply for Elliptic API key NOW: sales@elliptic.co
 *     Build with MOCK_MODE=true while waiting for provisioning.
 *
 * Risk: MEDIUM — requires Elliptic API key
 * Dependencies: Elliptic API key
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios from 'axios';
import { logger } from '../../utils/logger.js';
const ELLIPTIC_API_KEY = process.env.ELLIPTIC_API_KEY;
const ELLIPTIC_BASE_URL = 'https://aml.elliptic.co/v2';
const MOCK_MODE = !ELLIPTIC_API_KEY || process.env.ELLIPTIC_MOCK === 'true';
// ─── Risk Categories ──────────────────────────────────────────────────────────
export var RiskStatus;
(function (RiskStatus) {
    RiskStatus["ACCEPTABLE"] = "ACCEPTABLE";
    RiskStatus["HIGH"] = "HIGH";
    RiskStatus["UNKNOWN"] = "UNKNOWN";
})(RiskStatus || (RiskStatus = {}));
const HIGH_RISK_CATEGORIES = [
    'sanctions',
    'darknet_market',
    'stolen_funds',
    'mixer',
    'ransomware',
    'scam',
    'terrorist_financing',
];
/**
 * Screens a wallet address against Elliptic AML database.
 */
export async function screenWalletAddress(session_id, address) {
    if (MOCK_MODE) {
        return mockRiskScreen(session_id, address);
    }
    try {
        const response = await axios.post(`${ELLIPTIC_BASE_URL}/wallet/synchronous`, {
            subject: {
                asset: 'holistic',
                type: 'address',
                blockchain_info: { address },
            },
            type: 'wallet_exposure',
            customer_reference: session_id,
        }, {
            headers: {
                'x-elliptic-api-key': ELLIPTIC_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        return parseEllipticResponse(session_id, address, response.data);
    }
    catch (err) {
        logger.error('Elliptic API call failed', { session_id, address, error: err.message });
        return {
            status: RiskStatus.UNKNOWN,
            risk_score: null,
            flags: ['elliptic_api_error'],
            error: err.message,
        };
    }
}
/**
 * Parses Elliptic API response into a normalized risk result.
 */
function parseEllipticResponse(session_id, address, rawResponse) {
    const riskScore = rawResponse.risk_score || 0;
    const exposures = rawResponse.exposures || [];
    const highRiskFlags = exposures
        .filter((e) => HIGH_RISK_CATEGORIES.includes(e.category) && e.value > 0)
        .map((e) => ({ category: e.category, value: e.value, percentage: e.percentage }));
    const status = highRiskFlags.length > 0 ? RiskStatus.HIGH : RiskStatus.ACCEPTABLE;
    const result = {
        status,
        risk_score: riskScore,
        flags: highRiskFlags.map((f) => f.category),
        high_risk_exposures: highRiskFlags,
        address,
    };
    logger.info('Elliptic screening result', {
        session_id,
        address,
        status,
        risk_score: riskScore,
        flags: result.flags,
    });
    return result;
}
/**
 * Mock risk screener for development.
 */
function mockRiskScreen(session_id, address) {
    logger.warn('Using MOCK Elliptic risk screen — DO NOT USE IN PRODUCTION', { session_id });
    if (address.toUpperCase().endsWith('FLAGGED')) {
        return {
            status: RiskStatus.HIGH,
            risk_score: 95,
            flags: ['darknet_market'],
            mock: true,
        };
    }
    return {
        status: RiskStatus.ACCEPTABLE,
        risk_score: 2,
        flags: [],
        mock: true,
    };
}
//# sourceMappingURL=service.js.map