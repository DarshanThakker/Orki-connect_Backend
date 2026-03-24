// ─── Environment ──────────────────────────────────────────────────────────────

export type Environment = "mainnet" | "testnet";

export interface TokenConfig { address: string; decimals: number; }

export interface EnvConfig {
  rpcUrl: string;
  tokens: Record<string, TokenConfig>;
  /** EVM chain ID — present for EVM networks, absent for Solana */
  chainId?: number;
}

export interface NetworkConfig {
  type: "solana";
  mainnet: EnvConfig;
  testnet: EnvConfig;
}

// ─── Network / Token Config ───────────────────────────────────────────────────
// Single source of truth for all RPC endpoints and token addresses per network
// and environment. Add new networks or tokens here — nowhere else.

export const NETWORK_CONFIG = {
  SOLANA: {
    type: "solana" as const,
    mainnet: {
      rpcUrl: "https://api.mainnet-beta.solana.com",
      tokens: {
        USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
        USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
      },
    },
    testnet: { // Devnet
      rpcUrl: "https://api.devnet.solana.com",
      tokens: {
        USDC: { address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
        USDT: { address: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUqqy6h6iejyybCP88", decimals: 6 },
      },
    },
  },
} satisfies Record<string, NetworkConfig>;

export type NetworkId = keyof typeof NETWORK_CONFIG;

// ─── Active Environment ────────────────────────────────────────────────────────
// Set once at SDK init time via setEnvironment(). All API calls read this value.

let _activeEnvironment: Environment = "mainnet";

export function setEnvironment(env: Environment): void {
  _activeEnvironment = env;
}

export function getActiveEnvironment(): Environment {
  return _activeEnvironment;
}

/** Returns the RPC URL and token list for the given network in the active environment. */
export function getEnvConfig(networkId: NetworkId): EnvConfig {
  return NETWORK_CONFIG[networkId][_activeEnvironment];
}
