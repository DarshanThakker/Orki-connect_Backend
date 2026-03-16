
//orki-connect-sdk/src/index.ts

import 'react-native-get-random-values'; // required before tweetnacl for CSPRNG on React Native
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { Linking, AppState } from "react-native";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { Environment, setEnvironment, getEnvConfig } from './config';

export type WalletType = "phantom" | "metamask" | "coinbase" | "trust";

export interface WalletInfo {
  id: WalletType;
  name: string;
  scheme: string;
  icon?: string;
}

export interface SDKOptions {
  /** "mainnet" or "testnet" (maps to mainnet-beta / devnet for Solana). Defaults to "mainnet". */
  network?: Environment;
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
  /** Token contract address (EVM) or mint address (Solana). */
  mint: string;
  decimals: number;
  /** EVM chain ID — presence signals an EVM transfer; absent means Solana. */
  chainId?: number;
}

export class OrkiConnect {
  private connection: Connection;
  public readonly network: Environment;
  /** Solana-specific cluster string derived from network environment. */
  private readonly solanaCluster: "devnet" | "mainnet-beta";
  private redirectScheme: string;
  private appUrl: string;
  private walletPubKey: string | null = null;
  private sharedSecret: Uint8Array | null = null;
  private dappKeypair: nacl.BoxKeyPair | null = null;
  /** Phantom session token — pass this back on subsequent deeplink requests (SignTransaction, SignMessage) */
  public session: string | null = null;

  constructor(options: SDKOptions) {
    this.network = options.network ?? "mainnet";
    setEnvironment(this.network);
    this.solanaCluster = this.network === "mainnet" ? "mainnet-beta" : "devnet";
    this.connection = new Connection(clusterApiUrl(this.solanaCluster));
    this.redirectScheme = options.redirectScheme;
    this.appUrl = options.appUrl || options.redirectScheme;
  }

  /** Connect to wallet via deep link. Routes to Phantom encrypted flow or generic flow. */
  async connect(wallet: WalletInfo): Promise<string> {
    if (wallet.id === 'phantom') {
      return this.connectPhantom();
    }
    return this.connectSimple(wallet);
  }

  /** Phantom connect using the official encrypted deep link protocol */
  private connectPhantom(): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      // Match the full redirect URL (not just scheme) so exp:// internal links are filtered out
      const redirectPrefix = this.redirectScheme;

      // Generate a fresh x25519 keypair for this session
      this.dappKeypair = nacl.box.keyPair();
      const dappEncryptionPublicKey = bs58.encode(this.dappKeypair.publicKey);

      const cleanup = () => {
        urlListener.remove();
        appStateListener.remove();
      };

      const handleUrl = (urlStr: string) => {
        if (settled || !urlStr.startsWith(redirectPrefix)) return;

        // Handle Phantom error response
        if (urlStr.includes('errorCode=')) {
          settled = true;
          cleanup();
          const msgMatch = urlStr.match(/errorMessage=([^&]+)/);
          reject(new Error(msgMatch ? decodeURIComponent(msgMatch[1]) : 'Phantom rejected the connection'));
          return;
        }

        settled = true;
        cleanup();

        try {
          const phantomPubKeyMatch = urlStr.match(/phantom_encryption_public_key=([^&]+)/);
          const nonceMatch = urlStr.match(/nonce=([^&]+)/);
          const dataMatch = urlStr.match(/[?&]data=([^&]+)/);

          if (!phantomPubKeyMatch || !nonceMatch || !dataMatch || !this.dappKeypair) {
            reject(new Error('Missing required params in Phantom callback'));
            return;
          }

          const phantomPublicKey = bs58.decode(decodeURIComponent(phantomPubKeyMatch[1]));
          const nonce = bs58.decode(decodeURIComponent(nonceMatch[1]));
          const encryptedData = bs58.decode(decodeURIComponent(dataMatch[1]));

          // Derive shared secret via Diffie-Hellman
          this.sharedSecret = nacl.box.before(phantomPublicKey, this.dappKeypair.secretKey);

          // Decrypt the response payload
          const decryptedBytes = nacl.box.open.after(encryptedData, nonce, this.sharedSecret);
          if (!decryptedBytes) {
            reject(new Error('Failed to decrypt Phantom response'));
            return;
          }

          const decrypted: { public_key: string; session: string } = JSON.parse(
            Buffer.from(decryptedBytes).toString('utf-8')
          );

          this.walletPubKey = decrypted.public_key;
          this.session = decrypted.session;
          resolve(decrypted.public_key);
        } catch (e) {
          reject(new Error('Failed to process Phantom callback'));
        }
      };

      // Primary: fires when app is foregrounded via deep link (Android + backgrounded iOS)
      const urlListener = Linking.addEventListener("url", (event) => {
        handleUrl(event.url || "");
      });

      // Fallback: iOS may kill the app; on re-launch getInitialURL has the callback URL
      const appStateListener = AppState.addEventListener("change", async (state) => {
        if (state === "active" && !settled) {
          const url = await Linking.getInitialURL();
          if (url) handleUrl(url);
        }
      });

