import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  Linking as RNLinking,
  Image as RNImage,
} from "react-native";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { WalletInfo, OrkiConnect } from "../index";
import { NETWORK_CONFIG, NetworkId, getEnvConfig } from "../config";
import { fetchBalances } from "../api";
import { WalletIcon } from "./WalletIcons";
import { NetworkIcon } from "./NetworkIcons";
import { PoweredByOrki } from "./PoweredByOrki";
import { styles, PURPLE } from "./OrkiConnectModal.styles";

export interface OrkiConnectModalProps {
  visible: boolean;
  onClose: () => void;
  bankAddress: string;
  sdk: OrkiConnect;
  onSuccess?: (txid: string) => void;
  onError?: (error: string) => void;
  hasAgreedBefore?: boolean;
  onAgreementAccepted?: () => void;
  /** Session ID pre-created by your bank backend — skips internal initializeSession call */
  sessionId?: string;
  /** Session JWT issued alongside sessionId */
  sessionJwt?: string;
  /** User ID to associate with transactions */
  userId?: string;
}

const WALLETS: WalletInfo[] = [
  {
    id: "metamask",
    name: "MetaMask",
    scheme: "metamask://connect?redirect_link={redirect}",
    icon: "🦊",
  },
  {
    id: "phantom",
    name: "Phantom",
    scheme: "phantom://v1/connect?redirect_link={redirect}",
    icon: "👻",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    scheme: "cbwallet://connect?redirect_link={redirect}",
    icon: "🔵",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    scheme: "trust://connect?redirect_link={redirect}",
    icon: "🛡️",
  },
  {
    id: "binance",
    name: "Binance Web3",
    scheme: "bnc://connect?redirect_link={redirect}",
    icon: "🟡",
  },
];

const ASSETS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    balance: "0.00",
    amount: 0,
    color: "#2775CA",
  },
  {
    symbol: "USDT",
    name: "Tether",
    balance: "0.00",
    amount: 0,
    color: "#26A17B",
  },
  { symbol: "DAI", name: "Dai", balance: "0.00", amount: 0, color: "#F4B731" },
];

type Step =
  | "onboarding"
  | "add-crypto"
  | "connect-wallet"
  | "select-network"
  | "select-asset"
  | "enter-amount"
  | "review"
  | "signing"
  | "processing"
  | "success"
  | "failed";

const TOTAL_STEPS = 4;

// Solana connection used only for finalization polling
const SOLANA_CONNECTION = new Connection(clusterApiUrl("devnet"), "finalized");

function getExplorerUrl(txid: string, chainId: number | undefined): string | null {
  if (!txid || txid === 'submitted') return null;
  if (chainId === 1 || chainId === 11155111)  return `https://etherscan.io/tx/${txid}`;
  if (chainId === 8453 || chainId === 84532)  return `https://basescan.org/tx/${txid}`;
  if (chainId === 137 || chainId === 80002)   return `https://polygonscan.com/tx/${txid}`;
  return `https://solscan.io/tx/${txid}`;
}

