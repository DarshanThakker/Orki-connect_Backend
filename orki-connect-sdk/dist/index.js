"use strict";
//orki-connect-sdk/src/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrkiConnectModal = exports.OrkiConnect = void 0;
const react_native_1 = require("react-native");
const web3_js_1 = require("@solana/web3.js");
class OrkiConnect {
    constructor(options) {
        this.walletPubKey = null;
        this.connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)(options.network || "devnet"));
        this.redirectScheme = options.redirectScheme;
    }
    /** Connect to wallet via deep link */
    async connect(wallet) {
        return new Promise((resolve, reject) => {
            const listener = react_native_1.Linking.addEventListener("url", (event) => {
                listener.remove();
                const params = new URL(event.url).searchParams;
                const pubKey = params.get("public_key");
                if (pubKey) {
                    this.walletPubKey = pubKey;
                    resolve(pubKey);
                }
                else {
                    reject("Failed to get public key");
                }
            });
            const deepLink = wallet.scheme.replace("{redirect}", encodeURIComponent(this.redirectScheme));
            react_native_1.Linking.openURL(deepLink).catch((err) => reject(err));
        });
    }
    /** Get wallet balance in SOL */
    async getBalance() {
        if (!this.walletPubKey)
            throw new Error("Wallet not connected");
        const pubKey = new web3_js_1.PublicKey(this.walletPubKey);
        const lamports = await this.connection.getBalance(pubKey);
        return lamports / 1e9;
    }
    /** Transfer SOL from wallet to bank bridge address */
    async transferToBank(recipient, amount) {
        if (!this.walletPubKey)
            return { error: "Wallet not connected" };
        try {
            const fromPubKey = new web3_js_1.PublicKey(this.walletPubKey);
            const toPubKey = new web3_js_1.PublicKey(recipient);
            const lamports = amount * 1e9;
            const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                fromPubkey: fromPubKey,
                toPubkey: toPubKey,
                lamports,
            }));
            transaction.recentBlockhash = (await this.connection.getRecentBlockhash()).blockhash;
            transaction.feePayer = fromPubKey;
            const base64Tx = transaction
                .serialize({ requireAllSignatures: false })
                .toString("base64");
            return new Promise((resolve) => {
                const listener = react_native_1.Linking.addEventListener("url", async (event) => {
                    listener.remove();
                    const params = new URL(event.url).searchParams;
                    const signedBase64 = params.get("signature");
                    if (!signedBase64)
                        return resolve({ error: "User rejected transaction" });
                    const signedTx = web3_js_1.Transaction.from(Buffer.from(signedBase64, "base64"));
                    const txid = await this.connection.sendRawTransaction(signedTx.serialize());
                    resolve({ txid });
                });
                const signUrl = `phantom://v1/signTransaction?transaction=${base64Tx}&redirect_link=${encodeURIComponent(this.redirectScheme)}`;
                react_native_1.Linking.openURL(signUrl).catch((err) => resolve({ error: String(err) }));
            });
        }
        catch (err) {
            return { error: String(err) };
        }
    }
    /** Full deposit flow: connect → check balance → transfer */
    async deposit(wallet, amount, bankAddress) {
        try {
            await this.connect(wallet);
            const balance = await this.getBalance();
            if (balance < amount)
                return { error: "Insufficient funds" };
            return await this.transferToBank(bankAddress, amount);
        }
        catch (err) {
            return { error: String(err) };
        }
    }
}
exports.OrkiConnect = OrkiConnect;
var OrkiConnectModal_1 = require("./ui/OrkiConnectModal");
Object.defineProperty(exports, "OrkiConnectModal", { enumerable: true, get: function () { return OrkiConnectModal_1.OrkiConnectModal; } });