      // Build Phantom universal link connect URL with all required params
      const params = new URLSearchParams({
        app_url: this.appUrl,
        dapp_encryption_public_key: dappEncryptionPublicKey,
        redirect_link: this.redirectScheme,
        cluster: this.solanaCluster,
      });

      Linking.openURL(`https://phantom.app/ul/v1/connect?${params.toString()}`).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  /** Generic connect for non-Phantom wallets via custom scheme deep link */
  private connectSimple(wallet: WalletInfo): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const redirectPrefix = this.redirectScheme;

      const cleanup = () => {
        urlListener.remove();
        appStateListener.remove();
      };

      const handleUrl = (urlStr: string) => {
        if (settled || !urlStr.startsWith(redirectPrefix)) return;
        settled = true;
        cleanup();
        try {
          const match = urlStr.match(/(?:public_key|address)=([^&]+)/);
          const pubKey = match ? decodeURIComponent(match[1]) : null;
          if (pubKey) {
            this.walletPubKey = pubKey;
            resolve(pubKey);
          } else {
            reject(new Error('Failed to get public key from wallet return URL'));
          }
        } catch (e) {
          reject(new Error('Failed to parse return URL'));
        }
      };

      const urlListener = Linking.addEventListener("url", (event) => {
        handleUrl(event.url || "");
      });

      const appStateListener = AppState.addEventListener("change", async (state) => {
        if (state === "active" && !settled) {
          const url = await Linking.getInitialURL();
          if (url) handleUrl(url);
        }
      });

      const deepLink = wallet.scheme.replace(
        "{redirect}",
        encodeURIComponent(this.redirectScheme)
      );

      Linking.openURL(deepLink).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  /** Get wallet SOL balance */
  async getBalance(): Promise<number> {
    if (!this.walletPubKey) throw new Error("Wallet not connected");
    const pubKey = new PublicKey(this.walletPubKey);
    const lamports = await this.connection.getBalance(pubKey);
    return lamports / 1e9;
  }

  /** Get SPL token balance for a given mint address */
  async getTokenBalance(mint: string): Promise<number> {
    if (!this.walletPubKey) throw new Error("Wallet not connected");
    const owner = new PublicKey(this.walletPubKey);
    const mintKey = new PublicKey(mint);
    const accounts = await this.connection.getParsedTokenAccountsByOwner(owner, { mint: mintKey });
    if (accounts.value.length === 0) return 0;
    return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0;
  }

  /** Get balances for all supported Solana tokens in the active environment. */
  async getTokenBalances(): Promise<TokenBalance[]> {
    const { tokens } = getEnvConfig('SOLANA');
    const results: TokenBalance[] = [];
    for (const [symbol, info] of Object.entries(tokens)) {
      try {
        const balance = await this.getTokenBalance(info.address);
        results.push({ symbol, mint: info.address, balance });
      } catch {
        results.push({ symbol, mint: info.address, balance: 0 });
      }
    }
    return results;
  }