export function OrkiConnectModal({
  visible,
  onClose,
  bankAddress,
  sdk,
  onSuccess,
  onError,
  hasAgreedBefore,
  onAgreementAccepted,
  sessionId: sessionIdProp,
  sessionJwt: sessionJwtProp,
  userId: userIdProp,
}: OrkiConnectModalProps) {
  const [step, setStep] = useState<Step>("onboarding");
  const [agreed, setAgreed] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId | null>(
    null,
  );
  const [assets, setAssets] = useState(ASSETS);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [amountStr, setAmountStr] = useState("");
  const [txid, setTxid] = useState("");
  const [activeChainId, setActiveChainId] = useState<number | undefined>(undefined);
  const [walletAddress, setWalletAddress] = useState("");
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [confirmationCount, setConfirmationCount] = useState(0);

  // Ref to cancel polling if modal closes mid-flight
  const pollingRef = useRef<boolean>(false);

  useEffect(() => {
    if (visible) {
      setStep(hasAgreedBefore ? "add-crypto" : "onboarding");
      setAgreed(hasAgreedBefore || false);
      setSelectedWallet(null);
      setSelectedNetwork(null);
      setAssets(ASSETS);
      setWalletAddress("");
      setAmountStr("");
      setTxid("");
      setActiveChainId(undefined);
      setConfirmationCount(0);
      setIsFetchingBalances(false);
      pollingRef.current = false;
    } else {
      // Cancel any in-flight polling when modal closes
      pollingRef.current = false;
    }
  }, [visible, hasAgreedBefore]);

  const goBack = () => {
    switch (step) {
      case "add-crypto":
        setStep(hasAgreedBefore ? "add-crypto" : "onboarding");
        break;
      case "connect-wallet":
        setStep("add-crypto");
        break;
      case "select-network":
        setStep("connect-wallet");
        break;
      case "select-asset":
        setStep("select-network");
        break;
      case "enter-amount":
        setStep("select-asset");
        break;
      case "review":
        setStep("enter-amount");
        break;
      case "signing":
        setStep("review");
        break;
      default:
        onClose();
    }
  };

  const handleConnectWallet = async (wallet: WalletInfo) => {
    setSelectedWallet(wallet);
    try {
      const address = await sdk.connect(wallet);
      setWalletAddress(address);
      setStep("select-network");
    } catch (e) {
      setWalletAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
      setStep("select-network");
    }
  };

  const handleSelectNetwork = async (network: NetworkId) => {
    setSelectedNetwork(network);
    setStep("select-asset");
    setIsFetchingBalances(true);
    const addr = walletAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const finalAddr =
      network === "SOLANA"
        ? addr.startsWith("0x")
          ? "5Q544fKrToePTgAcHbZc4y7m4bQrkBbnk4KZbG1f2P4v"
          : addr
        : addr.startsWith("0x")
          ? addr
          : "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const balances = await fetchBalances(network, finalAddr);
    const newAssets = ASSETS.map((asset) => {
      const amount = balances[asset.symbol] ?? 0;
      return {
        ...asset,
        amount,
        balance: amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }),
      };
    });
    setAssets(newAssets);
    setIsFetchingBalances(false);
  };

  const handleNumpad = (val: string) => {
    if (val === "back") {
      setAmountStr((prev) => prev.slice(0, -1));
    } else if (val === ".") {
      if (!amountStr.includes(".")) setAmountStr((prev) => prev + ".");
    } else {
      setAmountStr((prev) => (prev === "0" ? val : prev + val));
    }
  };

  /**
   * Polls Solana for finalization of `signature`.
   * - Fires the backend API call immediately (fire-and-forget).
   * - Polls every 3 s for up to 2 min; moves to success/failed accordingly.
   */
  const pollForFinalization = async (
    signature: string,
    amount: number,
    symbol: string,
    network: NetworkId,
  ) => {
    pollingRef.current = true;

    // ── Fire-and-forget API report ──────────────────────────────────────────
    sdk.reportTransaction(signature, amount, symbol, network, sessionIdProp, sessionJwtProp, userIdProp).catch(
      (err) => console.warn("[OrkiConnect] reportTransaction failed:", err),
    );

    // ── Poll for finalization ───────────────────────────────────────────────
    const MAX_ATTEMPTS = 40; // 40 × 3 s = 120 s
    const POLL_INTERVAL_MS = 3000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!pollingRef.current) return; // Modal was closed — abort silently

      try {
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses(
          [signature],
          {
            searchTransactionHistory: true,
          },
        );
        console.log(statuses);
        const status = statuses?.value?.[0];

        if (status) {
          // Update confirmation count for UI
          const confirmations =
            typeof status.confirmations === "number" ? status.confirmations : 0;
          setConfirmationCount(confirmations);

          if (
            status.confirmationStatus === "finalized" ||
            status.confirmationStatus === "confirmed"
          ) {
            if (pollingRef.current) {
              pollingRef.current = false;
              setStep("success");
            }
            return;
          }

          if (status.err) {
            if (pollingRef.current) {
              pollingRef.current = false;
              setStep("failed");
              if (onError) onError("Transaction failed on-chain");
            }
            return;
          }
        }
      } catch (e) {
        console.warn("[OrkiConnect] Polling error:", e);
      }

      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Timed out
    if (pollingRef.current) {
      pollingRef.current = false;
      setStep("failed");
      if (onError) onError("Transaction confirmation timed out");
    }
  };

  const handleConfirmAndSign = async () => {
    if (!selectedNetwork) return;
    const amount = parseFloat(amountStr || "0");
    if (amount <= 0 || amount > selectedAsset.amount) {
      if (onError) onError("Invalid amount");
      return;
    }
    setStep("signing");
    try {
      const { tokens, chainId } = getEnvConfig(selectedNetwork);
      setActiveChainId(chainId);
      const tokenCfg = tokens[selectedAsset.symbol];
      if (!tokenCfg)
        throw new Error(
          `${selectedAsset.symbol} not supported on ${selectedNetwork}`,
        );

      if (!sessionIdProp || !sessionJwtProp) {
        await sdk
          .initializeSession(selectedNetwork, selectedAsset.symbol)
          .catch(() => {
            console.warn(
              "[OrkiConnect] Session init failed — proceeding without session tracking",
            );
          });
      }

      const result = await sdk.transferToBank(
        bankAddress,
        amount,
        {
          mint: tokenCfg.address,
          decimals: tokenCfg.decimals,
          ...(chainId !== undefined && { chainId }),
        },
        () => {
          // User signed — move to processing and begin finalization polling
          setStep("processing");
        },
        selectedWallet?.id,
      );

      if (result.error) throw new Error(result.error);

      const returnedTxid = result.txid || "";
      setTxid(returnedTxid);

      if (
        selectedNetwork === "SOLANA" &&
        returnedTxid &&
        returnedTxid !== "submitted"
      ) {
        // Solana: poll for on-chain finalization
        pollForFinalization(
          returnedTxid,
          amount,
          selectedAsset.symbol,
          selectedNetwork,
        );
      } else {
        // EVM or no txid: move straight to success
        setStep("success");
      }
    } catch (error: any) {
      setStep("failed");
      if (onError) onError(error.message || String(error));
    }
  };

  // ─── Header ───────────────────────────────────────────────────────────────
  const renderHeader = (
    title: string,
    showBack: boolean,
    progress?: number,
  ) => (
    <View style={styles.headerWrapper}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable onPress={goBack} hitSlop={8} style={styles.headerBackBtn}>
            <Text style={styles.headerBackArrow}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.headerBackBtn} />
        )}
        {title ? (
          <Text style={styles.headerTitle}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable onPress={onClose} hitSlop={8} style={styles.headerCloseBtn}>
          <Text style={styles.headerCloseIcon}>✕</Text>
        </Pressable>
      </View>

      {progress !== undefined && (
        <View style={styles.progressSection}>
          <Text style={styles.stepText}>
            Step {progress} of {TOTAL_STEPS}
          </Text>
          <View style={styles.progressSegments}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < progress
                    ? styles.progressSegmentActive
                    : styles.progressSegmentInactive,
                  i < TOTAL_STEPS - 1 && { marginRight: 6 },
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* ONBOARDING */}
          {step === "onboarding" && (
            <View style={styles.content}>
              {renderHeader("", false)}
              <View style={styles.centerCol}>
                <View style={styles.logoCircle}>
                  <RNImage
                    source={require("../assets/clock.png")}
                    style={{ width: 48, height: 48 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>Fast & seamless transfer</Text>
                <Text style={styles.subtitle}>
                  Your transfer is processed almost instantly, ensuring quick
                  access to funds.
                </Text>
              </View>
              <View style={styles.spacer} />
              <View style={styles.onboardingCard}>
                <RNImage
                  source={require("../assets/clock.png")}
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                />
                <RNImage
                  source={require("../assets/logo.png")}
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                />
                <Text style={styles.cardTitle}>NeoUAE partners with Orki</Text>
                <Text style={styles.cardSub}>
                  NeoUAE uses Orki to allow you to transfer crypto from an
                  external account.
                </Text>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setAgreed(!agreed)}
                >
                  <View
                    style={[styles.checkbox, agreed && styles.checkboxChecked]}
                  >
                    {agreed && (
                      <Text style={{ color: "white", fontSize: 10 }}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.termsText}>
                    {"I read and agree to Orki's "}
                    <Text style={styles.termsLink}>
                      User Agreements, Regulatory Disclosures
                    </Text>
                    {", "}
                    <Text style={styles.termsLink}>
                      Third-Party Transaction Disclosures
                    </Text>
                    {" and "}
                    <Text style={styles.termsLink}>Privacy Notice</Text>
                    {"."}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    !agreed && styles.primaryBtnDisabled,
                  ]}
                  disabled={!agreed}
                  onPress={() => {
                    if (onAgreementAccepted) onAgreementAccepted();
                    setStep("add-crypto");
                  }}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </Pressable>
                <PoweredByOrki marginTop={12} />
              </View>
            </View>
          )}

          {/* ADD CRYPTO */}
          {step === "add-crypto" && (
            <View style={styles.content}>
              {renderHeader("", true)}
              <View style={styles.centerCol}>
                <View style={styles.logoCircleSmall}>
                  <RNImage
                    source={require("../assets/crypto.png")}
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>Add Crypto</Text>
                <Text style={styles.subtitle}>Fund your account securely</Text>
              </View>
              <View style={styles.optionsList}>
                <Pressable
                  style={styles.optionBtn}
                  onPress={() => setStep("connect-wallet")}
                >
                  <View style={styles.optionIcon}>
                    <Text>💼</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Connect Wallet</Text>
                    <Text style={styles.optionSub}>
                      Transfer from your crypto wallet
                    </Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
                <View style={[styles.optionBtn, { opacity: 0.5 }]}>
                  <View style={styles.optionIcon}>
                    <Text>🏦</Text>
                  </View>
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
              <PoweredByOrki />
            </View>
          )}

          {/* CONNECT WALLET */}
          {step === "connect-wallet" && (
            <View style={styles.content}>
              {renderHeader("Wallet Connect", true, 1)}
              <Text style={styles.titleLeft}>Connect Your Wallet</Text>
              <Text style={styles.subtitleLeft}>
                Choose a wallet to continue
              </Text>
              <View style={styles.optionsList}>
                {WALLETS.map((w) => (
                  <Pressable
                    key={w.id}
                    style={[
                      styles.walletOption,
                      selectedWallet?.id === w.id &&
                        styles.walletOptionSelected,
                    ]}
                    onPress={() => setSelectedWallet(w)}
                  >
                    <WalletIcon walletId={w.id} size={40} />
                    <Text style={styles.walletName}>{w.name}</Text>
                    {selectedWallet?.id === w.id ? (
                      <View style={styles.radioChecked}>
                        <View style={styles.radioInner} />
                      </View>
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </Pressable>
                ))}
              </View>
              <View style={styles.spacer} />
              <Pressable
                style={[
                  styles.primaryBtn,
                  !selectedWallet && styles.primaryBtnDisabled,
                ]}
                disabled={!selectedWallet}
                onPress={() =>
                  selectedWallet && handleConnectWallet(selectedWallet)
                }
              >
                <Text style={styles.primaryBtnText}>Connect Wallet</Text>
              </Pressable>
              <Pressable style={styles.cancelLink} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <PoweredByOrki />
            </View>
          )}

          {/* SELECT NETWORK */}
          {step === "select-network" && (
            <View style={styles.content}>
              {renderHeader("", true, 2)}
              <Text style={styles.titleLeft}>Select Network</Text>
              <Text style={styles.subtitleLeft}>
                Choose the network for your deposit
              </Text>
              <View style={styles.optionsList}>
                {(Object.keys(NETWORK_CONFIG) as NetworkId[]).map((net) => (
                  <Pressable
                    key={net}
                    style={[
                      styles.walletOption,
                      selectedNetwork === net && styles.walletOptionSelected,
                    ]}
                    onPress={() => handleSelectNetwork(net)}
                  >
                    <NetworkIcon networkId={net} size={40} />
                    <Text style={styles.walletName}>{net}</Text>
                    {selectedNetwork === net ? (
                      <View style={styles.radioChecked}>
                        <View style={styles.radioInner} />
                      </View>
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </Pressable>
                ))}
              </View>
              <View style={styles.spacer} />
              <Pressable style={styles.cancelLink} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <PoweredByOrki />
            </View>
          )}

          {/* SELECT ASSET */}
          {step === "select-asset" && (
            <View style={styles.content}>
              {renderHeader("", true, 3)}
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.titleLeft}>Select Asset</Text>
                  <Text style={styles.subtitleLeft}>
                    Available in your wallet on {selectedNetwork}
                  </Text>
                </View>
                {selectedWallet && (
                  <View style={styles.pill}>
                    <WalletIcon walletId={selectedWallet.id} size={16} />
                    <Text style={styles.pillText}>
                      {selectedWallet.name.split(" ")[0]}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.searchBar}>
                <RNImage
                  source={require("../assets/search.png")}
                  style={{ width: 16, height: 16, marginRight: 8 }}
                  resizeMode="contain"
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search asset"
                  placeholderTextColor="#aaa"
                  editable={false}
                />
              </View>
              {isFetchingBalances ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color={PURPLE} />
                  <Text style={{ marginTop: 16, color: "#666" }}>
                    Fetching real balances...
                  </Text>
                </View>
              ) : (
                assets.map((asset) => (
                  <Pressable
                    key={asset.symbol}
                    style={[
                      styles.assetRow,
                      asset.amount === 0 && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      setSelectedAsset(asset);
                      setStep("enter-amount");
                    }}
                  >
                    <View
                      style={[
                        styles.assetIcon,
                        { backgroundColor: asset.color },
                      ]}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>
                        {asset.symbol[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.assetBalance}>{asset.balance}</Text>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    </View>
                  </Pressable>
                ))
              )}
              <View style={styles.spacer} />
              <PoweredByOrki />
            </View>
          )}

          {/* ENTER AMOUNT */}
          {step === "enter-amount" && (
            <View style={styles.content}>
              {renderHeader("", true, 4)}
              <View style={styles.centerCol}>
                <View
                  style={[
                    styles.assetIconLarge,
                    { backgroundColor: selectedAsset.color },
                  ]}
                >
                  <Text
                    style={{ color: "white", fontSize: 24, fontWeight: "bold" }}
                  >
                    {selectedAsset.symbol[0]}
                  </Text>
                </View>
                <Text style={styles.titleCenter}>Enter amount to transfer</Text>
                <Text style={styles.subtitleCenter}>
                  Available: {selectedAsset.balance} {selectedAsset.symbol}
                </Text>
                <View style={styles.amountInputDisplay}>
                  <Text
                    style={[styles.amountText, !amountStr && { color: "#bbb" }]}
                  >
                    {amountStr || "0"}
                  </Text>
                  <View style={styles.verticalDivider} />
                  <Text style={styles.amountSymbol}>
                    {selectedAsset.symbol}
                  </Text>
                </View>
                <Text style={styles.usdValue}>~ ${amountStr || "0"}</Text>
                <View style={styles.presetRow}>
                  <Pressable
                    style={styles.presetBtn}
                    onPress={() =>
                      setAmountStr((selectedAsset.amount * 0.1).toString())
                    }
                  >
                    <Text style={styles.presetText}>10%</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetBtn}
                    onPress={() =>
                      setAmountStr((selectedAsset.amount * 0.5).toString())
                    }
                  >
                    <Text style={styles.presetText}>50%</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetBtn}
                    onPress={() =>
                      setAmountStr(selectedAsset.amount.toString())
                    }
                  >
                    <Text style={styles.presetText}>Max</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.spacer} />
              <Pressable
                style={[styles.primaryBtn, { marginBottom: 16 }]}
                onPress={() => setStep("review")}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
              <View style={styles.numpad}>
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  ".",
                  "0",
                  "back",
                ].map((k) => (
                  <Pressable
                    key={k}
                    style={styles.numKey}
                    onPress={() => handleNumpad(k)}
                  >
                    {k === "back" ? (
                      <Text style={styles.numText}>⌫</Text>
                    ) : (
                      <Text style={styles.numText}>{k}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
              <PoweredByOrki />
            </View>
          )}

          {/* REVIEW */}
          {step === "review" && (
            <View style={styles.content}>
              {renderHeader("", true)}
              <View style={styles.centerCol}>
                <View
                  style={[
                    styles.assetIconLarge,
                    { backgroundColor: "#eef2ff" },
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>📄</Text>
                </View>
                <Text style={styles.titleCenter}>Review</Text>
                <Text
                  style={[styles.subtitleCenter, { paddingHorizontal: 32 }]}
                >
                  You're depositing {amountStr || "0"} {selectedAsset.symbol}{" "}
                  from {selectedWallet?.name || "Wallet"} to your NeoUAE account
                </Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>You deposit</Text>
                  <Text style={styles.reviewValue}>
                    {amountStr || "0"} {selectedAsset.symbol}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Orki fee</Text>
                  <Text style={[styles.reviewValue, { color: "#000" }]}>
                    FREE
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Network fee</Text>
                  <Text style={styles.reviewValue}>
                    {selectedNetwork || "Wallet"}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Est. time</Text>
                  <Text style={styles.reviewValue}>~ 5 minutes</Text>
                </View>
              </View>
              <View style={styles.infoBox}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>ℹ️</Text>
                <Text style={styles.infoText}>
                  Withdrawal and deposit transactions are on the main network.
                  You might still have to pay network fees.
                </Text>
              </View>
              <View style={styles.spacer} />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleConfirmAndSign}
              >
                <Text style={styles.primaryBtnText}>Confirm & Sign</Text>
              </Pressable>
              <PoweredByOrki />
            </View>
          )}

          {/* SIGNING */}
          {step === "signing" && (
            <View style={styles.content}>
              {renderHeader("", false)}
              <View style={styles.centerCol}>
                <View style={styles.walletWaitCircle}>
                  {selectedWallet ? (
                    <View style={{ position: "relative" }}>
                      <WalletIcon walletId={selectedWallet.id} size={64} />
                      {selectedNetwork && (
                        <View style={{
                          position: "absolute",
                          bottom: -4,
                          right: -4,
                          borderRadius: 12,
                          backgroundColor: "#fff",
                          padding: 2,
                        }}>
                          <NetworkIcon networkId={selectedNetwork} size={24} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 36 }}>🔏</Text>
                  )}
                </View>
                <Text style={styles.titleCenter}>Waiting for Approval</Text>
                <Text style={styles.subtitleCenter}>
                  Please approve the transaction in{" "}
                  {selectedWallet?.name || "your wallet"} to continue.
                </Text>
              </View>
              <View style={styles.statusList}>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotActive} />
                  <View>
                    <Text style={styles.statusTitle}>Approve in wallet</Text>
                    <Text style={styles.statusSub}>
                      Waiting for your signature…
                    </Text>
                  </View>
                </View>
                <View style={styles.statusLine} />
                <View style={styles.statusRow}>
                  <View style={styles.statusDotInactive} />
                  <Text style={styles.statusTitleInactive}>
                    Broadcast to network
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotInactive} />
                  <Text style={styles.statusTitleInactive}>Confirmed</Text>
                </View>
              </View>
              <View style={styles.spacer} />
              <Text style={styles.footerNote}>
                Do not close {selectedWallet?.name || "your wallet"} until
                you've approved.
              </Text>
              <PoweredByOrki />
            </View>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <View style={styles.content}>
              {renderHeader("", false)}
              <View style={styles.centerCol}>
                <ActivityIndicator
                  size="large"
                  color={PURPLE}
                  style={{ marginBottom: 16 }}
                />
                <Text style={styles.titleCenter}>Processing</Text>
                <Text style={styles.subtitleCenter}>
                  Once the deposit is complete, your updated balance will appear
                  in your account.
                </Text>
              </View>
              <View style={styles.statusList}>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotActive} />
                  <View>
                    <Text style={styles.statusTitle}>
                      Transaction broadcasted
                    </Text>
                    <Text style={styles.statusSub}>
                      Waiting for confirmation…
                    </Text>
                  </View>
                </View>
                <View style={styles.statusLine} />
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDotInactive,
                      confirmationCount >= 1 && styles.statusDotActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusTitleInactive,
                      confirmationCount >= 1 && styles.statusTitle,
                    ]}
                  >
                    {confirmationCount >= 1
                      ? `${confirmationCount} confirmations`
                      : "Awaiting confirmations"}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDotInactive,
                      confirmationCount >= 32 && styles.statusDotActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusTitleInactive,
                      confirmationCount >= 32 && styles.statusTitle,
                    ]}
                  >
                    Finalized
                  </Text>
                </View>
              </View>
              <View style={styles.spacer} />
              <Text style={styles.footerNote}>
                Closing this window will not impact your transaction.
              </Text>
              <PoweredByOrki />
            </View>
          )}

          {/* FAILED */}
          {step === "failed" && (
            <View style={styles.content}>
              {renderHeader("", false)}
              <View style={styles.centerCol}>
                <View
                  style={[styles.logoCircle, { backgroundColor: "#ffebee" }]}
                >
                  <Text style={{ fontSize: 32 }}>❌</Text>
                </View>
                <Text style={styles.titleCenter}>Deposit Failed</Text>
                <Text style={styles.subtitleCenter}>
                  Unfortunately, your deposit couldn't be processed.
                </Text>
                <Text style={[styles.subtitleCenter, { marginTop: 16 }]}>
                  An unknown error occurred. Please try again later.
                </Text>
              </View>
              <View style={styles.spacer} />
              <Pressable
                style={styles.primaryBtn}
                onPress={() => setStep("enter-amount")}
              >
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </Pressable>
              <PoweredByOrki />
            </View>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <View style={styles.content}>
              <View style={[styles.headerRow, { marginBottom: 16 }]}>
                <View style={styles.headerBackBtn} />
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={styles.headerCloseBtn}
                >
                  <Text style={styles.headerCloseIcon}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.centerCol}>
                <View style={styles.successCheckOuter}>
                  <View style={styles.successCheckInner}>
                    <Text
                      style={{
                        fontSize: 28,
                        color: "white",
                        fontWeight: "700",
                      }}
                    >
                      ✓
                    </Text>
                  </View>
                </View>
                <Text style={styles.titleCenter}>Transfer Successful</Text>
                <Text style={styles.subtitleCenter}>
                  You successfully transferred {amountStr}{" "}
                  {selectedAsset.symbol} from {selectedWallet?.name || "Wallet"}{" "}
                  to NeoUAE
                </Text>
              </View>
              <View style={styles.successStatusList}>
                <View style={styles.statusRow}>
                  <View style={styles.successDotSmall} />
                  <Text style={styles.statusTitleInactive}>Processing</Text>
                </View>
                <View style={styles.successStatusLine} />
                <View style={styles.statusRow}>
                  <View style={styles.statusDotActive} />
                  <View>
                    <Text style={styles.statusTitle}>Completed</Text>
                    <Text style={styles.statusSub}>
                      Transfer was successful
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: "center", marginVertical: 16 }}>
                <Text style={styles.successAmountLarge}>
                  {amountStr} {selectedAsset.symbol}
                </Text>
                <Text style={styles.successDate}>
                  {new Date().toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>
              <View style={styles.txCard}>
                <Text style={styles.txLabel}>Transaction ID</Text>
                <View style={styles.txRow}>
                  <Text
                    style={styles.txIdTruncated}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {txid || "—"}
                  </Text>
                  {!!txid && txid !== 'submitted' && (
                    <Pressable
                      hitSlop={8}
                      onPress={() => Alert.alert("Copied", txid)}
                    >
                      <Text style={{ fontSize: 16, marginLeft: 8 }}>📋</Text>
                    </Pressable>
                  )}
                </View>
                {(() => {
                  const explorerUrl = getExplorerUrl(txid, activeChainId);
                  return explorerUrl ? (
                    <Pressable
                      style={{ marginTop: 12, alignItems: "center" }}
                      onPress={() => RNLinking.openURL(explorerUrl)}
                    >
                      <Text style={styles.explorerLink}>View on Explorer ↗</Text>
                    </Pressable>
                  ) : txid === 'submitted' ? (
                    <Text style={[styles.explorerLink, { opacity: 0.5 }]}>
                      Transaction submitted — check your wallet for status
                    </Text>
                  ) : null;
                })()}
              </View>
              <View style={styles.spacer} />
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  if (onSuccess) onSuccess(txid);
                  onClose();
                }}
              >
                <Text style={styles.primaryBtnText}>Return to App</Text>
              </Pressable>
              <PoweredByOrki />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
