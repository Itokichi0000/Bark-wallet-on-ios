import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Stage, StageChoices } from "@/components/stage";
import { TalkInput } from "@/components/conversation";
import { MockChip } from "@/components/MockChip";
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
import { conversation } from "@/container";
import { useSettingsHydrated } from "@/components/conversation-runtime";

const menuIcons: Record<string, BitcoinIconName> = { receive: "receive", send: "send", activity: "transactions", coins: "wallet", story: "star", guide: "mnemonic" };

const routes = { receive: "/receive", send: "/send", activity: "/archive", coins: "/assets", story: "/story", guide: "/quest", settings: "/settings" } as const;

export default function HomeScene() {
  const t = useT();
  const view = useWalletStore();
  const { balanceHidden, seedBackupConfirmed, storySentSats, storyRead, conversationOffered, update } = useSettings();
  const hydrated = useSettingsHydrated();
  const invite = hydrated && !conversationOffered;
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
  const accept = (voiceInput: boolean, handGestures: boolean) => {
    update({ voiceInput, handGestures, conversationOffered: true });
    void conversation.syncEyes();
  };
  const invitations = [
    { id: "voice-and-hands", label: t("talk.invite.both"), onPress: () => accept(true, true) },
    { id: "voice-only", label: t("talk.invite.voice"), onPress: () => accept(true, false) },
    { id: "later", label: t("talk.invite.later"), onPress: () => accept(false, false) },
  ];
  const mainReplies = invite ? invitations : answers.slice(0, 2);
  const menuReplies = answers.filter((answer) => !mainReplies.some((reply) => reply.id === answer.id));
  return <Stage scene="home" line={invite ? t("talk.invite.line") : line} onCommand={onCommand} turnKey={invite ? "home:invite" : "home"}
    talkChoices={invite ? [...invitations, ...answers] : answers}
    onLinePress={!invite && route ? () => router.push(route) : undefined} choices={mainReplies} headerActions={
      <View style={styles.headerActions}>
        {adapter.isMock && "simulateIncoming" in adapter ? <MockChip onPress={() => (adapter as typeof adapter & { simulateIncoming(sats: bigint): void }).simulateIncoming(10_000n)} label={t("mock.simulateIncoming")} /> : null}
      </View>
    } afterChoices={<><StageChoices choices={menuReplies} compact /><TalkInput onSubmit={onCommand} /></>} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
});
