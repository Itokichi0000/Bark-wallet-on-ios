import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "@/i18n";
import { useWalletStore } from "@/state/walletStore";
import { useReduceMotion } from "@/game/useAvatarCue";
import { minutesSince } from "@/utils/format";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";
import { P, Screen } from "./ui";

/** Cached data stays visible on failure; time continues to age even without store updates. */
export function SyncStatus() {
  const t = useT();
  const { balance, lastSyncError, lifecycle } = useWalletStore();
  const reduceMotion = useReduceMotion();
  const [help, setHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const age = minutesSince(balance?.lastSyncedAt, now);
  const offline = lastSyncError !== undefined || lifecycle === "degraded";
  const text = offline ? t("sync.offline") : age === undefined ? t("sync.loading") : age === 0 ? t("sync.justNow") : t("sync.minutesAgo", { n: age });
  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.text, offline && { color: theme.colors.warning }]}>{text}</Text>
        <Pressable onPress={() => setHelp(true)} accessibilityRole="button" accessibilityLabel={t("help.label", { term: t("help.sync.title") })} style={({ pressed }) => [styles.help, { opacity: pressed ? 0.6 : 1 }]}>
          <BitcoinIcon name="question-circle" size={18} />
        </Pressable>
      </View>
      <Modal visible={help} animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setHelp(false)}>
        <Screen title={t("help.sync.title")} onBack={() => setHelp(false)}>
          <P>{t("sync.automatic")}</P>
          <P muted>{t("help.sync.body")}</P>
          <P muted>{age === undefined ? t("status.neverSynced") : t("sync.minutesAgo", { n: age })}</P>
        </Screen>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  text: { flex: 1, color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  help: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