  /**
   * Transfer SOL or SPL token from wallet to recipient via Phantom SignTransaction deep link.
   * Pass `token` to send an SPL token (USDC, USDT, PYUSD); omit for SOL.
   */
  async transferToBank(
    recipient: string,
    amount: number,
    token?: TokenInfo
  ): Promise<TransactionResult> {
    if (!this.walletPubKey) return { error: "Wallet not connected" };

    if (token?.chainId) {
      return this.transferEvm(recipient, amount, token as TokenInfo & { chainId: number });
    }

    if (!this.sharedSecret || !this.dappKeypair || !this.session) {
      return { error: "Phantom session not established — please reconnect" };
    }

    try {
      const fromPubKey = new PublicKey(this.walletPubKey);
      const toPubKey = new PublicKey(recipient);

      const transaction = new Transaction();

      if (token) {
        // SPL token transfer — lazy require so Buffer polyfill runs first
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getAssociatedTokenAddress, createTransferCheckedInstruction } =
          require('@solana/spl-token') as typeof import('@solana/spl-token');

        const mintPubKey = new PublicKey(token.mint);
        const senderAta = await getAssociatedTokenAddress(mintPubKey, fromPubKey);
        const recipientAta = await getAssociatedTokenAddress(mintPubKey, toPubKey);
        const tokenAmount = BigInt(Math.round(amount * Math.pow(10, token.decimals)));

        transaction.add(
          createTransferCheckedInstruction(
            senderAta,
            mintPubKey,
            recipientAta,
            fromPubKey,
            tokenAmount,
            token.decimals
          )
        );
      } else {
        // Native SOL transfer
        const lamports = Math.round(amount * 1e9);
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: fromPubKey,
            toPubkey: toPubKey,
            lamports,
          })
        );
      }

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubKey;

      // Serialize transaction as base58 (Phantom requirement)
      const serializedTx = transaction.serialize({ requireAllSignatures: false });
      const base58Tx = bs58.encode(serializedTx);

      // Encrypt the payload { transaction, session } with the shared secret
      const payloadNonce = nacl.randomBytes(24);
      const payloadBytes = Buffer.from(JSON.stringify({ transaction: base58Tx, session: this.session }), 'utf-8');
      const encryptedPayload = nacl.box.after(payloadBytes, payloadNonce, this.sharedSecret);

      return new Promise((resolve) => {
        let settled = false;
        const redirectPrefix = this.redirectScheme.split('://')[0] + '://';

        const cleanup = () => {
          listener.remove();
          appStateListener.remove();
        };

        const handleUrl = (urlStr: string) => {
          if (settled || !urlStr.startsWith(redirectPrefix)) return;

          if (urlStr.includes('errorCode=')) {
            settled = true;
            cleanup();
            const msgMatch = urlStr.match(/errorMessage=([^&]+)/);
            resolve({ error: msgMatch ? decodeURIComponent(msgMatch[1]) : 'User rejected transaction' });
            return;
          }

          settled = true;
          cleanup();

          try {
            const nonceMatch = urlStr.match(/nonce=([^&]+)/);
            const dataMatch = urlStr.match(/[?&]data=([^&]+)/);

            if (!nonceMatch || !dataMatch) {
              resolve({ error: 'Missing response params from Phantom' });
              return;
            }

            const responseNonce = bs58.decode(decodeURIComponent(nonceMatch[1]));
            const encryptedData = bs58.decode(decodeURIComponent(dataMatch[1]));

            // Decrypt the signed transaction response
            const decryptedBytes = nacl.box.open.after(encryptedData, responseNonce, this.sharedSecret!);
            if (!decryptedBytes) {
              resolve({ error: 'Failed to decrypt Phantom sign response' });
              return;
            }

            const decrypted: { transaction: string } = JSON.parse(
              Buffer.from(decryptedBytes).toString('utf-8')
            );

            // Deserialize and broadcast the signed transaction
            const signedTxBytes = bs58.decode(decrypted.transaction);
            const signedTx = Transaction.from(signedTxBytes);

            this.connection.sendRawTransaction(signedTx.serialize()).then((txid) => {
              resolve({ txid });
            }).catch((err) => {
              resolve({ error: String(err) });
            });
          } catch (e) {
            resolve({ error: 'Failed to process Phantom sign response' });
          }
        };

        const listener = Linking.addEventListener("url", (event) => {
          handleUrl(event.url || "");
        });

        const appStateListener = AppState.addEventListener("change", async (state) => {
          if (state === "active" && !settled) {
            const url = await Linking.getInitialURL();
            if (url) handleUrl(url);
          }
        });

        // Build Phantom SignTransaction URL
        const params = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(this.dappKeypair!.publicKey),
          nonce: bs58.encode(payloadNonce),
          redirect_link: this.redirectScheme,
          payload: bs58.encode(encryptedPayload),
        });

        Linking.openURL(`https://phantom.app/ul/v1/signTransaction?${params.toString()}`).catch((err) => {
          cleanup();
          resolve({ error: String(err) });
        });
      });
    } catch (err) {
      return { error: String(err) };
    }
  }

  /**
   * EVM token transfer via EIP-681 URI (ethereum:<contract>@<chainId>/transfer?...).
   * Opens the connected wallet for the user to sign; resolves when app is foregrounded again.
   * Note: txid is not available via this deep-link path — use WalletConnect for full receipts.
   */
  private transferEvm(
    recipient: string,
    amount: number,
    token: TokenInfo & { chainId: number }
  ): Promise<TransactionResult> {
    const rawAmount = BigInt(Math.round(amount * Math.pow(10, token.decimals))).toString();
    const uri = `ethereum:${token.mint}@${token.chainId}/transfer?address=${recipient}&uint256=${rawAmount}`;

    return new Promise((resolve) => {
      let settled = false;

      const appStateListener = AppState.addEventListener('change', (state) => {
        if (state === 'active' && !settled) {
          settled = true;
          appStateListener.remove();
          resolve({ txid: 'submitted' });
        }
      });

      Linking.openURL(uri).catch((err) => {
        if (!settled) {
          settled = true;
          appStateListener.remove();
          resolve({ error: String(err) });
        }
      });
    });
  }

  /** Full deposit flow: connect → check balance → transfer */
  async deposit(
    wallet: WalletInfo,
    amount: number,
    bankAddress: string,
    token?: TokenInfo
  ): Promise<TransactionResult> {
    try {
      await this.connect(wallet);

      if (token) {
        const balance = await this.getTokenBalance(token.mint);
        if (balance < amount) return { error: "Insufficient token balance" };
      } else {
        const balance = await this.getBalance();
        if (balance < amount) return { error: "Insufficient funds" };
      }

      return await this.transferToBank(bankAddress, amount, token);
    } catch (err) {
      return { error: String(err) };
    }
  }
}

export { OrkiConnectModal } from "./ui/OrkiConnectModal";

export const evm = {
  mainnet: "mainnet" as Environment,
  testnet: "testnet" as Environment,
};

export const solana = {
  mainnet:  "mainnet" as Environment,
  devnet:   "testnet" as Environment,
  testnet:  "testnet" as Environment,
};
