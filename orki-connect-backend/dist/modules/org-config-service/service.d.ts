import { Organization } from '@prisma/client';
export declare const DEFAULT_CONFIG: {
    supported_tokens: string[];
    supported_chains: "ETHEREUM"[];
    connection_methods: "WALLET"[];
    compliance_mode: "LITE";
    min_per_transaction: number;
    max_per_transaction: number;
    daily_user_limit: number;
    session_timeout_minutes: number;
};
/**
 * Retrieves org record by client credentials.
 * Called by the OAuth Token Service to validate client_id + client_secret.
 */
export declare function getOrgByCredentials(client_id: string, client_secret: string): Promise<Organization | null>;
/**
 * Retrieves the full config for an organisation.
 */
export declare function getOrgConfig(organization_id: string): Promise<any>;
/**
 * Creates a new organisation. Called during Orki onboarding.
 */
export declare function createOrg(params: {
    organization_id: string;
    client_id: string;
    client_secret: string;
    webhook_url?: string;
    config?: any;
}): Promise<{
    id: string;
    organization_id: string;
    client_id: string;
    client_secret_hash: string;
    webhook_url: string | null;
    config: import("@prisma/client/runtime/client").JsonValue;
    created_at: Date;
    updated_at: Date;
}>;
/**
 * Updates org config fields. Validates all values before saving.
 */
export declare function updateOrgConfig(organization_id: string, updates: any): Promise<import("@prisma/client/runtime/client").JsonValue>;
//# sourceMappingURL=service.d.ts.map