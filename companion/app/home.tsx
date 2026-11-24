import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Stage, StageChoices } from "@/components/stage";
import { TalkInput } from "@/components/conversation";
import type { BitcoinIconName } from "@/components/BitcoinIcon";
import { adapter, avatar, bus } from "@/container";
import { CuePriority } from "@/domain/avatar";
import { STAGE_CHOICES } from "@/game/dialogue";
import { homeHint } from "@/game/homeHint";
import { storyProgress } from "@/game/story";
import { useAvatarCue } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { parseVoiceIntent } from "@/voice/VoiceIntentParser";
import { decideVoiceAction } from "@/voice/VoicePolicyEngine";

const menuIcons: Record<string, BitcoinIconName> = { receive: "receive", send: "send", activity: "transactions", coins: "wallet", story: "star", guide: "mnemonic" };

const routes = { receive: "/receive", send: "/send", activity: "/archive", coins: "/assets", story: "/story", guide: "/quest", settings: "/settings" } as const;

export default function HomeScene() {
  const t = useT();
  const view = useWalletStore();
  const { balanceHidden, seedBackupConfirmed, storySentSats, storyRead } = useSettings();
  const cue = useAvatarCue();
  useEffect(() => { if (view.lifecycle === "not-created") router.replace("/onboarding"); }, [view.lifecycle]);
  const onCommand = (text: string) => {
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

  const hint = homeHint({ view, seedBackupConfirmed, isMock: adapter.isMock, hour: new Date().getHours() });
  const unread = storyProgress(BigInt(storySentSats)).unlocked.some((chapter) => !storyRead[chapter.id]);
  const cueWins = !!cue.lineKey && cue.priority >= CuePriority.voice;
  const route = cueWins ? (cue.lineKey === "avatar.storyUnlocked" ? "/story" : undefined) : hint.route;
  const line = cueWins ? t(cue.lineKey!, cue.lineParams) : t(hint.lineKey);
  const answers = STAGE_CHOICES.filter((id) => id !== "settings").map((id) => ({
    id, label: t(`talk.choice.${id}`), icon: menuIcons[id], unread: id === "story" && unread,
    hint: id === "story" && unread ? t("story.new") : undefined,
    primary: id === "receive", onPress: () => router.push(routes[id]),
  }));
  return <Stage scene="home" line={line} onLinePress={route ? () => router.push(route) : undefined} choices={answers.slice(0, 2)} headerActions={
      <View style={styles.headerActions}>
        {adapter.isMock && "simulateIncoming" in adapter ? <Pressable onPress={() => (adapter as typeof adapter & { simulateIncoming(sats: bigint): void }).simulateIncoming(10_000n)} accessibilityRole="button" accessibilityLabel={t("mock.simulateIncoming")} style={({ pressed }) => [styles.practice, pressed && { opacity: 0.65 }]}>
          <Text style={styles.mockBadge}>{t("stage.mockOnly")}</Text><Text style={styles.practiceLabel}>{t("mock.short")}</Text>
        </Pressable> : null}
      </View>
    } afterChoices={<><StageChoices choices={answers.slice(2)} compact /><TalkInput onSubmit={onCommand} /></>} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  practice: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: theme.colors.backgroundRaised, flexShrink: 1 },
  mockBadge: { color: theme.colors.warning, fontSize: 10, lineHeight: 13, fontWeight: "800", letterSpacing: 1 },
  practiceLabel: { color: theme.colors.warning, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
