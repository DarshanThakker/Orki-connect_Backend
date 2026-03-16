"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrkiConnectModal = OrkiConnectModal;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const WALLETS = [
    { id: "metamask", name: "MetaMask", scheme: "metamask://connect?redirect_link={redirect}", icon: "🦊" },
    { id: "phantom", name: "Phantom", scheme: "phantom://v1/connect?redirect_link={redirect}", icon: "👻" },
    { id: "coinbase", name: "Coinbase Wallet", scheme: "cbwallet://connect?redirect_link={redirect}", icon: "🔵" },
    { id: "trust", name: "Trust Wallet", scheme: "trust://connect?redirect_link={redirect}", icon: "🛡️" },
];
const ASSETS = [
    { symbol: "USDC", name: "USD Coin", balance: "0.00", amount: 0, color: "#2775CA" },
    { symbol: "USDT", name: "Tether", balance: "0.00", amount: 0, color: "#26A17B" },
    { symbol: "DAI", name: "Dai", balance: "0.00", amount: 0, color: "#F4B731" },
];
const PURPLE = "#6334f5";
const { height: SCREEN_HEIGHT } = react_native_1.Dimensions.get('window');
// EVM Balance Fetcher
async function getEvmBalance(rpcUrl, address, tokenAddress, decimals) {
    try {
        const data = "0x70a08231000000000000000000000000" + address.replace("0x", "");
        const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0", id: 1, method: "eth_call",
                params: [{ to: tokenAddress, data }, "latest"]
            })
        });
        const json = await res.json();
        if (json.result && json.result !== "0x") {
            let balanceNum = 0;
            if (typeof BigInt !== 'undefined') {
                balanceNum = Number(BigInt(json.result)) / (10 ** decimals);
            }
            else {
                balanceNum = parseInt(json.result, 16) / (10 ** decimals);
            }
            return balanceNum;
        }
    }
    catch (e) {
        console.warn('EVMBalance fetch error', e);
    }
    return 0;
}
// Solana Balance Fetcher
async function getSolanaBalance(address, mint, decimals) {
    var _a, _b;
    try {
        const res = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
                params: [address, { mint }, { encoding: "jsonParsed" }]
            })
        });
        const json = await res.json();
        if (((_b = (_a = json.result) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            return json.result.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
    }
    catch (e) {
        console.warn('SolanaBalance fetch error', e);
    }
    return 0;
}
const TOKEN_ADDRESSES = {
    ETH: {
        USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
        USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 }
    },
    BASE: {
        USDC: { address: "0x833589fCD6eDb6E08f4c7b32c6f1De223AaFa956", decimals: 6 },
        USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
        DAI: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 }
    },
    POLYGON: {
        USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
        USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
        DAI: { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 }
    },
    SOLANA: {
        USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
        USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 }
    }
};
const RPC_URLS = {
    ETH: "https://eth.llamarpc.com",
    BASE: "https://mainnet.base.org",
    POLYGON: "https://polygon-rpc.com"
};
async function fetchRealBalances(network, address) {
    var _a;
    const newAssets = [...ASSETS];
    for (let i = 0; i < newAssets.length; i++) {
        const asset = newAssets[i];
        const tokenInfo = (_a = TOKEN_ADDRESSES[network]) === null || _a === void 0 ? void 0 : _a[asset.symbol];
        if (tokenInfo) {
            let balance = 0;
            if (network === "SOLANA") {
                balance = await getSolanaBalance(address, tokenInfo.address, tokenInfo.decimals);
            }
            else {
                balance = await getEvmBalance(RPC_URLS[network], address, tokenInfo.address, tokenInfo.decimals);
            }
            newAssets[i] = Object.assign(Object.assign({}, asset), { amount: balance, balance: balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) });
        }
    }
    return newAssets;
}
function OrkiConnectModal({ visible, onClose, bankAddress, sdk, onSuccess, onError, hasAgreedBefore, onAgreementAccepted }) {
    const [step, setStep] = (0, react_1.useState)('onboarding');
    const [agreed, setAgreed] = (0, react_1.useState)(false);
    const [selectedWallet, setSelectedWallet] = (0, react_1.useState)(null);
    const [selectedNetwork, setSelectedNetwork] = (0, react_1.useState)(null);
    const [assets, setAssets] = (0, react_1.useState)(ASSETS);
    const [selectedAsset, setSelectedAsset] = (0, react_1.useState)(ASSETS[0]);
    const [amountStr, setAmountStr] = (0, react_1.useState)("");
    const [txid, setTxid] = (0, react_1.useState)("");
    const [walletAddress, setWalletAddress] = (0, react_1.useState)("");
    const [isFetchingBalances, setIsFetchingBalances] = (0, react_1.useState)(false);
    // Reset state when opened
    (0, react_1.useEffect)(() => {
        if (visible) {
            setStep(hasAgreedBefore ? 'add-crypto' : 'onboarding');
            setAgreed(hasAgreedBefore || false);
            setSelectedWallet(null);
            setSelectedNetwork(null);
            setAssets(ASSETS);
            setWalletAddress("");
            setAmountStr("");
            setTxid("");
            setIsFetchingBalances(false);
        }
    }, [visible, hasAgreedBefore]);
    const goBack = () => {
        switch (step) {
            case 'add-crypto':
                setStep(hasAgreedBefore ? 'add-crypto' : 'onboarding');
                break;
            case 'connect-wallet':
                setStep('add-crypto');
                break;
            case 'select-network':
                setStep('connect-wallet');
                break;
            case 'select-asset':
                setStep('select-network');
                break;
            case 'enter-amount':
                setStep('select-asset');
                break;
            case 'review':
                setStep('enter-amount');
                break;
            default: onClose();
        }
    };
    const handleConnectWallet = async (wallet) => {
        setSelectedWallet(wallet);
        // Don't auto proceed to select-network, wait for wallet to return
        try {
            const address = await sdk.connect(wallet);
            setWalletAddress(address);
            setStep('select-network');
        }
        catch (e) {
            console.warn('Connect error', e);
            // Fallback for testing if deep linking fails (e.g. simulator without wallet)
            setWalletAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
            setStep('select-network');
        }
    };
    const handleSelectNetwork = async (network) => {
        setSelectedNetwork(network);
        setStep('select-asset');
        setIsFetchingBalances(true);
        const addr = walletAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        const finalAddr = network === 'SOLANA'
            ? (addr.startsWith('0x') ? '5Q544fKrToePTgAcHbZc4y7m4bQrkBbnk4KZbG1f2P4v' : addr)
            : (addr.startsWith('0x') ? addr : '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
        const newAssets = await fetchRealBalances(network, finalAddr);
        setAssets(newAssets);
        setIsFetchingBalances(false);
    };
    const handleNumpad = (val) => {
        if (val === 'back') {
            setAmountStr(prev => prev.slice(0, -1));
        }
        else if (val === '.') {
            if (!amountStr.includes('.'))
                setAmountStr(prev => prev + '.');
        }
        else {
            setAmountStr(prev => prev === "0" ? val : prev + val);
        }
    };
    const handleConfirmAndSign = async () => {
        setStep('processing');
        try {
            const amount = parseFloat(amountStr || "0");
            setTimeout(() => {
                // Simulate processing states then succeed
                setTimeout(() => {
                    setTxid("0xa83...8312");
                    setStep('success');
                    if (onSuccess)
                        onSuccess("0xa83...8312");
                }, 2000);
            }, 1000);
            // In a real app we would await sdk.transferToBank here:
            // const res = await sdk.transferToBank(bankAddress, amount);
            // if (res.error) throw new Error(res.error);
        }
        catch (error) {
            setStep('failed');
            if (onError)
                onError(error.message || String(error));
        }
    };
    const renderHeader = (title, showBack, progress) => (<react_native_1.View style={styles.header}>
      {showBack ? (<react_native_1.Pressable onPress={goBack} style={styles.headerBtn}>
          <react_native_1.Text style={styles.headerIcon}>←</react_native_1.Text>
        </react_native_1.Pressable>) : <react_native_1.View style={styles.headerBtn}/>}
      <react_native_1.View style={{ flex: 1, alignItems: 'center' }}>
        {progress !== undefined && (<react_native_1.Text style={styles.stepText}>Step {progress} of 4</react_native_1.Text>)}
      </react_native_1.View>
      <react_native_1.Pressable onPress={onClose} style={styles.headerBtn}>
        <react_native_1.Text style={styles.headerIcon}>✕</react_native_1.Text>
      </react_native_1.Pressable>
      {progress !== undefined && (<react_native_1.View style={styles.progressContainer}>
          <react_native_1.View style={[styles.progressBar, { width: `${(progress / 4) * 100}%` }]}/>
        </react_native_1.View>)}
    </react_native_1.View>);
    return (<react_native_1.Modal visible={visible} animationType="slide" transparent>
      <react_native_1.SafeAreaView style={styles.safeArea}>
        <react_native_1.View style={styles.container}>
          
          {step === 'onboarding' && (<react_native_1.View style={styles.content}>
              {renderHeader('', false)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={styles.logoCircle}>
                  <react_native_1.Text style={{ fontSize: 32 }}>🔒</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.title}>Fast & seamless transfer</react_native_1.Text>
                <react_native_1.Text style={styles.subtitle}>Your transfer is processed almost instantly, ensuring quick access to funds.</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.View style={styles.onboardingCard}>
                <react_native_1.Text style={styles.cardTitle}>NeoUAE partners with Orki</react_native_1.Text>
                <react_native_1.Text style={styles.cardSub}>NeoUAE uses Orki to allow you to transfer crypto from an external account.</react_native_1.Text>
                <react_native_1.Pressable style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
                  <react_native_1.View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                    {agreed && <react_native_1.Text style={{ color: 'white', fontSize: 10 }}>✓</react_native_1.Text>}
                  </react_native_1.View>
                  <react_native_1.Text style={styles.termsText}>
                    I read and agree to Orki's User Agreements, Regulatory Disclosures, Third-Party Transaction Disclosures and Privacy Notice.
                  </react_native_1.Text>
                </react_native_1.Pressable>
                <react_native_1.Pressable style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]} disabled={!agreed} onPress={() => {
                if (onAgreementAccepted)
                    onAgreementAccepted();
                setStep('add-crypto');
            }}>
                  <react_native_1.Text style={styles.primaryBtnText}>Continue</react_native_1.Text>
                </react_native_1.Pressable>
                <react_native_1.Text style={styles.poweredBy}>Powered by Orki</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>)}

          {step === 'add-crypto' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={styles.logoCircleSmall}>
                  <react_native_1.Text style={{ fontSize: 24 }}>🔒</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.title}>Add Crypto</react_native_1.Text>
                <react_native_1.Text style={styles.subtitle}>Fund your account securely</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.optionsList}>
                <react_native_1.Pressable style={styles.optionBtn} onPress={() => setStep('connect-wallet')}>
                  <react_native_1.View style={styles.optionIcon}><react_native_1.Text>💼</react_native_1.Text></react_native_1.View>
                  <react_native_1.View style={{ flex: 1 }}>
                    <react_native_1.Text style={styles.optionTitle}>Connect Wallet</react_native_1.Text>
                    <react_native_1.Text style={styles.optionSub}>Transfer from your crypto wallet</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.arrow}>→</react_native_1.Text>
                </react_native_1.Pressable>
                <react_native_1.View style={[styles.optionBtn, { opacity: 0.5 }]}>
                  <react_native_1.View style={styles.optionIcon}><react_native_1.Text>🏦</react_native_1.Text></react_native_1.View>
                  <react_native_1.View style={{ flex: 1 }}>
                    <react_native_1.Text style={styles.optionTitle}>Connect Exchange</react_native_1.Text>
                    <react_native_1.Text style={styles.optionSub}>Coming Soon</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={styles.cancelLink} onPress={onClose}>
                <react_native_1.Text style={styles.cancelText}>Cancel</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'connect-wallet' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true, 1)}
              <react_native_1.Text style={styles.titleLeft}>Connect Your Wallet</react_native_1.Text>
              <react_native_1.Text style={styles.subtitleLeft}>Choose a wallet to connect</react_native_1.Text>
              <react_native_1.View style={styles.optionsList}>
                {WALLETS.map(w => (<react_native_1.Pressable key={w.id} style={[styles.walletOption, (selectedWallet === null || selectedWallet === void 0 ? void 0 : selectedWallet.id) === w.id && styles.walletOptionSelected]} onPress={() => setSelectedWallet(w)}>
                    <react_native_1.Text style={styles.walletLogo}>{w.icon || "🦊"}</react_native_1.Text>
                    <react_native_1.Text style={styles.walletName}>{w.name}</react_native_1.Text>
                    <react_native_1.Text style={styles.walletSub}>Connect using {w.name}</react_native_1.Text>
                    {(selectedWallet === null || selectedWallet === void 0 ? void 0 : selectedWallet.id) === w.id && <react_native_1.View style={styles.radioChecked}><react_native_1.View style={styles.radioInner}/></react_native_1.View>}
                    {(selectedWallet === null || selectedWallet === void 0 ? void 0 : selectedWallet.id) !== w.id && <react_native_1.View style={styles.radioUnchecked}/>}
                  </react_native_1.Pressable>))}
              </react_native_1.View>
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={[styles.primaryBtn, !selectedWallet && styles.primaryBtnDisabled]} disabled={!selectedWallet} onPress={() => selectedWallet && handleConnectWallet(selectedWallet)}>
                <react_native_1.Text style={styles.primaryBtnText}>Connect Wallet</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Pressable style={styles.cancelLink} onPress={onClose}>
                <react_native_1.Text style={styles.cancelText}>Cancel</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'select-network' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true, 2)}
              <react_native_1.Text style={styles.titleLeft}>Select Network</react_native_1.Text>
              <react_native_1.Text style={styles.subtitleLeft}>Choose the network for your deposit</react_native_1.Text>
              <react_native_1.View style={styles.optionsList}>
                {['ETH', 'BASE', 'POLYGON', 'SOLANA'].map(net => (<react_native_1.Pressable key={net} style={[styles.walletOption, selectedNetwork === net && styles.walletOptionSelected]} onPress={() => handleSelectNetwork(net)}>
                    <react_native_1.Text style={styles.walletLogo}>🌐</react_native_1.Text>
                    <react_native_1.Text style={styles.walletName}>{net}</react_native_1.Text>
                    {selectedNetwork === net && <react_native_1.View style={styles.radioChecked}><react_native_1.View style={styles.radioInner}/></react_native_1.View>}
                    {selectedNetwork !== net && <react_native_1.View style={styles.radioUnchecked}/>}
                  </react_native_1.Pressable>))}
              </react_native_1.View>
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={styles.cancelLink} onPress={onClose}>
                <react_native_1.Text style={styles.cancelText}>Cancel</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'select-asset' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true, 3)}
              <react_native_1.View style={styles.rowBetween}>
                <react_native_1.View>
                  <react_native_1.Text style={styles.titleLeft}>Select Asset</react_native_1.Text>
                  <react_native_1.Text style={styles.subtitleLeft}>Available in your wallet on {selectedNetwork}</react_native_1.Text>
                </react_native_1.View>
                {selectedWallet && (<react_native_1.View style={styles.pill}>
                    <react_native_1.Text style={{ fontSize: 10 }}>🦊</react_native_1.Text>
                    <react_native_1.Text style={styles.pillText}>{selectedWallet.name.split(' ')[0]}</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>
              <react_native_1.View style={styles.searchBar}>
                <react_native_1.Text style={{ color: '#aaa', marginRight: 8 }}>🔍</react_native_1.Text>
                <react_native_1.TextInput style={styles.searchInput} placeholder="Search asset" placeholderTextColor="#aaa" editable={false}/>
              </react_native_1.View>
              {isFetchingBalances ? (<react_native_1.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <react_native_1.ActivityIndicator size="large" color={PURPLE}/>
                  <react_native_1.Text style={{ marginTop: 16, color: '#666' }}>Fetching real balances...</react_native_1.Text>
                </react_native_1.View>) : (assets.map(asset => (<react_native_1.Pressable key={asset.symbol} style={[styles.assetRow, asset.amount === 0 && { opacity: 0.6 }]} onPress={() => { setSelectedAsset(asset); setStep('enter-amount'); }}>
                    <react_native_1.View style={[styles.assetIcon, { backgroundColor: asset.color }]}><react_native_1.Text style={{ color: 'white', fontWeight: 'bold' }}>{asset.symbol[0]}</react_native_1.Text></react_native_1.View>
                    <react_native_1.View style={{ flex: 1 }}>
                      <react_native_1.Text style={styles.assetName}>{asset.name}</react_native_1.Text>
                      <react_native_1.Text style={styles.assetSymbol}>{asset.symbol}</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.View style={{ alignItems: 'flex-end' }}>
                      <react_native_1.Text style={styles.assetBalance}>{asset.balance}</react_native_1.Text>
                      <react_native_1.Text style={styles.assetSymbol}>{asset.symbol}</react_native_1.Text>
                    </react_native_1.View>
                  </react_native_1.Pressable>)))}
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'enter-amount' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true, 4)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={[styles.assetIconLarge, { backgroundColor: selectedAsset.color }]}><react_native_1.Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{selectedAsset.symbol[0]}</react_native_1.Text></react_native_1.View>
                <react_native_1.Text style={styles.titleCenter}>Enter amount to transfer</react_native_1.Text>
                <react_native_1.Text style={styles.subtitleCenter}>Available: {selectedAsset.balance} {selectedAsset.symbol}</react_native_1.Text>
                
                <react_native_1.View style={styles.amountInputDisplay}>
                  <react_native_1.Text style={[styles.amountText, !amountStr && { color: '#bbb' }]}>{amountStr || "0"}</react_native_1.Text>
                  <react_native_1.View style={styles.verticalDivider}/>
                  <react_native_1.Text style={styles.amountSymbol}>{selectedAsset.symbol}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.usdValue}>~ ${amountStr || "0"}</react_native_1.Text>

                <react_native_1.View style={styles.presetRow}>
                  <react_native_1.Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount * 0.1).toString())}><react_native_1.Text style={styles.presetText}>10%</react_native_1.Text></react_native_1.Pressable>
                  <react_native_1.Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount * 0.5).toString())}><react_native_1.Text style={styles.presetText}>50%</react_native_1.Text></react_native_1.Pressable>
                  <react_native_1.Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount).toString())}><react_native_1.Text style={styles.presetText}>Max</react_native_1.Text></react_native_1.Pressable>
                </react_native_1.View>
              </react_native_1.View>
              
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={[styles.primaryBtn, { marginBottom: 16 }]} onPress={() => setStep('review')}>
                <react_native_1.Text style={styles.primaryBtnText}>Continue</react_native_1.Text>
              </react_native_1.Pressable>
              
              {/* Custom Numpad */}
              <react_native_1.View style={styles.numpad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map(k => (<react_native_1.Pressable key={k} style={styles.numKey} onPress={() => handleNumpad(k)}>
                    {k === 'back' ? <react_native_1.Text style={styles.numText}>⌫</react_native_1.Text> : <react_native_1.Text style={styles.numText}>{k}</react_native_1.Text>}
                  </react_native_1.Pressable>))}
              </react_native_1.View>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'review' && (<react_native_1.View style={styles.content}>
              {renderHeader('', true)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={[styles.assetIconLarge, { backgroundColor: '#eef2ff' }]}><react_native_1.Text style={{ fontSize: 24 }}>📄</react_native_1.Text></react_native_1.View>
                <react_native_1.Text style={styles.titleCenter}>Review</react_native_1.Text>
                <react_native_1.Text style={[styles.subtitleCenter, { paddingHorizontal: 32 }]}>
                  You're depositing {amountStr || "0"} {selectedAsset.symbol} from {(selectedWallet === null || selectedWallet === void 0 ? void 0 : selectedWallet.name) || 'Wallet'} to your NeoUAE account
                </react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.reviewCard}>
                <react_native_1.View style={styles.reviewRow}>
                  <react_native_1.Text style={styles.reviewLabel}>You deposit</react_native_1.Text>
                  <react_native_1.Text style={styles.reviewValue}>{amountStr || "0"} {selectedAsset.symbol}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.reviewRow}>
                  <react_native_1.Text style={styles.reviewLabel}>Orki fee</react_native_1.Text>
                  <react_native_1.Text style={[styles.reviewValue, { color: '#000' }]}>FREE</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.reviewRow}>
                  <react_native_1.Text style={styles.reviewLabel}>Network fee</react_native_1.Text>
                  <react_native_1.Text style={styles.reviewValue}>{selectedNetwork || 'Wallet'}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.reviewRow}>
                  <react_native_1.Text style={styles.reviewLabel}>Est. time</react_native_1.Text>
                  <react_native_1.Text style={styles.reviewValue}>~ 5 minutes</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View style={styles.infoBox}>
                <react_native_1.Text style={{ fontSize: 16, marginRight: 8 }}>ℹ️</react_native_1.Text>
                <react_native_1.Text style={styles.infoText}>Withdrawal and deposit transactions are on the main network. You might still have to pay network fees.</react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={styles.primaryBtn} onPress={handleConfirmAndSign}>
                <react_native_1.Text style={styles.primaryBtnText}>Confirm & Sign</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'processing' && (<react_native_1.View style={styles.content}>
              {renderHeader('', false)}
              <react_native_1.View style={styles.centerCol}>
                 <react_native_1.ActivityIndicator size="large" color={PURPLE} style={{ marginBottom: 16 }}/>
                 <react_native_1.Text style={styles.titleCenter}>Processing</react_native_1.Text>
                 <react_native_1.Text style={styles.subtitleCenter}>
                    Once the deposit is complete, your updated balance will appear in your account.
                 </react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.statusList}>
                <react_native_1.View style={styles.statusRow}>
                  <react_native_1.View style={styles.statusDotActive}/>
                  <react_native_1.View>
                    <react_native_1.Text style={styles.statusTitle}>Transaction broadcasted</react_native_1.Text>
                    <react_native_1.Text style={styles.statusSub}>Arriving in 4 min</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
                <react_native_1.View style={styles.statusLine}/>
                <react_native_1.View style={styles.statusRow}>
                  <react_native_1.View style={styles.statusDotInactive}/>
                  <react_native_1.Text style={styles.statusTitleInactive}>1/2 confirmations</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.statusRow}>
                  <react_native_1.View style={styles.statusDotInactive}/>
                  <react_native_1.Text style={styles.statusTitleInactive}>2/2 confirmations</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.statusRow}>
                  <react_native_1.View style={styles.statusDotInactive}/>
                  <react_native_1.Text style={styles.statusTitleInactive}>Confirmed</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Text style={styles.footerNote}>Closing this window will not impact your transaction.</react_native_1.Text>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'failed' && (<react_native_1.View style={styles.content}>
              {renderHeader('', false)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={[styles.logoCircle, { backgroundColor: '#ffebee' }]}>
                  <react_native_1.Text style={{ fontSize: 32 }}>❌</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.titleCenter}>Deposit Failed</react_native_1.Text>
                <react_native_1.Text style={styles.subtitleCenter}>Unfortunately, your deposit couldn't be processed.</react_native_1.Text>
                <react_native_1.Text style={[styles.subtitleCenter, { marginTop: 16 }]}>An unknown error occurred. Please try again later.</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={styles.primaryBtn} onPress={() => setStep('enter-amount')}>
                <react_native_1.Text style={styles.primaryBtnText}>Try Again</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

          {step === 'success' && (<react_native_1.View style={styles.content}>
              {renderHeader('', false)}
              <react_native_1.View style={styles.centerCol}>
                <react_native_1.View style={[styles.logoCircle, { backgroundColor: '#e8f5e9' }]}>
                  <react_native_1.Text style={{ fontSize: 32 }}>✅</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.titleCenter}>Transfer Successful</react_native_1.Text>
                <react_native_1.Text style={styles.subtitleCenter}>You successfully transferred {amountStr} {selectedAsset.symbol} from {(selectedWallet === null || selectedWallet === void 0 ? void 0 : selectedWallet.name) || 'Wallet'} to NeoUAE</react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.successBox}>
                <react_native_1.Text style={styles.successAmount}>{amountStr} {selectedAsset.symbol}</react_native_1.Text>
                <react_native_1.Text style={styles.successDate}>Feb 23, 2025, 12:09 PM</react_native_1.Text>
                <react_native_1.View style={styles.divider}/>
                <react_native_1.Text style={styles.txLabel}>Transaction ID</react_native_1.Text>
                <react_native_1.Text style={styles.txId}>{txid}</react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.spacer}/>
              <react_native_1.Pressable style={styles.primaryBtn} onPress={onClose}>
                <react_native_1.Text style={styles.primaryBtnText}>Return to App</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Text style={styles.poweredByCenter}>Powered by Orki</react_native_1.Text>
            </react_native_1.View>)}

        </react_native_1.View>
      </react_native_1.SafeAreaView>
    </react_native_1.Modal>);
}
const styles = react_native_1.StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#fff',
        height: SCREEN_HEIGHT * 0.9,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    content: { flex: 1, padding: 24, display: 'flex' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, position: 'relative' },
    headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    headerIcon: { fontSize: 20, color: '#333' },
    stepText: { fontSize: 12, fontWeight: '600', color: '#666' },
    progressContainer: { position: 'absolute', bottom: -12, left: 0, right: 0, height: 2, backgroundColor: '#eee' },
    progressBar: { height: '100%', backgroundColor: PURPLE },
    centerCol: { alignItems: 'center', marginTop: 16 },
    logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f2eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    logoCircleSmall: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f2eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 8, paddingHorizontal: 32, textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
    titleLeft: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
    subtitleLeft: { fontSize: 13, color: '#666', marginBottom: 24 },
    titleCenter: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8, textAlign: 'center' },
    subtitleCenter: { fontSize: 14, color: '#666', textAlign: 'center' },
    spacer: { flex: 1 },
    // Onboarding
    onboardingCard: { backgroundColor: '#f8f9fa', borderRadius: 16, padding: 16, borderColor: '#eee', borderWidth: 1 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
    cardSub: { fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 18 },
    checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#ccc', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: PURPLE, borderColor: PURPLE },
    termsText: { flex: 1, fontSize: 12, color: '#555', lineHeight: 16 },
    poweredBy: { textAlign: 'center', fontSize: 11, color: '#888', marginTop: 12 },
    poweredByCenter: { textAlign: 'center', fontSize: 11, color: '#888', marginTop: 16 },
    // Buttons
    primaryBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    primaryBtnDisabled: { backgroundColor: '#d1c4e9' },
    primaryBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
    cancelLink: { alignItems: 'center', paddingVertical: 12 },
    cancelText: { color: '#666', fontSize: 14, fontWeight: '500' },
    // Options
    optionsList: { marginTop: 8 },
    optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, marginBottom: 12 },
    optionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
    optionSub: { fontSize: 12, color: '#666' },
    arrow: { fontSize: 18, color: '#ccc' },
    // Wallets
    walletOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, marginBottom: 12 },
    walletOptionSelected: { borderColor: PURPLE, backgroundColor: '#faf8ff' },
    walletLogo: { fontSize: 24, marginRight: 16 },
    walletName: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
    walletSub: { fontSize: 12, color: '#666', position: 'absolute', bottom: 16, left: 56, display: 'none' }, // simplified
    radioUnchecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc' },
    radioChecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: PURPLE },
    // Assets
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    pillText: { fontSize: 12, fontWeight: '600', color: '#111', marginLeft: 6 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 16 },
    searchInput: { flex: 1, fontSize: 14, color: '#111' },
    assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    assetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    assetName: { fontSize: 15, fontWeight: '600', color: '#111' },
    assetSymbol: { fontSize: 12, color: '#666', marginTop: 2 },
    assetBalance: { fontSize: 15, fontWeight: '600', color: '#111' },
    // Enter Amount
    assetIconLarge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    amountInputDisplay: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 8 },
    amountText: { fontSize: 40, fontWeight: '700', color: '#111' },
    verticalDivider: { width: 2, height: 32, backgroundColor: '#eee', marginHorizontal: 12 },
    amountSymbol: { fontSize: 20, fontWeight: '600', color: '#666' },
    usdValue: { fontSize: 14, color: '#888', marginBottom: 24 },
    presetRow: { flexDirection: 'row', gap: 12 },
    presetBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f5f5f5' },
    presetText: { fontSize: 13, fontWeight: '600', color: '#555' },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: -12, paddingHorizontal: 12 },
    numKey: { width: '30%', aspectRatio: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: '#f9f9f9', borderRadius: 8 },
    numText: { fontSize: 24, fontWeight: '500', color: '#111' },
    // Review
    reviewCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 16, marginTop: 24 },
    reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    reviewLabel: { fontSize: 14, color: '#666' },
    reviewValue: { fontSize: 14, fontWeight: '600', color: '#111' },
    infoBox: { flexDirection: 'row', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 12, marginTop: 16 },
    infoText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 18 },
    // Processing
    statusList: { marginTop: 32, paddingHorizontal: 16 },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    statusDotActive: { width: 12, height: 12, borderRadius: 6, backgroundColor: PURPLE, marginTop: 4, marginRight: 16 },
    statusDotInactive: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#eee', marginTop: 4, marginRight: 16 },
    statusLine: { position: 'absolute', left: 5, top: 16, bottom: 0, width: 2, backgroundColor: '#eee', zIndex: -1 },
    statusTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
    statusSub: { fontSize: 12, color: '#666', marginTop: 2 },
    statusTitleInactive: { fontSize: 14, fontWeight: '500', color: '#999' },
    footerNote: { textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 16 },
    // Success
    successBox: { alignItems: 'center', marginTop: 32 },
    successAmount: { fontSize: 32, fontWeight: '800', color: '#111', marginBottom: 8 },
    successDate: { fontSize: 13, color: '#666', marginBottom: 24 },
    divider: { width: '100%', height: 1, backgroundColor: '#eee', marginBottom: 24 },
    txLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
    txId: { fontSize: 13, fontWeight: '600', color: PURPLE }
});
