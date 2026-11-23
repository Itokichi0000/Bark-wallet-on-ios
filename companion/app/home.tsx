import { useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommandSheet } from "@/components/CommandSheet";
import { StatusStrip, ambientState } from "@/components/StatusStrip";
import { ModeBanner, NetworkTag } from "@/components/ui";
import { adapter, avatar, bus, wallet } from "@/container";
import { CuePriority } from "@/domain/avatar";
import type { MenuId } from "@/domain/events";
import { AVATAR_ASPECT } from "@/game/AvatarRenderer";
import { HologramMenu, type MenuItem } from "@/game/HologramMenu";
import { SceneBackground } from "@/game/SceneBackground";
import { IllustratedAvatarRenderer } from "@/game/IllustratedAvatarRenderer";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import type { MockWalletAdapter } from "@/infrastructure/mock/MockWalletAdapter";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatAmount } from "@/utils/format";
import { parseVoiceIntent } from "@/voice/VoiceIntentParser";
import { decideVoiceAction } from "@/voice/VoicePolicyEngine";

const MIN_AVATAR_HEIGHT = 220;

/** S02 Home: the companion, full body, with the four menus in orbit around them. */
export default function HomeScene() {
  const t = useT();
  const cue = useAvatarCue();
  const reduceMotion = useReduceMotion();
  const view = useWalletStore();
  const { unit, balanceHidden, update } = useSettings();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [talk, setTalk] = useState(false);

  useEffect(() => {
    if (view.lifecycle === "not-created") router.replace("/onboarding");
  }, [view.lifecycle]);

  const items: MenuItem[] = useMemo(
    () => [
      { id: "send", label: t("menu.send"), sublabel: "SEND", glyph: "↗", hint: t("menu.send.hint") },
      { id: "receive", label: t("menu.receive"), sublabel: "RECEIVE", glyph: "↙", hint: t("menu.receive.hint") },
      { id: "assets", label: t("menu.assets"), sublabel: "ASSETS", glyph: "◇", hint: t("menu.assets.hint") },
      { id: "archive", label: t("menu.archive"), sublabel: "ARCHIVE", glyph: "▤", hint: t("menu.archive.hint") },
    ],
    [t],
  );

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

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  };

  // Largest figure that fits whole: head to shoes, never cropped, never below a readable minimum.
  const avatarHeight = Math.max(MIN_AVATAR_HEIGHT, Math.min(stage.height * 0.9, (stage.width * 0.58) / AVATAR_ASPECT));
  const balance = view.balance;
  const balanceText = !balance ? t("home.balanceUnknown") : balanceHidden ? "••••••" : formatAmount(balance.spendableSats, unit);

  return (
    <View style={styles.root}>
      <SceneBackground state={ambientState(view)} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ModeBanner />
        <View style={styles.top}>
          <Text style={styles.brand}>BARK//COMPANION</Text>
          <NetworkTag />
          <Pressable onPress={() => router.push("/quest")} accessibilityRole="button" accessibilityLabel={t("quest.title")} hitSlop={10} style={styles.iconButton}>
            <Text style={styles.icon}>✦</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={t("settings.title")} hitSlop={10} style={styles.iconButton}>
            <Text style={styles.icon}>⚙</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => update({ balanceHidden: !balanceHidden })}
          onLongPress={() => update({ unit: unit === "sats" ? "btc" : "sats" })}
          accessibilityRole="button"
          accessibilityLabel={`${t("home.spendable")} ${balanceHidden ? t("home.hidden") : balanceText}`}
          accessibilityHint={t("home.balanceHint")}
          style={styles.balance}
        >
          <Text style={styles.balanceLabel}>{t("home.spendable")}</Text>
          <Text style={styles.balanceValue}>{balanceText}</Text>
        </Pressable>

        <View style={styles.stage} onLayout={onLayout}>
          {stage.height > 0 ? (
            <>
              <Pressable
                onPress={() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })}
                accessibilityRole="button"
                accessibilityLabel={t("home.avatar")}
                style={styles.avatar}
              >
                <IllustratedAvatarRenderer cue={cue} height={avatarHeight} reduceMotion={reduceMotion} />
              </Pressable>
              <HologramMenu width={stage.width} height={stage.height} items={items} reduceMotion={reduceMotion} onSelect={open} />
            </>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Text style={styles.line} accessibilityLiveRegion="polite" numberOfLines={3}>
            「{t(cue.lineKey ?? "avatar.idle", cue.lineParams)}」
          </Text>
          <Pressable onPress={() => setTalk(true)} accessibilityRole="button" accessibilityHint={t("talk.noMic")} style={styles.talk}>
            <Text style={styles.talkText}>⌨ {t("home.talk")}</Text>
          </Pressable>
          {adapter.isMock ? (
            <Pressable onPress={() => (adapter as MockWalletAdapter).simulateIncoming(10_000n)} accessibilityRole="button" style={styles.mockButton}>
              <Text style={styles.mockButtonText}>{t("mock.simulateIncoming")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void wallet.refresh()} accessibilityRole="button" accessibilityLabel={t("home.syncNow")}>
            <StatusStrip />
          </Pressable>
        </View>
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
  icon: { color: theme.colors.primary, fontSize: 22 },
  balance: { alignSelf: "center", alignItems: "center", paddingHorizontal: 18, paddingVertical: 6, minHeight: 44 },
  balanceLabel: { color: theme.colors.textMuted, fontSize: 11, letterSpacing: 1 },
  balanceValue: { color: theme.colors.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: { alignItems: "center", justifyContent: "center" },
  bottom: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  line: { color: theme.colors.text, fontSize: 15, textAlign: "center", lineHeight: 21, minHeight: 21 },
  talk: { minHeight: 48, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.panel, alignItems: "center", justifyContent: "center" },
  talkText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  mockButton: { alignSelf: "center", borderWidth: 1, borderColor: theme.colors.warning, borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  mockButtonText: { color: theme.colors.warning, fontSize: 12, fontWeight: "700" },
});
