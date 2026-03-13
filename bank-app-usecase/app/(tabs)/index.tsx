// bank-app-usecase/app/(tabs)/index.tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  ScrollView,
  Modal,
  TextInput,
  StatusBar,
  Animated,
} from "react-native";

const WALLETS: WalletInfo[] = [
  { id: "phantom", name: "Phantom", scheme: "phantom://v1/connect?redirect_link={redirect}" },
  { id: "metamask", name: "MetaMask", scheme: "metamask://connect?redirect_link={redirect}" },
  { id: "coinbase", name: "Coinbase", scheme: "cbwallet://connect?redirect_link={redirect}" },
  { id: "trust", name: "Trust Wallet", scheme: "trust://connect?redirect_link={redirect}" },
];

const RECENT_TRANSACTIONS = [
  { id: 1, label: "Salary Credit", amount: "+$4,200.00", date: "Mar 10", type: "credit" },
  { id: 2, label: "Netflix", amount: "-$15.99", date: "Mar 9", type: "debit" },
  { id: 3, label: "Wallet Deposit", amount: "+$320.00", date: "Mar 7", type: "credit" },
  { id: 4, label: "Grocery Store", amount: "-$87.45", date: "Mar 5", type: "debit" },
];

import { WalletInfo, OrkiConnect, OrkiConnectModal } from "@/lib/orki-connect-sdk";

const orkiSDK = new OrkiConnect({
  network: "devnet",
  redirectScheme: "walletdemo://wallet-callback",
});
export default function BankApp() {
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState("12,480.52");

  const handleDepositSuccess = (txid: string) => {
    console.log("Deposit success, txid:", txid);
    setDepositModalVisible(false);
  };



  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.userName}>Alex Johnson</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AJ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.cardGlow} />
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>${balance}</Text>
          <View style={styles.cardRow}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Income</Text>
              <Text style={styles.cardStatValue}>+$4,200</Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Expenses</Text>
              <Text style={styles.cardStatValueRed}>-$1,203</Text>
            </View>
          </View>
          <View style={styles.cardNumber}>
            <Text style={styles.cardNumberText}>•••• •••• •••• 4829</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => setDepositModalVisible(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#1a2a1a" }]}>
                <Text style={styles.actionEmoji}>⬇️</Text>
              </View>
              <Text style={styles.actionLabel}>Deposit</Text>
            </Pressable>

            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: "#1a1a2a" }]}>
                <Text style={styles.actionEmoji}>⬆️</Text>
              </View>
              <Text style={styles.actionLabel}>Withdraw</Text>
            </Pressable>

            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: "#2a1a2a" }]}>
                <Text style={styles.actionEmoji}>↔️</Text>
              </View>
              <Text style={styles.actionLabel}>Transfer</Text>
            </Pressable>

            <Pressable style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: "#2a2a1a" }]}>
                <Text style={styles.actionEmoji}>📊</Text>
              </View>
              <Text style={styles.actionLabel}>Analytics</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {RECENT_TRANSACTIONS.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, tx.type === "credit" ? styles.txIconCredit : styles.txIconDebit]}>
                <Text>{tx.type === "credit" ? "↓" : "↑"}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txLabel}>{tx.label}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <Text style={[styles.txAmount, tx.type === "credit" ? styles.txCredit : styles.txDebit]}>
                {tx.amount}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Deposit Modal */}
      <OrkiConnectModal
        visible={depositModalVisible}
        onClose={() => setDepositModalVisible(false)}
        bankAddress="83p8Pmc2jU4by5ZSyhwYEQw7D5YAFz9joC9mnw49NzoP"
        sdk={orkiSDK}
        onSuccess={handleDepositSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  greeting: { fontSize: 14, color: "#666", fontWeight: "400" },
  userName: { fontSize: 22, color: "#fff", fontWeight: "700", marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e3a2e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2ecc71",
  },
  avatarText: { color: "#2ecc71", fontWeight: "700", fontSize: 14 },

  // Balance Card
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 28,
    borderRadius: 24,
    backgroundColor: "#111",
    padding: 24,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#2ecc71",
    opacity: 0.06,
  },
  balanceLabel: { fontSize: 13, color: "#555", fontWeight: "500", marginBottom: 8 },
  balanceAmount: { fontSize: 40, color: "#fff", fontWeight: "800", marginBottom: 20, letterSpacing: -1 },
  cardRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  cardStat: { flex: 1 },
  cardStatLabel: { fontSize: 12, color: "#555", marginBottom: 4 },
  cardStatValue: { fontSize: 16, color: "#2ecc71", fontWeight: "700" },
  cardStatValueRed: { fontSize: 16, color: "#e74c3c", fontWeight: "700" },
  cardDivider: { width: 1, height: 32, backgroundColor: "#1e1e1e", marginHorizontal: 16 },
  cardNumber: { borderTopWidth: 1, borderTopColor: "#1e1e1e", paddingTop: 16 },
  cardNumberText: { color: "#333", fontSize: 13, letterSpacing: 2 },

  // Sections
  section: { paddingHorizontal: 24, marginBottom: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 17, color: "#fff", fontWeight: "700", marginBottom: 16 },
  seeAll: { fontSize: 13, color: "#2ecc71" },

  // Actions
  actionsRow: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: { alignItems: "center", gap: 8 },
  actionIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1e1e1e" },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 12, color: "#888", fontWeight: "500" },

  // Transactions
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#111" },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 14 },
  txIconCredit: { backgroundColor: "#0d2a1a" },
  txIconDebit: { backgroundColor: "#2a0d0d" },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 14, color: "#ddd", fontWeight: "600" },
  txDate: { fontSize: 12, color: "#555", marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },
  txCredit: { color: "#2ecc71" },
  txDebit: { color: "#e74c3c" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: "#1e1e1e",
  },
  modalHandle: { width: 40, height: 4, backgroundColor: "#333", borderRadius: 2, alignSelf: "center", marginBottom: 24 },
  modalTitle: { fontSize: 22, color: "#fff", fontWeight: "800", marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: "#555", marginBottom: 24 },

  // Amount Input
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    marginBottom: 24,
  },
  currencySymbol: { fontSize: 28, color: "#555", marginRight: 8, fontWeight: "300" },
  amountInput: { flex: 1, fontSize: 32, color: "#fff", fontWeight: "700", paddingVertical: 12 },

  // Wallet Grid
  walletSectionLabel: { fontSize: 13, color: "#555", fontWeight: "600", marginBottom: 12 },
  walletGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  walletCard: {
    width: "47%",
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e1e1e",
    position: "relative",
  },
  walletIcon: { fontSize: 28, marginBottom: 8 },
  walletName: { fontSize: 13, color: "#aaa", fontWeight: "600" },
  walletCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  // Buttons
  confirmBtn: {
    backgroundColor: "#2ecc71",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  confirmBtnDisabled: { backgroundColor: "#1a2a1a", opacity: 0.6 },
  confirmBtnText: { color: "#0a0a0a", fontSize: 16, fontWeight: "800" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { color: "#555", fontSize: 15, fontWeight: "600" },
});