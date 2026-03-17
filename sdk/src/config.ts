// ─── Environment ──────────────────────────────────────────────────────────────

export type Environment = "mainnet" | "testnet";

export interface TokenConfig { address: string; decimals: number; }

export interface EnvConfig {
  rpcUrl: string;
  tokens: Record<string, TokenConfig>;
  /** EVM chain ID — present on EVM networks, absent on Solana. */
  chainId?: number;
}

export interface NetworkConfig {
  type: "evm" | "solana";
  mainnet: EnvConfig;
  testnet: EnvConfig;
}

// ─── Network / Token Config ───────────────────────────────────────────────────
// Single source of truth for all RPC endpoints and token addresses per network
// and environment. Add new networks or tokens here — nowhere else.

export const NETWORK_CONFIG = {
  ETH: {
    type: "evm" as const,
    mainnet: {
      rpcUrl: "https://eth.llamarpc.com",
      chainId: 1,
      tokens: {
        USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
        USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        DAI:  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      },
    },
    testnet: { // Sepolia
      rpcUrl: "https://rpc.sepolia.org",
      chainId: 11155111,
      tokens: {
        USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
        USDT: { address: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06", decimals: 6 },
        DAI:  { address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6", decimals: 18 },
      },
    },
  },
  BASE: {
    type: "evm" as const,
    mainnet: {
      rpcUrl: "https://mainnet.base.org",
      chainId: 8453,
      tokens: {
        USDC: { address: "0x833589fCD6eDb6E08f4c7b32c6f1De223AaFa956", decimals: 6 },
        USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
        DAI:  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
      },
    },
    testnet: { // Base Sepolia
      rpcUrl: "https://sepolia.base.org",
      chainId: 84532,
      tokens: {
        USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
        USDT: { address: "0x", decimals: 6 },
        DAI:  { address: "0x", decimals: 18 },
      },
    },
  },
  POLYGON: {
    type: "evm" as const,
    mainnet: {
      rpcUrl: "https://polygon-rpc.com",
      chainId: 137,
      tokens: {
        USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
        USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
        DAI:  { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
      },
    },
    testnet: { // Amoy
      rpcUrl: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      tokens: {
        USDC: { address: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582", decimals: 6 },
        USDT: { address: "0x", decimals: 6 },
        DAI:  { address: "0x", decimals: 18 },
      },
    },
  },
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
        USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
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
