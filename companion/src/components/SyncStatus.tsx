import { Companion } from "./Companion";
import { SceneContext, userAction } from "./companionEvents";
import { useContext, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "@/i18n";
import { useWalletStore } from "@/state/walletStore";
import { useReduceMotion } from "@/game/useAvatarCue";
import { minutesSince } from "@/utils/format";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";
import { P, Screen } from "./ui";
import { WaitingIndicator } from "./waiting-indicator";

/** Cached data stays visible on failure; time continues to age even without store updates. */
export function SyncStatus({ compact = false, disabled = false, showCompanion = true }: { compact?: boolean; disabled?: boolean; showCompanion?: boolean }) {
  const t = useT();
  const scene = useContext(SceneContext);
  const { balance, lastSyncError, lifecycle, syncing } = useWalletStore();
  const reduceMotion = useReduceMotion();
  const [help, setHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const age = minutesSince(balance?.lastSyncedAt, now);
  const offline = lastSyncError !== undefined || lifecycle === "degraded";
  const checking = syncing || lifecycle === "syncing" || age === undefined;
  const text = offline ? t("sync.offline") : checking ? t("sync.loading") : age === 0 ? t("sync.justNow") : t("sync.minutesAgo", { n: age });
  return (
    <View>
      <View style={styles.row}>
        {!compact ? <Text style={[styles.text, offline && { color: theme.colors.warning }]}>{text}</Text> : null}
        <Pressable disabled={disabled} accessibilityState={{ disabled }} onPress={() => { userAction("term-opened"); setHelp(true); }} accessibilityRole="button" accessibilityLabel={`${text}. ${t("help.label", { term: t("help.sync.title") })}`} style={({ pressed }) => [styles.help, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><BitcoinIcon name={compact ? offline ? "alert" : checking ? "refresh" : "globe" : "question-circle"} color={offline ? theme.colors.warning : theme.colors.primary} size={18} />{compact && checking && !offline ? <WaitingIndicator /> : null}</View>
          {compact ? <Text style={[styles.short, offline && { color: theme.colors.warning }]}>{t(offline ? "sync.stateOffline" : checking ? "sync.stateChecking" : "sync.stateOk")}</Text> : null}
        </Pressable>
      </View>
      <Modal visible={help} animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setHelp(false)}>
        <Screen scene={scene} companion={false} announceScene={false} title={t("help.sync.title")} onBack={() => setHelp(false)}>
          <P>{t("sync.automatic")}</P>
          <P muted>{t("help.sync.body")}</P>
          <P muted>{age === undefined ? t("status.neverSynced") : t("sync.minutesAgo", { n: age })}</P>
          {help && showCompanion ? <Companion scene={scene} blocked /> : null}
        </Screen>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  text: { flex: 1, color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  help: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  short: { color: theme.colors.primary, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
