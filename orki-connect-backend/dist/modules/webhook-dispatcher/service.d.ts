/**
 * Main dispatch function. Called by ALL other services when an event occurs.
 */
export declare function dispatchWebhookEvent(session_id: string, event_name: string, event_data?: any): Promise<void>;
/**
 * Signs the webhook payload as an RS256 JWT.
 */
export declare function signWebhookPayload(payload: any): string;
/**
 * Exposes JWKS endpoint for client-side webhook signature verification.
 */
export declare function getJWKS(): {
    keys: {
        kty: string;
        use: string;
        alg: string;
        kid: string;
        n: string;
        e: string;
    }[];
};
/**
 * Returns delivery history for the client dashboard.
 */
export declare function getDeliveryHistory(params: {
    org_id: string;
    limit?: number;
}): Promise<{
    error: string | null;
    id: string;
    organization_id: string;
    created_at: Date;
    session_id: string;
    status: string;
    event: string;
    idempotency_key: string;
    payload: import("@prisma/client/runtime/client").JsonValue;
    http_status: number | null;
    response_time_ms: number | null;
    attempt: number;
}[]>;
//# sourceMappingURL=service.d.ts.map