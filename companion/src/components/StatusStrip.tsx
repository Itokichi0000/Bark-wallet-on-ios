import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { NetworkAmbientState } from "@/game/SceneBackground";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore, type WalletView } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatTime, minutesSince } from "@/utils/format";

const STALE_MINUTES = 10;

export function ambientState(v: Pick<WalletView, "lifecycle" | "syncing" | "maintenance" | "balance">): NetworkAmbientState {
  if (v.maintenance && v.maintenance.severity === "urgent") return "maintenanceRequired";
  if (v.syncing) return "syncing";
  if (v.lifecycle === "degraded") return v.balance?.lastSyncedAt ? "degraded" : "offline";
  if (v.lifecycle === "ready") return "online";
  return "syncing";
}

/** One line of truth about connectivity, plus any warnings that must not be missed. */
export function StatusStrip() {
  const t = useT();
  const language = useSettings((s) => s.language);
  const seedConfirmed = useSettings((s) => s.seedBackupConfirmed);
  const v = useWalletStore();
  const state = ambientState(v);
  const synced = v.balance?.lastSyncedAt;
  const age = minutesSince(synced);
  const stale = age === undefined || age >= STALE_MINUTES;

  const glyph = state === "online" ? "●" : state === "syncing" ? "◌" : state === "maintenanceRequired" ? "▲" : "○";
  const color = state === "online" ? theme.colors.success : state === "syncing" ? theme.colors.primary : theme.colors.warning;
  const warnings: { key: string; text: string; to: "/assets" | "/settings" }[] = [];
  if (v.maintenance && v.maintenance.severity !== "none") {
    warnings.push({ key: "m", text: t(v.maintenance.severity === "urgent" ? "status.maintenanceUrgent" : "status.maintenanceNotice"), to: "/assets" });
  }
  const b = v.backup;
  if (b.status === "failed") warnings.push({ key: "b", text: t("status.backupFailed"), to: "/settings" });
  else if (b.status === "never") warnings.push({ key: "b", text: t("status.backupNever"), to: "/settings" });
  else if (b.status !== "unsupported" && b.exportedGeneration < b.generation) warnings.push({ key: "b", text: t("status.backupNotExported"), to: "/settings" });
  if (!seedConfirmed && !v.info?.isMock) warnings.push({ key: "s", text: t("status.seedNotConfirmed"), to: "/settings" });

  return (
    <View style={styles.wrap}>
      <View style={styles.line} accessible accessibilityLabel={`${t(`status.${state}`)} ${t("status.lastSync", { time: formatTime(synced, language) })}`}>
        <Text style={[styles.glyph, { color }]}>{glyph}</Text>
        <Text style={styles.text}>{t(`status.${state}`)}</Text>
        <Text style={[styles.text, stale && { color: theme.colors.warning }]}>
          {synced ? t("status.lastSync", { time: formatTime(synced, language) }) : t("status.neverSynced")}
        </Text>
      </View>
      {warnings.map((w) => (
        <Pressable key={w.key} onPress={() => router.push(w.to)} accessibilityRole="button" style={styles.warning}>
          <Text style={styles.warningText}>▲ {w.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  line: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  glyph: { fontSize: 12 },
  text: { color: theme.colors.textMuted, fontSize: 12 },
  warning: { borderWidth: 1, borderColor: theme.colors.warning, borderRadius: theme.radius.sm, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: theme.colors.backgroundRaised },
  warningText: { color: theme.colors.warning, fontSize: 12, lineHeight: 17 },
});
