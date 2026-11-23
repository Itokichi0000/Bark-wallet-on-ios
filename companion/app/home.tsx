import { BitcoinIcon } from "@/components/BitcoinIcon";
import { TermHelp } from "@/components/TermHelp";
import { IS_MAINNET } from "@/config/network";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommandSheet } from "@/components/CommandSheet";
import { StatusStrip, ambientState } from "@/components/StatusStrip";
import { Button, ModeBanner, NetworkTag, Notice } from "@/components/ui";
import { adapter, avatar, bus, wallet } from "@/container";
import { CuePriority } from "@/domain/avatar";
import type { MenuId } from "@/domain/events";
import { SceneBackground } from "@/game/SceneBackground";
import { AnimatedAvatarRenderer } from "@/game/AnimatedAvatarRenderer";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import type { MockWalletAdapter } from "@/infrastructure/mock/MockWalletAdapter";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatAmount } from "@/utils/format";
import { parseVoiceIntent } from "@/voice/VoiceIntentParser";
import { decideVoiceAction } from "@/voice/VoicePolicyEngine";


/** S02 Home: balance and payment actions first; the companion keeps the room identity. */
export default function HomeScene() {
  const t = useT();
  const cue = useAvatarCue();
  const reduceMotion = useReduceMotion();
  const view = useWalletStore();
  const { unit, balanceHidden, update } = useSettings();
  const { height, fontScale } = useWindowDimensions();
  const [talk, setTalk] = useState(false);

  useEffect(() => {
    if (view.lifecycle === "not-created") router.replace("/onboarding");
  }, [view.lifecycle]);

  const open = (menu: MenuId) => {
    bus.emit({ type: "MENU_OPENED", id: bus.nextId("menu"), menu });
    router.push(`/${menu}`);
  };

  const onCommand = (text: string) => {
    setTalk(false);
    const action = decideVoiceAction(parseVoiceIntent(text), {
      spendableSats: view.balance?.spendableSats,
      lastSyncedAt: view.balance?.lastSyncedAt,
      balanceHidden,
    });
    // Voice can speak, navigate, or open a draft. Sending still needs the send screen's review and the owner's confirmation.
    avatar.play({
      id: bus.nextId("voice"), emotion: "happy", action: "speak", lineKey: action.lineKey,
      lineParams: action.kind === "SAY" && action.params?.sats ? { amount: formatAmount(action.params.sats, unit) } : undefined,
      priority: CuePriority.voice, interruptible: true, holdMs: 4500,
    });
    if (action.kind === "NAVIGATE") router.push(`/${action.to}`);
    if (action.kind === "OPEN_SEND_DRAFT") {
      router.push({ pathname: "/send", params: { amount: action.amountSats ?? "", max: action.requestMax ? "1" : "" } });
    }
  };

  const avatarHeight = Math.max(180, Math.min(300, height * 0.32));
  const balance = view.balance;
  const balanceText = !balance ? t("home.balanceUnknown") : balanceHidden ? "••••••" : formatAmount(balance.spendableSats, unit);

  return (
    <View style={styles.root}>
      <SceneBackground state={ambientState(view)} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ModeBanner />
        <View style={styles.top}>
          <Text style={styles.brand}>BARK</Text>
          <NetworkTag />
          <Pressable onPress={() => router.push("/quest")} accessibilityRole="button" accessibilityLabel={t("quest.title")} hitSlop={10} style={styles.iconButton}>
            <BitcoinIcon name="star" />
          </Pressable>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={t("settings.title")} hitSlop={10} style={styles.iconButton}>
            <BitcoinIcon name="gear" />
          </Pressable>
        </View>

        {IS_MAINNET ? <View style={{ paddingHorizontal: 20 }}><Notice tone="danger">{t("net.mainnetLong")}</Notice></View> : null}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.balance}>
            <View style={styles.balanceHeading}>
              <Text style={styles.balanceLabel}>{t("home.spendable")}</Text>
              <Pressable onPress={() => update({ balanceHidden: !balanceHidden })} accessibilityRole="button" accessibilityLabel={t(balanceHidden ? "home.show" : "home.hide")} style={styles.iconButton}>
                <BitcoinIcon name={balanceHidden ? "hidden" : "visible"} size={22} />
              </Pressable>
            </View>
            <Text style={styles.balanceValue}>{balanceText}</Text>
            <Pressable onPress={() => update({ unit: unit === "sats" ? "btc" : "sats" })} accessibilityRole="button" accessibilityLabel={t("home.unit")} style={styles.unitButton}>
              <Text style={styles.unitText}>{unit === "sats" ? "sats" : "BTC"}</Text><BitcoinIcon name="caret-down" size={16} />
            </Pressable>
            <View style={[styles.actions, fontScale > 1.3 && { flexDirection: "column" }]}>
              <View style={{ flex: 1 }}><Button label={t("menu.receive")} icon="receive" kind={!balance || balance.spendableSats === "0" ? "primary" : "secondary"} onPress={() => open("receive")} /></View>
              <View style={{ flex: 1 }}><Button label={t("menu.send")} icon="send" kind={balance && balance.spendableSats !== "0" ? "primary" : "secondary"} onPress={() => open("send")} /></View>
            </View>
          </View>
          <View style={styles.stage}>
            <Pressable onPress={() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })} accessibilityRole="button" accessibilityLabel={t("home.avatar")} style={styles.avatar}>
              <AnimatedAvatarRenderer cue={cue} height={avatarHeight} reduceMotion={reduceMotion} />
            </Pressable>
          </View>
        <View style={styles.bottom}>
          <Text style={styles.line} accessibilityLiveRegion="polite" numberOfLines={3}>
            「{t(cue.lineKey ?? "avatar.idle", cue.lineParams)}」
          </Text>
          <Pressable onPress={() => setTalk(true)} accessibilityRole="button" accessibilityHint={t("talk.noMic")} style={styles.talk}>
            <BitcoinIcon name="keyboard" size={22} /><Text style={styles.talkText}>{t("home.talk")}</Text>
          </Pressable>
          {adapter.isMock ? (
            <Pressable onPress={() => (adapter as MockWalletAdapter).simulateIncoming(10_000n)} accessibilityRole="button" style={styles.mockButton}>
              <Text style={styles.mockButtonText}>{t("mock.simulateIncoming")}</Text>
            </Pressable>
          ) : null}
          <View style={[styles.actions, fontScale > 1.3 && { flexDirection: "column" }]}>
            <View style={{ flex: 1 }}><Button label={t("menu.assets")} icon="wallet" kind="secondary" onPress={() => open("assets")} /></View>
            <View style={{ flex: 1 }}><Button label={t("menu.archive")} icon="transactions" kind="secondary" onPress={() => open("archive")} /></View>
          </View>
          <StatusStrip />
          <Button label={t("home.syncNow")} icon="refresh" kind="secondary" busy={view.syncing} onPress={() => void wallet.refresh()} />
          <TermHelp term="sync" />
        </View>
        </ScrollView>
      </SafeAreaView>
      <CommandSheet visible={talk} onClose={() => setTalk(false)} onSubmit={onCommand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  safe: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  brand: { flex: 1, color: theme.colors.text, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12, width: "100%", maxWidth: 620, alignSelf: "center" },
  balance: { backgroundColor: theme.colors.panel, borderColor: theme.colors.outline, borderWidth: 1, borderRadius: 24, padding: 20 },
  balanceHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 10 },
  unitButton: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  unitText: { color: theme.colors.primary, fontSize: 14 },
  balanceLabel: { color: theme.colors.textMuted, fontSize: 13, letterSpacing: 0.5 },
  balanceValue: { color: theme.colors.text, fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
  stage: { alignItems: "center", justifyContent: "center" },
  avatar: { alignItems: "center", justifyContent: "center" },
  bottom: { gap: 12 },
  line: { color: theme.colors.text, fontSize: 15, textAlign: "center", lineHeight: 21, minHeight: 21 },
  talk: { minHeight: 48, flexDirection: "row", gap: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.panel, alignItems: "center", justifyContent: "center" },
  talkText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  mockButton: { minHeight: 44, justifyContent: "center", alignSelf: "center", borderWidth: 1, borderColor: theme.colors.warning, borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  mockButtonText: { color: theme.colors.warning, fontSize: 12, fontWeight: "700" },
});
