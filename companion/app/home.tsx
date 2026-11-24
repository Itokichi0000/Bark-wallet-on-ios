import { HomeCompanion } from "@/components/Companion";
import { userAction, useSceneFocus } from "@/components/companionEvents";
import { storyProgress } from "@/game/story";
import { usePullRefresh } from "@/components/usePullRefresh";
import { BitcoinIcon } from "@/components/BitcoinIcon";
import { SyncStatus } from "@/components/SyncStatus";
import { RecentActivity } from "@/components/RecentActivity";
import { homeHint } from "@/game/homeHint";
import { IS_MAINNET } from "@/config/network";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommandSheet } from "@/components/CommandSheet";
import { ambientState } from "@/components/StatusStrip";
import { Button, ModeBanner, NetworkTag } from "@/components/ui";
import { adapter, avatar, bus } from "@/container";
import { CuePriority } from "@/domain/avatar";
import type { MenuId } from "@/domain/events";
import { SceneBackground } from "@/game/SceneBackground";
import { AVATAR_ASPECT } from "@/game/AvatarRenderer";
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
  const refresh = usePullRefresh();
  useSceneFocus("home");
  const view = useWalletStore();
  const { unit, balanceHidden, seedBackupConfirmed, storySentSats, storyRead, update } = useSettings();
  const { width, height, fontScale } = useWindowDimensions();
  const [talk, setTalk] = useState(false);
  const [avatarSpaceHeight, setAvatarSpaceHeight] = useState(240);

  useEffect(() => {
    if (view.lifecycle === "not-created") router.replace("/onboarding");
  }, [view.lifecycle]);

  const open = (menu: MenuId) => {
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
    if (action.kind === "SAY") avatar.play({
      id: bus.nextId("voice"), emotion: "happy", action: "speak", lineKey: action.lineKey === "voice.balance" ? "voice.balanceLocation" : action.lineKey,
      priority: CuePriority.voice, interruptible: true, holdMs: 4500,
    });
    if (action.kind === "NAVIGATE") router.push(`/${action.to}`);
    if (action.kind === "OPEN_SEND_DRAFT") {
      router.push({ pathname: "/send", params: { amount: action.amountSats ?? "", max: action.requestMax ? "1" : "" } });
    }
  };

  const largeText = fontScale > 1;
  const hint = homeHint({ view, seedBackupConfirmed, isMock: adapter.isMock, hour: new Date().getHours() });
  const unread = storyProgress(BigInt(storySentSats)).unlocked.some((chapter) => !storyRead[chapter.id]);
  const balance = view.balance;
  const balanceText = !balance ? t("home.balanceUnknown") : balanceHidden ? "••••••" : formatAmount(balance.spendableSats, unit);
  const actions = (
    <View style={[styles.actions, largeText && { flexWrap: "wrap" }]}>
      <View style={styles.action}><Button label={t("menu.receive")} icon="receive" kind={!balance || balance.spendableSats === "0" ? "primary" : "secondary"} onPress={() => open("receive")} /></View>
      <View style={styles.action}><Button label={t("menu.send")} icon="send" kind={balance && balance.spendableSats !== "0" ? "primary" : "secondary"} onPress={() => open("send")} /></View>
    </View>
  );

  return (
    <View style={styles.root}>
      <SceneBackground state={ambientState(view)} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ModeBanner />
        <View style={styles.top}>
          <Text style={styles.brand}>BARK</Text>
          <NetworkTag />
          <Pressable onPress={() => router.push("/quest")} accessibilityRole="button" accessibilityLabel={t("quest.title")} style={styles.iconButton}><BitcoinIcon name="star" /></Pressable>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={t("settings.title")} style={styles.iconButton}><BitcoinIcon name="gear" /></Pressable>
        </View>
        {IS_MAINNET ? <Text style={styles.mainnet} accessibilityRole="alert">{t("net.mainnetLong")}</Text> : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, !largeText && { height: "100%" }]}
          alwaysBounceVertical
          showsVerticalScrollIndicator={largeText}
          refreshControl={<RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={theme.colors.primary} />}
        >
          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>{t("home.spendable")}</Text>
            <View style={styles.balanceHeading}>
              <Pressable onPress={() => { update({ unit: unit === "sats" ? "btc" : "sats" }); userAction("unit-changed"); }} accessibilityRole="button" accessibilityLabel={`${balanceText}. ${t("home.unit")}`} style={styles.amountButton}>
                <Text style={styles.balanceValue} numberOfLines={largeText ? undefined : 1} adjustsFontSizeToFit={!largeText} minimumFontScale={0.7}>{balanceText}</Text>
              </Pressable>
              <Pressable onPress={() => { update({ balanceHidden: !balanceHidden }); userAction(balanceHidden ? "balance-shown" : "balance-hidden"); }} accessibilityRole="button" accessibilityLabel={t(balanceHidden ? "home.show" : "home.hide")} style={styles.iconButton}><BitcoinIcon name={balanceHidden ? "hidden" : "visible"} size={20} /></Pressable>
              <Pressable onPress={() => open("assets")} accessibilityRole="button" style={styles.iconButton}><Text style={styles.link}>{t("home.breakdown")}</Text></Pressable>
            </View>
          </View>
          <SyncStatus />
          <View style={[styles.stage, largeText && { flex: undefined }]}>
            <View style={[styles.avatarSpace, largeText && { flex: undefined, height: Math.min(height * 0.56, 460) }]} onLayout={(e) => setAvatarSpaceHeight(e.nativeEvent.layout.height)}>
              <HomeCompanion hint={hint} active={!talk} height={Math.max(44, Math.min((Math.min(width, 620) - 40) / AVATAR_ASPECT, avatarSpaceHeight - 86))} />
            </View>
            <View pointerEvents="box-none" style={[styles.tools, largeText && { position: "relative", bottom: undefined }]}>
              <Pressable onPress={() => router.push("/story")} accessibilityRole="button" accessibilityLabel={`${t("story.title")}${unread ? ` · ${t("story.new")}` : ""}`} style={[styles.pill, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <BitcoinIcon name="star" size={18} /><Text style={styles.link}>{t("story.title")}</Text>
                {unread ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} /> : null}
              </Pressable>
              {adapter.isMock ? <Pressable onPress={() => (adapter as MockWalletAdapter).simulateIncoming(10_000n)} accessibilityRole="button" accessibilityLabel={t("mock.simulateIncoming")} style={[styles.pill, styles.mockButton]}><Text style={styles.mockText}>{t("mock.short")}</Text></Pressable> : null}
              <Pressable onPress={() => setTalk(true)} accessibilityRole="button" accessibilityLabel={t("home.talk")} accessibilityHint={t("talk.noMic")} style={[styles.pill, styles.talk]}><BitcoinIcon name="keyboard" size={18} /><Text style={[styles.link, { flexShrink: 1 }]}>{t("home.talk")}</Text></Pressable>
            </View>
          </View>
          <RecentActivity />
          {largeText ? actions : null}
        </ScrollView>
        {!largeText ? actions : null}
      </SafeAreaView>
      <CommandSheet visible={talk} onClose={() => setTalk(false)} onSubmit={onCommand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  safe: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  brand: { flex: 1, color: theme.colors.text, fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  mainnet: { color: theme.colors.danger, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingVertical: 4 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, width: "100%", maxWidth: 620, alignSelf: "center" },
  balance: { paddingTop: 4 },
  balanceHeading: { flexDirection: "row", alignItems: "center", gap: 4 },
  amountButton: { flex: 1, minHeight: 44, justifyContent: "center" },
  balanceLabel: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  balanceValue: { color: theme.colors.text, fontSize: 28, lineHeight: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  link: { color: theme.colors.primary, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 8, width: "100%", maxWidth: 620, alignSelf: "center" },
  action: { flex: 1, minWidth: 140 },
  stage: { flex: 1, minHeight: 0, paddingTop: 4 },
  avatarSpace: { flex: 1, minHeight: 0, alignSelf: "stretch" },
  avatar: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  speechArea: { paddingBottom: 12 },
  bubble: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.outline, gap: 8 },
  bubbleTail: { position: "absolute", bottom: 7, alignSelf: "center", width: 10, height: 10, backgroundColor: theme.colors.panel, borderBottomWidth: 1, borderRightWidth: 1, borderColor: theme.colors.outline, transform: [{ rotate: "45deg" }] },
  line: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  tools: { paddingVertical: 4, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" },
  pill: { minHeight: 44, minWidth: 44, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.outline },
  talk: { marginLeft: "auto", flexDirection: "row", gap: 4, alignItems: "center" },
  mockButton: { alignItems: "center", justifyContent: "center" },
  mockText: { color: theme.colors.warning, fontSize: 10, fontWeight: "700" },
});
