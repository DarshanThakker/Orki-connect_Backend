export type WalletType = "phantom" | "metamask" | "coinbase" | "trust";
export interface WalletInfo {
    id: WalletType;
    name: string;
    scheme: string;
}
export interface SDKOptions {
    network?: "devnet" | "mainnet-beta";
    redirectScheme: string;
}
export interface TransactionResult {
    txid?: string;
    error?: string;
}
export declare class OrkiConnect {
    private connection;
    private redirectScheme;
    private walletPubKey;
    constructor(options: SDKOptions);
    /** Connect to wallet via deep link */
    connect(wallet: WalletInfo): Promise<string>;
    /** Get wallet balance in SOL */
    getBalance(): Promise<number>;
    /** Transfer SOL from wallet to bank bridge address */
    transferToBank(recipient: string, amount: number): Promise<TransactionResult>;
    /** Full deposit flow: connect → check balance → transfer */
    deposit(wallet: WalletInfo, amount: number, bankAddress: string): Promise<TransactionResult>;
}
export { OrkiConnectModal } from "./ui/OrkiConnectModal";
