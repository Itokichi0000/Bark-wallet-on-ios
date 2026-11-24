import { userAction } from "./companionEvents";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { formatAmount } from "@/utils/format";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";

export function RecentActivity() {
  const t = useT();
  const { movements, balance, lastSyncError, lifecycle } = useWalletStore();
  const { unit, balanceHidden } = useSettings();
  const recent = movements.slice(0, 2);
  const failed = lastSyncError !== undefined || lifecycle === "degraded";
  return (
    <View>
      <View style={styles.heading}>
        <Text style={styles.title}>{t("home.recent")}</Text>
        <Pressable onPress={() => router.push("/archive")} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>{t("home.seeAll")}</Text><BitcoinIcon name="caret-right" size={16} />
        </Pressable>
      </View>
      {recent.length === 0 ? <Text style={styles.empty}>{t(failed ? "list.unavailable" : !balance?.lastSyncedAt ? "archive.loading" : "home.noActivity")}</Text> : recent.map((m) => {
        const unresolved = m.status === "pending" || m.status === "unknown";
        return (
          <Pressable key={m.id} onPress={() => { userAction("movement-opened"); router.push({ pathname: "/archive", params: { movement: m.id } }); }} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}>
            <View style={styles.summary}>
              <BitcoinIcon name={m.direction === "incoming" ? "receive" : m.direction === "outgoing" ? "send" : "refresh"} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t(`archive.direction.${m.direction}`)}</Text>
                <Text style={[styles.meta, unresolved && { color: theme.colors.warning }]}>{t(`archive.status.${m.status}`)}{unresolved ? ` · ${t("home.doNotResend")}` : ""}</Text>
              </View>
              <Text style={styles.amount}>{balanceHidden ? "••••" : `${m.direction === "incoming" ? "+" : m.direction === "outgoing" ? "−" : ""}${formatAmount(m.amountSats, unit)}`}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  title: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  link: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { color: theme.colors.primary, fontSize: 13 },
  row: { minHeight: 44, justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outline, paddingVertical: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  label: { color: theme.colors.text, fontSize: 13, lineHeight: 17 },
  meta: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  amount: { color: theme.colors.text, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  empty: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, minHeight: 60, paddingVertical: 8 },
});
