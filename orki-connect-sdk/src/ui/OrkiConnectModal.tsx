import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  SafeAreaView, 
  Dimensions,
  Platform,
  TextInput
} from 'react-native';
import { WalletInfo, OrkiConnect } from '../index';
import { NETWORK_CONFIG, NetworkId, getEnvConfig } from '../config';
import { fetchBalances } from '../api';

export interface OrkiConnectModalProps {
  visible: boolean;
  onClose: () => void;
  bankAddress: string;
  sdk: OrkiConnect;
  onSuccess?: (txid: string) => void;
  onError?: (error: string) => void;
  hasAgreedBefore?: boolean;
  onAgreementAccepted?: () => void;
}

const WALLETS: WalletInfo[] = [
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

type Step = 'onboarding' | 'add-crypto' | 'connect-wallet' | 'select-network' | 'select-asset' | 'enter-amount' | 'review' | 'processing' | 'success' | 'failed';

const PURPLE = "#6334f5";
const { height: SCREEN_HEIGHT } = Dimensions.get('window');



export function OrkiConnectModal({ visible, onClose, bankAddress, sdk, onSuccess, onError, hasAgreedBefore, onAgreementAccepted }: OrkiConnectModalProps) {
  const [step, setStep] = useState<Step>('onboarding');
  const [agreed, setAgreed] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId | null>(null);
  const [assets, setAssets] = useState(ASSETS);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [amountStr, setAmountStr] = useState("");
  const [txid, setTxid] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);

  // Reset state when opened
  useEffect(() => {
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
    switch(step) {
      case 'add-crypto': setStep(hasAgreedBefore ? 'add-crypto' : 'onboarding'); break;
      case 'connect-wallet': setStep('add-crypto'); break;
      case 'select-network': setStep('connect-wallet'); break;
      case 'select-asset': setStep('select-network'); break;
      case 'enter-amount': setStep('select-asset'); break;
      case 'review': setStep('enter-amount'); break;
      default: onClose();
    }
  };

  const handleConnectWallet = async (wallet: WalletInfo) => {
    setSelectedWallet(wallet);
    // Don't auto proceed to select-network, wait for wallet to return
    try {
      const address = await sdk.connect(wallet);
      console.log('[OrkiConnect] wallet address from deeplink:', address);
      setWalletAddress(address);
      setStep('select-network');
    } catch (e) {
      console.warn('[OrkiConnect] Connect error', e);
      // Fallback for testing if deep linking fails (e.g. simulator without wallet)
      setWalletAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      setStep('select-network');
    }
  };

  const handleSelectNetwork = async (network: NetworkId) => {
    setSelectedNetwork(network);
    setStep('select-asset');
    setIsFetchingBalances(true);
    const addr = walletAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const finalAddr = network === 'SOLANA'
      ? (addr.startsWith('0x') ? '5Q544fKrToePTgAcHbZc4y7m4bQrkBbnk4KZbG1f2P4v' : addr)
      : (addr.startsWith('0x') ? addr : '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    console.log('[OrkiConnect] walletAddress state:', addr);
    console.log('[OrkiConnect] finalAddr for balance fetch:', finalAddr, 'network:', network);
    const balances = await fetchBalances(network, finalAddr);
    const newAssets = ASSETS.map(asset => {
      const amount = balances[asset.symbol] ?? 0;
      return { ...asset, amount, balance: amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
    });
    setAssets(newAssets);
    setIsFetchingBalances(false);
  };

  const handleNumpad = (val: string) => {
    if (val === 'back') {
      setAmountStr(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amountStr.includes('.')) setAmountStr(prev => prev + '.');
    } else {
      setAmountStr(prev => prev === "0" ? val : prev + val);
    }
  };

  const handleConfirmAndSign = async () => {
    if (!selectedNetwork) return;
    const amount = parseFloat(amountStr || "0");
    if (amount <= 0 || amount > selectedAsset.amount) {
      if (onError) onError('Invalid amount');
      return;
    }

    setStep('processing');
    try {
      const { tokens, chainId } = getEnvConfig(selectedNetwork);
      const tokenCfg = tokens[selectedAsset.symbol];
      if (!tokenCfg) throw new Error(`${selectedAsset.symbol} not supported on ${selectedNetwork}`);

      const result = await sdk.transferToBank(bankAddress, amount, {
        mint: tokenCfg.address,
        decimals: tokenCfg.decimals,
        ...(chainId !== undefined && { chainId }),
      });

      if (result.error) throw new Error(result.error);

      setTxid(result.txid || '');
      setStep('success');
      if (onSuccess) onSuccess(result.txid || '');
    } catch (error: any) {
      setStep('failed');
      if (onError) onError(error.message || String(error));
    }
  };

  const renderHeader = (title: string, showBack: boolean, progress?: number) => (
    <View style={styles.header}>
      {showBack ? (
        <Pressable onPress={goBack} style={styles.headerBtn}>
          <Text style={styles.headerIcon}>←</Text>
        </Pressable>
      ) : <View style={styles.headerBtn} />}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {progress !== undefined && (
          <Text style={styles.stepText}>Step {progress} of 4</Text>
        )}
      </View>
      <Pressable onPress={onClose} style={styles.headerBtn}>
        <Text style={styles.headerIcon}>✕</Text>
      </Pressable>
      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(progress / 4) * 100}%` }]} />
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          
          {step === 'onboarding' && (
            <View style={styles.content}>
              {renderHeader('', false)}
              <View style={styles.centerCol}>
                <View style={styles.logoCircle}>
                  <Text style={{ fontSize: 32 }}>🔒</Text>
                </View>
                <Text style={styles.title}>Fast & seamless transfer</Text>
                <Text style={styles.subtitle}>Your transfer is processed almost instantly, ensuring quick access to funds.</Text>
              </View>
              <View style={styles.spacer} />
              <View style={styles.onboardingCard}>
                <Text style={styles.cardTitle}>NeoUAE partners with Orki</Text>
                <Text style={styles.cardSub}>NeoUAE uses Orki to allow you to transfer crypto from an external account.</Text>
                <Pressable style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
                  <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                    {agreed && <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I read and agree to Orki's User Agreements, Regulatory Disclosures, Third-Party Transaction Disclosures and Privacy Notice.
                  </Text>
                </Pressable>
                <Pressable 
                  style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]} 
                  disabled={!agreed}
                  onPress={() => {
                    if (onAgreementAccepted) onAgreementAccepted();
                    setStep('add-crypto');
                  }}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </Pressable>
                <Text style={styles.poweredBy}>Powered by Orki</Text>
              </View>
            </View>
          )}

          {step === 'add-crypto' && (
            <View style={styles.content}>
              {renderHeader('', true)}
              <View style={styles.centerCol}>
                <View style={styles.logoCircleSmall}>
                  <Text style={{ fontSize: 24 }}>🔒</Text>
                </View>
                <Text style={styles.title}>Add Crypto</Text>
                <Text style={styles.subtitle}>Fund your account securely</Text>
              </View>
              <View style={styles.optionsList}>
                <Pressable style={styles.optionBtn} onPress={() => setStep('connect-wallet')}>
                  <View style={styles.optionIcon}><Text>💼</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Connect Wallet</Text>
                    <Text style={styles.optionSub}>Transfer from your crypto wallet</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
                <View style={[styles.optionBtn, { opacity: 0.5 }]}>
                  <View style={styles.optionIcon}><Text>🏦</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Connect Exchange</Text>
                    <Text style={styles.optionSub}>Coming Soon</Text>
                  </View>
                </View>
              </View>
              <View style={styles.spacer} />
              <Pressable style={styles.cancelLink} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'connect-wallet' && (
            <View style={styles.content}>
              {renderHeader('', true, 1)}
              <Text style={styles.titleLeft}>Connect Your Wallet</Text>
              <Text style={styles.subtitleLeft}>Choose a wallet to connect</Text>
              <View style={styles.optionsList}>
                {WALLETS.map(w => (
                  <Pressable key={w.id} style={[styles.walletOption, selectedWallet?.id === w.id && styles.walletOptionSelected]} onPress={() => setSelectedWallet(w)}>
                    <Text style={styles.walletLogo}>{w.icon || "🦊"}</Text>
                    <Text style={styles.walletName}>{w.name}</Text>
                    <Text style={styles.walletSub}>Connect using {w.name}</Text>
                    {selectedWallet?.id === w.id && <View style={styles.radioChecked}><View style={styles.radioInner} /></View>}
                    {selectedWallet?.id !== w.id && <View style={styles.radioUnchecked} />}
                  </Pressable>
                ))}
              </View>
              <View style={styles.spacer} />
              <Pressable style={[styles.primaryBtn, !selectedWallet && styles.primaryBtnDisabled]} disabled={!selectedWallet} onPress={() => selectedWallet && handleConnectWallet(selectedWallet)}>
                <Text style={styles.primaryBtnText}>Connect Wallet</Text>
              </Pressable>
              <Pressable style={styles.cancelLink} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'select-network' && (
            <View style={styles.content}>
              {renderHeader('', true, 2)}
              <Text style={styles.titleLeft}>Select Network</Text>
              <Text style={styles.subtitleLeft}>Choose the network for your deposit</Text>
              <View style={styles.optionsList}>
                {(Object.keys(NETWORK_CONFIG) as NetworkId[]).map(net => (
                  <Pressable key={net} style={[styles.walletOption, selectedNetwork === net && styles.walletOptionSelected]} onPress={() => handleSelectNetwork(net)}>
                    <Text style={styles.walletLogo}>🌐</Text>
                    <Text style={styles.walletName}>{net}</Text>
                    {selectedNetwork === net && <View style={styles.radioChecked}><View style={styles.radioInner} /></View>}
                    {selectedNetwork !== net && <View style={styles.radioUnchecked} />}
                  </Pressable>
                ))}
              </View>
              <View style={styles.spacer} />
              <Pressable style={styles.cancelLink} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'select-asset' && (
            <View style={styles.content}>
              {renderHeader('', true, 3)}
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.titleLeft}>Select Asset</Text>
                  <Text style={styles.subtitleLeft}>Available in your wallet on {selectedNetwork}</Text>
                </View>
                {selectedWallet && (
                  <View style={styles.pill}>
                    <Text style={{ fontSize: 10 }}>🦊</Text>
                    <Text style={styles.pillText}>{selectedWallet.name.split(' ')[0]}</Text>
                  </View>
                )}
              </View>
              <View style={styles.searchBar}>
                <Text style={{ color: '#aaa', marginRight: 8 }}>🔍</Text>
                <TextInput style={styles.searchInput} placeholder="Search asset" placeholderTextColor="#aaa" editable={false} />
              </View>
              {isFetchingBalances ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={PURPLE} />
                  <Text style={{ marginTop: 16, color: '#666' }}>Fetching real balances...</Text>
                </View>
              ) : (
                assets.map(asset => (
                  <Pressable key={asset.symbol} style={[styles.assetRow, asset.amount === 0 && { opacity: 0.6 }]} onPress={() => { setSelectedAsset(asset); setStep('enter-amount'); }}>
                    <View style={[styles.assetIcon, { backgroundColor: asset.color }]}><Text style={{ color: 'white', fontWeight: 'bold' }}>{asset.symbol[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.assetBalance}>{asset.balance}</Text>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    </View>
                  </Pressable>
                ))
              )}
              <View style={styles.spacer} />
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'enter-amount' && (
            <View style={styles.content}>
              {renderHeader('', true, 4)}
              <View style={styles.centerCol}>
                <View style={[styles.assetIconLarge, { backgroundColor: selectedAsset.color }]}><Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{selectedAsset.symbol[0]}</Text></View>
                <Text style={styles.titleCenter}>Enter amount to transfer</Text>
                <Text style={styles.subtitleCenter}>Available: {selectedAsset.balance} {selectedAsset.symbol}</Text>
                
                <View style={styles.amountInputDisplay}>
                  <Text style={[styles.amountText, !amountStr && { color: '#bbb' }]}>{amountStr || "0"}</Text>
                  <View style={styles.verticalDivider} />
                  <Text style={styles.amountSymbol}>{selectedAsset.symbol}</Text>
                </View>
                <Text style={styles.usdValue}>~ ${amountStr || "0"}</Text>

                <View style={styles.presetRow}>
                  <Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount * 0.1).toString())}><Text style={styles.presetText}>10%</Text></Pressable>
                  <Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount * 0.5).toString())}><Text style={styles.presetText}>50%</Text></Pressable>
                  <Pressable style={styles.presetBtn} onPress={() => setAmountStr((selectedAsset.amount).toString())}><Text style={styles.presetText}>Max</Text></Pressable>
                </View>
              </View>
              
              <View style={styles.spacer} />
              <Pressable style={[styles.primaryBtn, { marginBottom: 16 }]} onPress={() => setStep('review')}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
              
              {/* Custom Numpad */}
              <View style={styles.numpad}>
                {['1','2','3','4','5','6','7','8','9','.', '0', 'back'].map(k => (
                  <Pressable key={k} style={styles.numKey} onPress={() => handleNumpad(k)}>
                    {k === 'back' ? <Text style={styles.numText}>⌫</Text> : <Text style={styles.numText}>{k}</Text>}
                  </Pressable>
                ))}
              </View>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'review' && (
            <View style={styles.content}>
              {renderHeader('', true)}
              <View style={styles.centerCol}>
                <View style={[styles.assetIconLarge, { backgroundColor: '#eef2ff' }]}><Text style={{ fontSize: 24 }}>📄</Text></View>
                <Text style={styles.titleCenter}>Review</Text>
                <Text style={[styles.subtitleCenter, { paddingHorizontal: 32 }]}>
                  You're depositing {amountStr || "0"} {selectedAsset.symbol} from {selectedWallet?.name || 'Wallet'} to your NeoUAE account
                </Text>
              </View>

              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>You deposit</Text>
                  <Text style={styles.reviewValue}>{amountStr || "0"} {selectedAsset.symbol}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Orki fee</Text>
                  <Text style={[styles.reviewValue, { color: '#000' }]}>FREE</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Network fee</Text>
                  <Text style={styles.reviewValue}>{selectedNetwork || 'Wallet'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Est. time</Text>
                  <Text style={styles.reviewValue}>~ 5 minutes</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>ℹ️</Text>
                <Text style={styles.infoText}>Withdrawal and deposit transactions are on the main network. You might still have to pay network fees.</Text>
              </View>

              <View style={styles.spacer} />
              <Pressable style={styles.primaryBtn} onPress={handleConfirmAndSign}>
                <Text style={styles.primaryBtnText}>Confirm & Sign</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'processing' && (
            <View style={styles.content}>
              {renderHeader('', false)}
              <View style={styles.centerCol}>
                 <ActivityIndicator size="large" color={PURPLE} style={{ marginBottom: 16 }} />
                 <Text style={styles.titleCenter}>Processing</Text>
                 <Text style={styles.subtitleCenter}>
                    Once the deposit is complete, your updated balance will appear in your account.
                 </Text>
              </View>

              <View style={styles.statusList}>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotActive} />
                  <View>
                    <Text style={styles.statusTitle}>Transaction broadcasted</Text>
                    <Text style={styles.statusSub}>Arriving in 4 min</Text>
                  </View>
                </View>
                <View style={styles.statusLine} />
                <View style={styles.statusRow}>
                  <View style={styles.statusDotInactive} />
                  <Text style={styles.statusTitleInactive}>1/2 confirmations</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotInactive} />
                  <Text style={styles.statusTitleInactive}>2/2 confirmations</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotInactive} />
                  <Text style={styles.statusTitleInactive}>Confirmed</Text>
                </View>
              </View>

              <View style={styles.spacer} />
              <Text style={styles.footerNote}>Closing this window will not impact your transaction.</Text>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'failed' && (
            <View style={styles.content}>
              {renderHeader('', false)}
              <View style={styles.centerCol}>
                <View style={[styles.logoCircle, { backgroundColor: '#ffebee' }]}>
                  <Text style={{ fontSize: 32 }}>❌</Text>
                </View>
                <Text style={styles.titleCenter}>Deposit Failed</Text>
                <Text style={styles.subtitleCenter}>Unfortunately, your deposit couldn't be processed.</Text>
                <Text style={[styles.subtitleCenter, { marginTop: 16 }]}>An unknown error occurred. Please try again later.</Text>
              </View>
              <View style={styles.spacer} />
              <Pressable style={styles.primaryBtn} onPress={() => setStep('enter-amount')}>
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.content}>
              {renderHeader('', false)}
              <View style={styles.centerCol}>
                <View style={[styles.logoCircle, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={{ fontSize: 32 }}>✅</Text>
                </View>
                <Text style={styles.titleCenter}>Transfer Successful</Text>
                <Text style={styles.subtitleCenter}>You successfully transferred {amountStr} {selectedAsset.symbol} from {selectedWallet?.name || 'Wallet'} to NeoUAE</Text>
              </View>

              <View style={styles.successBox}>
                <Text style={styles.successAmount}>{amountStr} {selectedAsset.symbol}</Text>
                <Text style={styles.successDate}>Feb 23, 2025, 12:09 PM</Text>
                <View style={styles.divider} />
                <Text style={styles.txLabel}>Transaction ID</Text>
                <Text style={styles.txId}>{txid}</Text>
              </View>

              <View style={styles.spacer} />
              <Pressable style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Return to App</Text>
              </Pressable>
              <Text style={styles.poweredByCenter}>Powered by Orki</Text>
            </View>
          )}

        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
