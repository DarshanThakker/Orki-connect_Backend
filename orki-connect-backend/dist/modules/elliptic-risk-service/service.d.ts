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
export declare enum RiskStatus {
    ACCEPTABLE = "ACCEPTABLE",
    HIGH = "HIGH",
    UNKNOWN = "UNKNOWN"
}
/**
 * Screens a wallet address against Elliptic AML database.
 */
export declare function screenWalletAddress(session_id: string, address: string): Promise<{
    status: RiskStatus;
    risk_score: number;
    flags: string[];
    mock: boolean;
} | {
    status: RiskStatus;
    risk_score: any;
    flags: any;
    high_risk_exposures: any;
    address: string;
} | {
    status: RiskStatus;
    risk_score: null;
    flags: string[];
    error: any;
}>;
//# sourceMappingURL=service.d.ts.map