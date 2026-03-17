import { Chain, ComplianceMode, ConnectionType } from '@prisma/client';

export interface OrgConfig {
  supported_tokens: string[];
  supported_chains: Chain[];
  connection_methods: ConnectionType[];
  compliance_mode: ComplianceMode;
  min_per_transaction: number;
  max_per_transaction: number;
  daily_user_limit: number;
  session_timeout_minutes: number;
  webhook_url?: string;
  /** Deposit address per chain — keyed by Chain enum value (SOLANA, ETHEREUM, POLYGON) */
  deposit_addresses?: Partial<Record<Chain, string>>;
}

export const DEFAULT_ORG_CONFIG: OrgConfig = {
  supported_tokens: ['USDC'],
  supported_chains: [Chain.ETHEREUM],
  connection_methods: [ConnectionType.WALLET],
  compliance_mode: ComplianceMode.LITE,
  min_per_transaction: 10,
  max_per_transaction: 50000,
  daily_user_limit: 100000,
  session_timeout_minutes: 30,
};
