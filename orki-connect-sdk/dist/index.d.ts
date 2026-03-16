import 'react-native-get-random-values';
export type WalletType = "phantom" | "metamask" | "coinbase" | "trust";
export interface WalletInfo {
    id: WalletType;
    name: string;
    scheme: string;
    icon?: string;
}
export interface SDKOptions {
    network?: "devnet" | "mainnet-beta";
    redirectScheme: string;
    /** HTTPS URL representing your app — stored in Phantom's session token for validation */
    appUrl?: string;
}
export interface TransactionResult {
    txid?: string;
    error?: string;
}
export interface TokenBalance {
    symbol: string;
    mint: string;
    balance: number;
}
export interface TokenInfo {
    mint: string;
    decimals: number;
}
/** Supported SPL token mints and decimals per network */
export declare const TOKEN_MINTS: Record<string, Record<string, TokenInfo>>;
export declare class OrkiConnect {
    private connection;
    private network;
    private redirectScheme;
    private appUrl;
    private walletPubKey;
    private sharedSecret;
    private dappKeypair;
    /** Phantom session token — pass this back on subsequent deeplink requests (SignTransaction, SignMessage) */
    session: string | null;
    constructor(options: SDKOptions);
    /** Connect to wallet via deep link. Routes to Phantom encrypted flow or generic flow. */
    connect(wallet: WalletInfo): Promise<string>;
    /** Phantom connect using the official encrypted deep link protocol */
    private connectPhantom;
    /** Generic connect for non-Phantom wallets via custom scheme deep link */
    private connectSimple;
    /** Get wallet SOL balance */
    getBalance(): Promise<number>;
    /** Get SPL token balance for a given mint address */
    getTokenBalance(mint: string): Promise<number>;
    /** Get balances for all supported tokens on the current network */
    getTokenBalances(network?: "devnet" | "mainnet-beta"): Promise<TokenBalance[]>;
    /**
     * Transfer SOL or SPL token from wallet to recipient via Phantom SignTransaction deep link.
     * Pass `token` to send an SPL token (USDC, USDT, PYUSD); omit for SOL.
     */
    transferToBank(recipient: string, amount: number, token?: TokenInfo): Promise<TransactionResult>;
    /** Full deposit flow: connect → check balance → transfer */
    deposit(wallet: WalletInfo, amount: number, bankAddress: string, token?: TokenInfo): Promise<TransactionResult>;
}
export { OrkiConnectModal } from "./ui/OrkiConnectModal";
