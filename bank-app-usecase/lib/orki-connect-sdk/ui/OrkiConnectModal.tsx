import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Text,
  Pressable,
  ActivityIndicator,
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
import { styles, PURPLE, BOTTOM_INSET } from "./OrkiConnectModal.styles";
import {
  CHAIN_ID,
  EXPLORER_TX_URL,
  TX_SUBMITTED,
  FALLBACK_EVM_ADDRESS,
  FALLBACK_SOLANA_ADDRESS,
  SOLANA_CONFIRM_POLL_MAX_ATTEMPTS,
  SOLANA_CONFIRM_POLL_INTERVAL_MS,
} from "../constants";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnection } from "wagmi";
import { config2 } from "./config";
import { Connection2 } from "./connection";
import { WalletOptions } from "./wallet-options";
export interface OrkiConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** Solana deposit address returned from the session response */
  solanaDepositAddress: string;
  /** EVM deposit address returned from the session response */
  evmDepositAddress?: string;
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
  /** ISO 8601 expiry timestamp from the session response — drives the countdown timer */
  expiresAt?: string;
}

// Phantom: encrypted deep-link connect protocol handled by SDK.
// MetaMask: connects via @metamask/sdk deeplink, then sends tx via EIP-1193 provider.
// Other EVM wallets: no connect step — link.metamask.io deeplink fires at transfer time.
const WALLETS: WalletInfo[] = [
  {
    id: "metamask",
    name: "MetaMask",
    scheme: "metamask://",
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
    scheme: "cbwallet://",
    icon: "🔵",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    scheme: "trust://",
    icon: "🛡️",
  },
  {
    id: "binance",
    name: "Binance Web3",
    scheme: "bnc://",
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

const MAX_DEPOSIT = 10000;
const SESSION_DURATION = 15 * 60; // 15 minutes in seconds

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

// Solana connection used only for finalization polling — cluster resolved per sdk.network at runtime
let SOLANA_CONNECTION: Connection | null = null;
function getSolanaConnection(sdk: OrkiConnect): Connection {
  const cluster = sdk.network === "mainnet" ? "mainnet-beta" : "devnet";
  if (
    !SOLANA_CONNECTION ||
    (SOLANA_CONNECTION as any)._rpcEndpoint !== clusterApiUrl(cluster)
  ) {
    SOLANA_CONNECTION = new Connection(clusterApiUrl(cluster), "finalized");
  }
  return SOLANA_CONNECTION;
}

function getExplorerUrl(
  txid: string,
  chainId: number | undefined,
): string | null {
  if (!txid || txid === TX_SUBMITTED) return null;
  if (chainId === CHAIN_ID.ETH_MAINNET || chainId === CHAIN_ID.ETH_SEPOLIA)
    return `${EXPLORER_TX_URL.ETHERSCAN}/${txid}`;
  if (chainId === CHAIN_ID.BASE_MAINNET || chainId === CHAIN_ID.BASE_SEPOLIA)
    return `${EXPLORER_TX_URL.BASESCAN}/${txid}`;
  if (chainId === CHAIN_ID.POLYGON_MAINNET || chainId === CHAIN_ID.POLYGON_AMOY)
    return `${EXPLORER_TX_URL.POLYGONSCAN}/${txid}`;
  return `${EXPLORER_TX_URL.SOLSCAN}/${txid}`;
}

export function OrkiConnectModal({
  visible,
  onClose,
  solanaDepositAddress,
  evmDepositAddress,
  sdk,
  onSuccess,
  onError,
  hasAgreedBefore,
  onAgreementAccepted,
  sessionId: sessionIdProp,
  sessionJwt: sessionJwtProp,
  userId: userIdProp,
  expiresAt: expiresAtProp,
}: OrkiConnectModalProps) {
  // ── Widget animation ──────────────────────────────────────────────────────
  const SCREEN_HEIGHT = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const queryClient = new QueryClient();

  function ConnectWallet() {
    const { isConnected } = useConnection();
    if (isConnected) return <Connection2 />;
    return <WalletOptions />;
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

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
  const [activeChainId, setActiveChainId] = useState<number | undefined>(
    undefined,
  );
  const [walletAddress, setWalletAddress] = useState("");
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [confirmationCount, setConfirmationCount] = useState(0);

  // ── Countdown timer state ─────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref to cancel polling if modal closes mid-flight
  const pollingRef = useRef<boolean>(false);

  // ── Timer effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            setStep("failed");
            pollingRef.current = false;
            if (onError) onError("Session timed out");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  // ── Reset on modal open/close ─────────────────────────────────────────────
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
      setTimeLeft(
        expiresAtProp
          ? Math.max(
              0,
              Math.floor(
                (new Date(expiresAtProp).getTime() - Date.now()) / 1000,
              ),
            )
          : SESSION_DURATION,
      );
      setTimerActive(false);
      pollingRef.current = false;
    } else {
      // Cancel any in-flight polling and timer when modal closes
      pollingRef.current = false;
      setTimerActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible, hasAgreedBefore]);

  // ── Timer helpers ─────────────────────────────────────────────────────────
  const startTimer = () => {
    const secondsLeft = expiresAtProp
      ? Math.max(
          0,
          Math.floor((new Date(expiresAtProp).getTime() - Date.now()) / 1000),
        )
      : SESSION_DURATION;
    setTimeLeft(secondsLeft);
    setTimerActive(true);
  };

  const stopTimer = () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isTimerWarning = timeLeft <= 60;
  const timerStarted = timerActive || timeLeft < SESSION_DURATION;

  // ── Navigation ────────────────────────────────────────────────────────────
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

  // ── Phantom connect ───────────────────────────────────────────────────────
  const handleConnectWallet = async (wallet: WalletInfo) => {
    startTimer();
    try {
      const address = await sdk.connect(wallet);
      if (address) setWalletAddress(address);
      setStep("select-network");
    } catch (e) {
      setStep("failed");
    }
  };

  // ── Network select ────────────────────────────────────────────────────────
  const handleSelectNetwork = async (network: NetworkId) => {
    setSelectedNetwork(network);
    setStep("select-asset");
    setIsFetchingBalances(true);
    const addr = walletAddress || FALLBACK_EVM_ADDRESS;
    const finalAddr =
      network === "SOLANA"
        ? addr.startsWith("0x")
          ? FALLBACK_SOLANA_ADDRESS
          : addr
        : addr.startsWith("0x")
          ? addr
          : FALLBACK_EVM_ADDRESS;
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

  // ── Numpad input (with 10k cap) ───────────────────────────────────────────
  const handleNumpad = (val: string) => {
    if (val === "back") {
      setAmountStr((prev) => prev.slice(0, -1));
    } else if (val === ".") {
      if (!amountStr.includes(".")) setAmountStr((prev) => prev + ".");
    } else {
      const next =
        amountStr === "0" || amountStr === "" ? val : amountStr + val;
      if (parseFloat(next) <= MAX_DEPOSIT) {
        setAmountStr(next);
      }
    }
  };

  // ── Solana finalization polling ────────────────────────────────────────────
  const pollForFinalization = async (
    signature: string,
    amount: number,
    symbol: string,
    network: NetworkId,
  ) => {
    pollingRef.current = true;
    const solanaConn = getSolanaConnection(sdk);

    sdk
      .reportTransaction(
        signature,
        amount,
        symbol,
        network,
        sessionIdProp,
        sessionJwtProp,
        userIdProp,
      )
      .catch((err) =>
        console.warn("[OrkiConnect] reportTransaction failed:", err),
      );

    const MAX_ATTEMPTS = SOLANA_CONFIRM_POLL_MAX_ATTEMPTS;
    const POLL_INTERVAL_MS = SOLANA_CONFIRM_POLL_INTERVAL_MS;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!pollingRef.current) return;

      try {
        const statuses = await solanaConn.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        });
        const status = statuses?.value?.[0];

        if (status) {
          const confirmations =
            typeof status.confirmations === "number" ? status.confirmations : 0;
          setConfirmationCount(confirmations);

          if (
            status.confirmationStatus === "finalized" ||
            status.confirmationStatus === "confirmed"
          ) {
            if (pollingRef.current) {
              pollingRef.current = false;
              stopTimer();
              setStep("success");
            }
            return;
          }

          if (status.err) {
            if (pollingRef.current) {
              pollingRef.current = false;
              stopTimer();
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

    if (pollingRef.current) {
      pollingRef.current = false;
      stopTimer();
      setStep("failed");
      if (onError) onError("Transaction confirmation timed out");
    }
  };

  // ── Confirm & sign ────────────────────────────────────────────────────────
  const handleConfirmAndSign = async () => {
    if (!selectedNetwork) return;
    const amount = parseFloat(amountStr || "0");
    if (amount <= 0 || amount > selectedAsset.amount || amount > MAX_DEPOSIT) {
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

      if (chainId !== undefined && !evmDepositAddress) {
        throw new Error("evmDepositAddress is required for EVM transfers");
      }
      const depositAddress =
        chainId !== undefined ? evmDepositAddress! : solanaDepositAddress;

      const result = await sdk.transferToBank(
        depositAddress,
        amount,
        {
          mint: tokenCfg.address,
          decimals: tokenCfg.decimals,
          ...(chainId !== undefined && { chainId }),
        },
        () => {
          setStep("processing");
        },
      );

      if (result.error) throw new Error(result.error);

      const returnedTxid = result.txid || "";
      setTxid(returnedTxid);

      if (
        selectedNetwork === "SOLANA" &&
        returnedTxid &&
        returnedTxid !== TX_SUBMITTED
      ) {
        pollForFinalization(
          returnedTxid,
          amount,
          selectedAsset.symbol,
          selectedNetwork,
        );
      } else {
        stopTimer();
        setStep("success");
      }
    } catch (error: any) {
      stopTimer();
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Countdown timer pill — shown once timer has started */}
          {timerStarted && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isTimerWarning ? "#fff0f0" : "#f3f0ff",
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: isTimerWarning ? "#ffcccc" : "#e0d7ff",
              }}
            >
              <Text style={{ fontSize: 11, marginRight: 3 }}>⏱</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isTimerWarning ? "#cc0000" : PURPLE,
                  // tabular numbers keep width stable as digits change
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatTime(timeLeft)}
              </Text>
            </View>
          )}

          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.headerCloseBtn}
          >
            <Text style={styles.headerCloseIcon}>✕</Text>
          </Pressable>
        </View>
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
  if (!mounted) return null;

  return (
    <WagmiProvider config={config2}>
      <QueryClientProvider client={queryClient}>
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Backdrop — tap to close */}
          <TouchableWithoutFeedback onPress={onClose}>
            <Animated.View
              style={[styles.backdrop, { opacity: backdropAnim }]}
            />
          </TouchableWithoutFeedback>

          {/* Sliding panel */}
          <Animated.View
            style={[
              styles.widgetPanel,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={[styles.container, { paddingBottom: BOTTOM_INSET }]}>
              {/* ── ONBOARDING ─────────────────────────────────────────────────── */}
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
                      Your transfer is processed almost instantly, ensuring
                      quick access to funds.
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
                    <Text style={styles.cardTitle}>
                      NeoUAE partners with Orki
                    </Text>
                    <Text style={styles.cardSub}>
                      NeoUAE uses Orki to allow you to transfer crypto from an
                      external account.
                    </Text>
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() => setAgreed(!agreed)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          agreed && styles.checkboxChecked,
                        ]}
                      >
                        {agreed && (
                          <Text style={{ color: "white", fontSize: 10 }}>
                            ✓
                          </Text>
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

              {/* ── ADD CRYPTO ─────────────────────────────────────────────────── */}
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
                    <Text style={styles.subtitle}>
                      Fund your account securely
                    </Text>
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

              {/* ── CONNECT WALLET ─────────────────────────────────────────────── */}
              {step === "connect-wallet" && (
                <View style={styles.content}>
                  {renderHeader("Wallet Connect", true, 1)}
                  <Text style={styles.titleLeft}>Connect Your Wallet</Text>
                  <Text style={styles.subtitleLeft}>
                    Choose a wallet to continue
                  </Text>
                  <View style={styles.optionsList}>
                    {WALLETS.map((w) => {
                      const isSupported = w.id === "phantom";
                      return (
                        <Pressable
                          key={w.id}
                          style={[
                            styles.walletOption,
                            selectedWallet?.id === w.id &&
                              styles.walletOptionSelected,
                            !isSupported && { opacity: 0.45 },
                          ]}
                          disabled={!isSupported}
                          onPress={() => {
                            setSelectedWallet(w);
                            handleConnectWallet(w);
                          }}
                        >
                          <WalletIcon walletId={w.id} size={40} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.walletName}>{w.name}</Text>
                            {!isSupported && (
                              <Text style={{ fontSize: 11, color: "#999" }}>
                                Coming soon
                              </Text>
                            )}
                          </View>
                          {selectedWallet?.id === w.id ? (
                            <View style={styles.radioChecked}>
                              <View style={styles.radioInner} />
                            </View>
                          ) : (
                            <View style={styles.radioUnchecked} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.spacer} />
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      !selectedWallet && styles.primaryBtnDisabled,
                    ]}
                    disabled={!selectedWallet}
                    onPress={() => {
                      if (selectedWallet?.id === "phantom") {
                        handleConnectWallet(selectedWallet);
                      }
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Connect Wallet</Text>
                  </Pressable>
                  <Pressable style={styles.cancelLink} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <PoweredByOrki />
                </View>
              )}

              {/* ── SELECT NETWORK ─────────────────────────────────────────────── */}
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
                          selectedNetwork === net &&
                            styles.walletOptionSelected,
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

              {/* ── SELECT ASSET ───────────────────────────────────────────────── */}
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
                          <Text style={styles.assetBalance}>
                            {asset.balance}
                          </Text>
                          <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                  <View style={styles.spacer} />
                  <PoweredByOrki />
                </View>
              )}

              {/* ── ENTER AMOUNT ───────────────────────────────────────────────── */}
              {step === "enter-amount" && (
                <View style={styles.content}>
                  {renderHeader("", true, 4)}

                  <View style={styles.centerCol}>
                    {/* Asset icon */}
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: selectedAsset.color,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontSize: 28,
                          fontWeight: "bold",
                        }}
                      >
                        $
                      </Text>
                    </View>

                    <Text style={styles.titleCenter}>
                      Enter amount to transfer
                    </Text>

                    {/* Available balance */}
                    <Text style={[styles.subtitleCenter, { marginBottom: 20 }]}>
                      Available:{" "}
                      <Text style={{ fontWeight: "600", color: "#333" }}>
                        {selectedAsset.balance} {selectedAsset.symbol}
                      </Text>
                    </Text>

                    {/* Amount + cursor + symbol — inline, no border box */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 16,
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 48,
                          fontWeight: "800",
                          color: "#111",
                          letterSpacing: -1,
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.4}
                      >
                        {amountStr || "0"}
                      </Text>
                      {/* Red cursor divider */}
                      <Text
                        style={{
                          fontSize: 48,
                          fontWeight: "200",
                          color: "#CC0000",
                          marginHorizontal: 4,
                          lineHeight: 58,
                        }}
                      >
                        |
                      </Text>
                      <Text
                        style={{
                          fontSize: 36,
                          fontWeight: "600",
                          color: "#BBBBBB",
                        }}
                      >
                        {selectedAsset.symbol}
                      </Text>
                    </View>

                    {/* Swap icon */}
                    <Text
                      style={{ fontSize: 20, color: PURPLE, marginBottom: 6 }}
                    >
                      ↑↓
                    </Text>

                    {/* USD equivalent */}
                    <Text
                      style={{ fontSize: 16, color: "#444", marginBottom: 20 }}
                    >
                      ${amountStr ? Number(amountStr).toLocaleString() : "0"}
                    </Text>

                    {/* 10k cap warning */}
                    {parseFloat(amountStr) >= MAX_DEPOSIT && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#CC0000",
                          marginBottom: 8,
                          fontWeight: "600",
                        }}
                      >
                        Maximum deposit is ${MAX_DEPOSIT.toLocaleString()}
                      </Text>
                    )}

                    {/* Preset % buttons — outlined pills */}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        marginBottom: 20,
                        paddingHorizontal: 16,
                        alignSelf: "stretch",
                      }}
                    >
                      {[
                        { label: "10%", factor: 0.1 },
                        { label: "50%", factor: 0.5 },
                        { label: "Max", factor: 1 },
                      ].map(({ label, factor }) => (
                        <Pressable
                          key={label}
                          style={{
                            flex: 1,
                            borderWidth: 1.5,
                            borderColor: "#CCCCCC",
                            borderRadius: 24,
                            paddingVertical: 10,
                            alignItems: "center",
                            backgroundColor: "transparent",
                          }}
                          onPress={() => {
                            const raw = selectedAsset.amount * factor;
                            const capped = Math.min(raw, MAX_DEPOSIT);
                            setAmountStr(
                              parseFloat(capped.toFixed(4)).toString(),
                            );
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: "#333",
                            }}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Continue button — above the numpad */}
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      { marginHorizontal: 16, marginBottom: 8 },
                      (!amountStr ||
                        parseFloat(amountStr) <= 0 ||
                        parseFloat(amountStr) > selectedAsset.amount ||
                        parseFloat(amountStr) > MAX_DEPOSIT) &&
                        styles.primaryBtnDisabled,
                    ]}
                    disabled={
                      !amountStr ||
                      parseFloat(amountStr) <= 0 ||
                      parseFloat(amountStr) > selectedAsset.amount ||
                      parseFloat(amountStr) > MAX_DEPOSIT
                    }
                    onPress={() => setStep("review")}
                  >
                    <Text style={styles.primaryBtnText}>Continue</Text>
                  </Pressable>

                  {/* Numpad — clean full-width 3-column grid */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      paddingHorizontal: 8,
                    }}
                  >
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
                        style={{
                          width: "33.33%",
                          paddingVertical: 18,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={() => handleNumpad(k)}
                      >
                        {k === "back" ? (
                          <Text style={{ fontSize: 22, color: "#333" }}>⌫</Text>
                        ) : (
                          <Text
                            style={{
                              fontSize: 26,
                              fontWeight: "500",
                              color: "#111",
                            }}
                          >
                            {k}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>

                  <PoweredByOrki />
                </View>
              )}

              {/* ── REVIEW ─────────────────────────────────────────────────────── */}
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
                      You're depositing {amountStr || "0"}{" "}
                      {selectedAsset.symbol} from{" "}
                      {selectedWallet?.name || "Wallet"} to your NeoUAE account
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
                      Withdrawal and deposit transactions are on the main
                      network. You might still have to pay network fees.
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

              {/* ── SIGNING ────────────────────────────────────────────────────── */}
              {step === "signing" && (
                <View style={styles.content}>
                  {renderHeader("", false)}
                  <View style={styles.centerCol}>
                    <View style={styles.walletWaitCircle}>
                      {selectedWallet ? (
                        <View style={{ position: "relative" }}>
                          <WalletIcon walletId={selectedWallet.id} size={64} />
                          {selectedNetwork && (
                            <View
                              style={{
                                position: "absolute",
                                bottom: -4,
                                right: -4,
                                borderRadius: 12,
                                backgroundColor: "#fff",
                                padding: 2,
                              }}
                            >
                              <NetworkIcon
                                networkId={selectedNetwork}
                                size={24}
                              />
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
                        <Text style={styles.statusTitle}>
                          Approve in wallet
                        </Text>
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

              {/* ── PROCESSING ─────────────────────────────────────────────────── */}
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
                      Once the deposit is complete, your updated balance will
                      appear in your account.
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

              {/* ── FAILED ─────────────────────────────────────────────────────── */}
              {step === "failed" && (
                <View style={styles.content}>
                  {renderHeader("", false)}
                  <View style={styles.centerCol}>
                    <View
                      style={[
                        styles.logoCircle,
                        { backgroundColor: "#ffebee" },
                      ]}
                    >
                      <Text style={{ fontSize: 32 }}>❌</Text>
                    </View>
                    <Text style={styles.titleCenter}>Deposit Failed</Text>
                    <Text style={styles.subtitleCenter}>
                      Unfortunately, your deposit couldn't be processed.
                    </Text>
                    <Text style={[styles.subtitleCenter, { marginTop: 16 }]}>
                      {timeLeft === 0
                        ? "Your session expired. Please start a new transfer."
                        : "An unknown error occurred. Please try again later."}
                    </Text>
                  </View>
                  <View style={styles.spacer} />
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      // Reset timer for retry
                      setTimeLeft(
                        expiresAtProp
                          ? Math.max(
                              0,
                              Math.floor(
                                (new Date(expiresAtProp).getTime() -
                                  Date.now()) /
                                  1000,
                              ),
                            )
                          : SESSION_DURATION,
                      );
                      setTimerActive(false);
                      setStep("enter-amount");
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Try Again</Text>
                  </Pressable>
                  <PoweredByOrki />
                </View>
              )}

              {/* ── SUCCESS ────────────────────────────────────────────────────── */}
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
                      {selectedAsset.symbol} from{" "}
                      {selectedWallet?.name || "Wallet"} to NeoUAE
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
                      {!!txid && txid !== TX_SUBMITTED && (
                        <Pressable
                          hitSlop={8}
                          onPress={() => Alert.alert("Copied", txid)}
                        >
                          <Text style={{ fontSize: 16, marginLeft: 8 }}>
                            📋
                          </Text>
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
                          <Text style={styles.explorerLink}>
                            View on Explorer ↗
                          </Text>
                        </Pressable>
                      ) : txid === TX_SUBMITTED ? (
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
                      stopTimer();
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
          </Animated.View>
        </View>
        <ConnectWallet />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
