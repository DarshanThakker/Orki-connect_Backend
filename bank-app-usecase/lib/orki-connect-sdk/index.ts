
//orki-connect-sdk/src/index.ts

import { Linking } from "react-native";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";

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

export class OrkiConnect {
  private connection: Connection;
  private redirectScheme: string;
  private walletPubKey: string | null = null;

  constructor(options: SDKOptions) {
    this.connection = new Connection(
      clusterApiUrl(options.network || "devnet")
    );
    this.redirectScheme = options.redirectScheme;
  }

  /** Connect to wallet via deep link */
  async connect(wallet: WalletInfo): Promise<string> {
    return new Promise((resolve, reject) => {
      const listener = Linking.addEventListener("url", (event) => {
        listener.remove();
        const params = new URL(event.url).searchParams;
        const pubKey = params.get("public_key");
        if (pubKey) {
          this.walletPubKey = pubKey;
          resolve(pubKey);
        } else {
          reject("Failed to get public key");
        }
      });

      const deepLink = wallet.scheme.replace(
        "{redirect}",
        encodeURIComponent(this.redirectScheme)
      );
      Linking.openURL(deepLink).catch((err) => reject(err));
    });
  }

  /** Get wallet balance in SOL */
  async getBalance(): Promise<number> {
    if (!this.walletPubKey) throw new Error("Wallet not connected");
    const pubKey = new PublicKey(this.walletPubKey);
    const lamports = await this.connection.getBalance(pubKey);
    return lamports / 1e9;
  }

  /** Transfer SOL from wallet to bank bridge address */
  async transferToBank(
    recipient: string,
    amount: number
  ): Promise<TransactionResult> {
    if (!this.walletPubKey) return { error: "Wallet not connected" };

    try {
      const fromPubKey = new PublicKey(this.walletPubKey);
      const toPubKey = new PublicKey(recipient);
      const lamports = amount * 1e9;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromPubKey,
          toPubkey: toPubKey,
          lamports,
        })
      );

      transaction.recentBlockhash = (
        await this.connection.getRecentBlockhash()
      ).blockhash;
      transaction.feePayer = fromPubKey;

      const base64Tx = transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      return new Promise((resolve) => {
        const listener = Linking.addEventListener("url", async (event) => {
          listener.remove();
          const params = new URL(event.url).searchParams;
          const signedBase64 = params.get("signature");

          if (!signedBase64)
            return resolve({ error: "User rejected transaction" });

          const signedTx = Transaction.from(
            Buffer.from(signedBase64, "base64")
          );
          const txid = await this.connection.sendRawTransaction(
            signedTx.serialize()
          );
          resolve({ txid });
        });

        const signUrl = `phantom://v1/signTransaction?transaction=${base64Tx}&redirect_link=${encodeURIComponent(
          this.redirectScheme
        )}`;
        Linking.openURL(signUrl).catch((err) =>
          resolve({ error: String(err) })
        );
      });
    } catch (err) {
      return { error: String(err) };
    }
  }

  /** Full deposit flow: connect → check balance → transfer */
  async deposit(
    wallet: WalletInfo,
    amount: number,
    bankAddress: string
  ): Promise<TransactionResult> {
    try {
      await this.connect(wallet);

      const balance = await this.getBalance();
      if (balance < amount) return { error: "Insufficient funds" };

      return await this.transferToBank(bankAddress, amount);
    } catch (err) {
      return { error: String(err) };
    }
  }
}

export { OrkiConnectModal } from "./ui/OrkiConnectModal";