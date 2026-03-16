"use strict";
//orki-connect-sdk/src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrkiConnectModal = exports.OrkiConnect = exports.TOKEN_MINTS = void 0;
require("react-native-get-random-values"); // required before tweetnacl for CSPRNG on React Native
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const buffer_1 = require("buffer");
const react_native_1 = require("react-native");
const web3_js_1 = require("@solana/web3.js");
/** Supported SPL token mints and decimals per network */
exports.TOKEN_MINTS = {
    devnet: {
        USDC: { mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
        USDT: { mint: "PLACEHOLDER_DEVNET_USDT_MINT", decimals: 6 },
        PYUSD: { mint: "PLACEHOLDER_DEVNET_PYUSD_MINT", decimals: 6 },
    },
    "mainnet-beta": {
        USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
        USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
        PYUSD: { mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", decimals: 6 },
    },
};
class OrkiConnect {
    constructor(options) {
        this.walletPubKey = null;
        this.sharedSecret = null;
        this.dappKeypair = null;
        /** Phantom session token — pass this back on subsequent deeplink requests (SignTransaction, SignMessage) */
        this.session = null;
        this.network = options.network || "devnet";
        this.connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)(this.network));
        this.redirectScheme = options.redirectScheme;
        this.appUrl = options.appUrl || options.redirectScheme;
    }
    /** Connect to wallet via deep link. Routes to Phantom encrypted flow or generic flow. */
    async connect(wallet) {
        if (wallet.id === 'phantom') {
            return this.connectPhantom();
        }
        return this.connectSimple(wallet);
    }
    /** Phantom connect using the official encrypted deep link protocol */
    connectPhantom() {
        return new Promise((resolve, reject) => {
            let settled = false;
            const redirectPrefix = this.redirectScheme.split('://')[0] + '://';
            // Generate a fresh x25519 keypair for this session
            this.dappKeypair = tweetnacl_1.default.box.keyPair();
            const dappEncryptionPublicKey = bs58_1.default.encode(this.dappKeypair.publicKey);
            const cleanup = () => {
                urlListener.remove();
                appStateListener.remove();
            };
            const handleUrl = (urlStr) => {
                if (settled || !urlStr.startsWith(redirectPrefix))
                    return;
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
                    const phantomPublicKey = bs58_1.default.decode(decodeURIComponent(phantomPubKeyMatch[1]));
                    const nonce = bs58_1.default.decode(decodeURIComponent(nonceMatch[1]));
                    const encryptedData = bs58_1.default.decode(decodeURIComponent(dataMatch[1]));
                    // Derive shared secret via Diffie-Hellman
                    this.sharedSecret = tweetnacl_1.default.box.before(phantomPublicKey, this.dappKeypair.secretKey);
                    // Decrypt the response payload
                    const decryptedBytes = tweetnacl_1.default.box.open.after(encryptedData, nonce, this.sharedSecret);
                    if (!decryptedBytes) {
                        reject(new Error('Failed to decrypt Phantom response'));
                        return;
                    }
                    const decrypted = JSON.parse(buffer_1.Buffer.from(decryptedBytes).toString('utf-8'));
                    this.walletPubKey = decrypted.public_key;
                    this.session = decrypted.session;
                    resolve(decrypted.public_key);
                }
                catch (e) {
                    reject(new Error('Failed to process Phantom callback'));
                }
            };
            // Primary: fires when app is foregrounded via deep link (Android + backgrounded iOS)
            const urlListener = react_native_1.Linking.addEventListener("url", (event) => {
                handleUrl(event.url || "");
            });
            // Fallback: iOS may kill the app; on re-launch getInitialURL has the callback URL
            const appStateListener = react_native_1.AppState.addEventListener("change", async (state) => {
                if (state === "active" && !settled) {
                    const url = await react_native_1.Linking.getInitialURL();
                    if (url)
                        handleUrl(url);
                }
            });
            // Build Phantom universal link connect URL with all required params
            const params = new URLSearchParams({
                app_url: this.appUrl,
                dapp_encryption_public_key: dappEncryptionPublicKey,
                redirect_link: this.redirectScheme,
                cluster: this.network,
            });
            react_native_1.Linking.openURL(`https://phantom.app/ul/v1/connect?${params.toString()}`).catch((err) => {
                cleanup();
                reject(err);
            });
        });
    }
    /** Generic connect for non-Phantom wallets via custom scheme deep link */
    connectSimple(wallet) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const redirectPrefix = this.redirectScheme.split('://')[0] + '://';
            const cleanup = () => {
                urlListener.remove();
                appStateListener.remove();
            };
            const handleUrl = (urlStr) => {
                if (settled || !urlStr.startsWith(redirectPrefix))
                    return;
                settled = true;
                cleanup();
                try {
                    const match = urlStr.match(/(?:public_key|address)=([^&]+)/);
                    const pubKey = match ? decodeURIComponent(match[1]) : null;
                    if (pubKey) {
                        this.walletPubKey = pubKey;
                        resolve(pubKey);
                    }
                    else {
                        reject(new Error('Failed to get public key from wallet return URL'));
                    }
                }
                catch (e) {
                    reject(new Error('Failed to parse return URL'));
                }
            };
            const urlListener = react_native_1.Linking.addEventListener("url", (event) => {
                handleUrl(event.url || "");
            });
            const appStateListener = react_native_1.AppState.addEventListener("change", async (state) => {
                if (state === "active" && !settled) {
                    const url = await react_native_1.Linking.getInitialURL();
                    if (url)
                        handleUrl(url);
                }
            });
            const deepLink = wallet.scheme.replace("{redirect}", encodeURIComponent(this.redirectScheme));
            react_native_1.Linking.openURL(deepLink).catch((err) => {
                cleanup();
                reject(err);
            });
        });
    }
    /** Get wallet SOL balance */
    async getBalance() {
        if (!this.walletPubKey)
            throw new Error("Wallet not connected");
        const pubKey = new web3_js_1.PublicKey(this.walletPubKey);
        const lamports = await this.connection.getBalance(pubKey);
        return lamports / 1e9;
    }
    /** Get SPL token balance for a given mint address */
    async getTokenBalance(mint) {
        var _a;
        if (!this.walletPubKey)
            throw new Error("Wallet not connected");
        const owner = new web3_js_1.PublicKey(this.walletPubKey);
        const mintKey = new web3_js_1.PublicKey(mint);
        const accounts = await this.connection.getParsedTokenAccountsByOwner(owner, { mint: mintKey });
        if (accounts.value.length === 0)
            return 0;
        return (_a = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount) !== null && _a !== void 0 ? _a : 0;
    }
    /** Get balances for all supported tokens on the current network */
    async getTokenBalances(network = "devnet") {
        var _a;
        const mints = (_a = exports.TOKEN_MINTS[network]) !== null && _a !== void 0 ? _a : {};
        const results = [];
        for (const [symbol, info] of Object.entries(mints)) {
            if (info.mint.startsWith("PLACEHOLDER")) {
                results.push({ symbol, mint: info.mint, balance: 0 });
                continue;
            }
            try {
                const balance = await this.getTokenBalance(info.mint);
                results.push({ symbol, mint: info.mint, balance });
            }
            catch (_b) {
                results.push({ symbol, mint: info.mint, balance: 0 });
            }
        }
        return results;
    }
    /**
     * Transfer SOL or SPL token from wallet to recipient via Phantom SignTransaction deep link.
     * Pass `token` to send an SPL token (USDC, USDT, PYUSD); omit for SOL.
     */
    async transferToBank(recipient, amount, token) {
        if (!this.walletPubKey)
            return { error: "Wallet not connected" };
        if (!this.sharedSecret || !this.dappKeypair || !this.session) {
            return { error: "Phantom session not established — please reconnect" };
        }
        try {
            const fromPubKey = new web3_js_1.PublicKey(this.walletPubKey);
            const toPubKey = new web3_js_1.PublicKey(recipient);
            const transaction = new web3_js_1.Transaction();
            if (token) {
                // SPL token transfer — lazy require so Buffer polyfill runs first
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { getAssociatedTokenAddress, createTransferCheckedInstruction } = require('@solana/spl-token');
                const mintPubKey = new web3_js_1.PublicKey(token.mint);
                const senderAta = await getAssociatedTokenAddress(mintPubKey, fromPubKey);
                const recipientAta = await getAssociatedTokenAddress(mintPubKey, toPubKey);
                const tokenAmount = BigInt(Math.round(amount * Math.pow(10, token.decimals)));
                transaction.add(createTransferCheckedInstruction(senderAta, mintPubKey, recipientAta, fromPubKey, tokenAmount, token.decimals));
            }
            else {
                // Native SOL transfer
                const lamports = Math.round(amount * 1e9);
                transaction.add(web3_js_1.SystemProgram.transfer({
                    fromPubkey: fromPubKey,
                    toPubkey: toPubKey,
                    lamports,
                }));
            }
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubKey;
            // Serialize transaction as base58 (Phantom requirement)
            const serializedTx = transaction.serialize({ requireAllSignatures: false });
            const base58Tx = bs58_1.default.encode(serializedTx);
            // Encrypt the payload { transaction, session } with the shared secret
            const payloadNonce = tweetnacl_1.default.randomBytes(24);
            const payloadBytes = buffer_1.Buffer.from(JSON.stringify({ transaction: base58Tx, session: this.session }), 'utf-8');
            const encryptedPayload = tweetnacl_1.default.box.after(payloadBytes, payloadNonce, this.sharedSecret);
            return new Promise((resolve) => {
                let settled = false;
                const redirectPrefix = this.redirectScheme.split('://')[0] + '://';
                const cleanup = () => {
                    listener.remove();
                    appStateListener.remove();
                };
                const handleUrl = (urlStr) => {
                    if (settled || !urlStr.startsWith(redirectPrefix))
                        return;
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
                        const responseNonce = bs58_1.default.decode(decodeURIComponent(nonceMatch[1]));
                        const encryptedData = bs58_1.default.decode(decodeURIComponent(dataMatch[1]));
                        // Decrypt the signed transaction response
                        const decryptedBytes = tweetnacl_1.default.box.open.after(encryptedData, responseNonce, this.sharedSecret);
                        if (!decryptedBytes) {
                            resolve({ error: 'Failed to decrypt Phantom sign response' });
                            return;
                        }
                        const decrypted = JSON.parse(buffer_1.Buffer.from(decryptedBytes).toString('utf-8'));
                        // Deserialize and broadcast the signed transaction
                        const signedTxBytes = bs58_1.default.decode(decrypted.transaction);
                        const signedTx = web3_js_1.Transaction.from(signedTxBytes);
                        this.connection.sendRawTransaction(signedTx.serialize()).then((txid) => {
                            resolve({ txid });
                        }).catch((err) => {
                            resolve({ error: String(err) });
                        });
                    }
                    catch (e) {
                        resolve({ error: 'Failed to process Phantom sign response' });
                    }
                };
                const listener = react_native_1.Linking.addEventListener("url", (event) => {
                    handleUrl(event.url || "");
                });
                const appStateListener = react_native_1.AppState.addEventListener("change", async (state) => {
                    if (state === "active" && !settled) {
                        const url = await react_native_1.Linking.getInitialURL();
                        if (url)
                            handleUrl(url);
                    }
                });
                // Build Phantom SignTransaction URL
                const params = new URLSearchParams({
                    dapp_encryption_public_key: bs58_1.default.encode(this.dappKeypair.publicKey),
                    nonce: bs58_1.default.encode(payloadNonce),
                    redirect_link: this.redirectScheme,
                    payload: bs58_1.default.encode(encryptedPayload),
                });
                react_native_1.Linking.openURL(`https://phantom.app/ul/v1/signTransaction?${params.toString()}`).catch((err) => {
                    cleanup();
                    resolve({ error: String(err) });
                });
            });
        }
        catch (err) {
            return { error: String(err) };
        }
    }
    /** Full deposit flow: connect → check balance → transfer */
    async deposit(wallet, amount, bankAddress, token) {
        try {
            await this.connect(wallet);
            if (token) {
                const balance = await this.getTokenBalance(token.mint);
                if (balance < amount)
                    return { error: "Insufficient token balance" };
            }
            else {
                const balance = await this.getBalance();
                if (balance < amount)
                    return { error: "Insufficient funds" };
            }
            return await this.transferToBank(bankAddress, amount, token);
        }
        catch (err) {
            return { error: String(err) };
        }
    }
}
exports.OrkiConnect = OrkiConnect;
var OrkiConnectModal_1 = require("./ui/OrkiConnectModal");
Object.defineProperty(exports, "OrkiConnectModal", { enumerable: true, get: function () { return OrkiConnectModal_1.OrkiConnectModal; } });
