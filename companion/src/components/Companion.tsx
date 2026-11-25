import { memo, useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated, { useAnimatedStyle, useDerivedValue } from "react-native-reanimated";
import { bus } from "@/container";
import { CuePriority, IDLE_CUE, type AvatarCue } from "@/domain/avatar";
import type { SendPhase } from "@/domain/payment";
import type { SceneId } from "@/domain/events";
import { StageAvatar } from "./stage-avatar";
import { fullBodyLayout, useAvatarDrift } from "./avatar-drift";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { useDialogue } from "./dialogue";
import { PlayerBubble, SpeechBubble, useConversation } from "./conversation";
import { useLivingAvatar } from "./useLivingAvatar";
import { useNoaTalk } from "./use-noa-talk";
import { ListeningFeedback } from "./talk-controls";


/** Offscreen routes do not decode clips; the keyboard keeps a compact full-body companion. */
export const Companion = memo(function Companion(props: { scene: SceneId; large?: boolean; blocked?: boolean; fallbackCue?: AvatarCue; unresolved?: boolean; sendResult?: { phase: SendPhase; operationId?: string } }) {
  const [focused, setFocused] = useState(false);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return focused ? <CompanionContent {...props} large={keyboard ? false : props.large} /> : null;
});

function CompanionContent({ scene, large = false, blocked: conversationBlocked = false, fallbackCue, unresolved = false, sendResult }: { scene: SceneId; large?: boolean; blocked?: boolean; fallbackCue?: AvatarCue; unresolved?: boolean; sendResult?: { phase: SendPhase; operationId?: string } }) {
  const current = useAvatarCue();
  const reduceMotion = useReduceMotion();
  const t = useT();
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 700 || fontScale > 1.3;
  const foreignScreen = /^avatar\.screen\./.test(current.lineKey ?? "") && current.lineKey !== `avatar.screen.${scene}`;
  const unsafeForUnresolved = unresolved && (current.action === "celebrate" || current.action === "catch" || current.lineKey === "avatar.sending" || current.lineKey === "avatar.unknown");
  const expectedPayment = sendResult?.phase === "succeeded" ? `paid:${sendResult.operationId}` : sendResult?.phase === "failed" ? `failed:${sendResult.operationId}` : sendResult?.phase === "unknown" ? `unknown:${sendResult.operationId}` : sendResult?.phase === "submitting" ? current.eventId : undefined;
  const unrelatedPayment = !!sendResult && current.priority === CuePriority.paymentResult && current.eventId !== expectedPayment;
  const baseCue = fallbackCue && (unsafeForUnresolved || unrelatedPayment || current.priority < fallbackCue.priority) ? fallbackCue : foreignScreen ? IDLE_CUE : current;
  const protectedStep = sendResult?.phase === "review" || sendResult?.phase === "authorizing" || sendResult?.phase === "submitting";
  const blocked = conversationBlocked || scene === "seed" || scene === "recovery" || scene === "onboarding";
  const echo = useConversation(!blocked, protectedStep || blocked, reduceMotion);
  const talk = useNoaTalk({ active: !blocked, sensitive: protectedStep, blocked, turnKey: scene, choices: [], say: echo.say, cancel: echo.cancel });
  const cue = !protectedStep && baseCue.priority < CuePriority.paymentResult && talk.cue ? talk.cue : baseCue;
  const line = t(cue.lineKey ?? `avatar.screen.${scene}`, cue.lineParams);
  const story = cue.lineKey === "avatar.storyUnlocked";
  const dialogue = useDialogue(line, reduceMotion, protectedStep || talk.listening, !talk.listening);
  const visual = useLivingAvatar(cue, reduceMotion, dialogue.typing || protectedStep || talk.listening);
  const playerTurn = talk.listening ? { id: -1, text: talk.partial || t("talk.mic.listening"), listening: true } : echo.turn;
  const drift = useAvatarDrift(reduceMotion, dialogue.typing && !protectedStep);
  const portraitHeight = large ? Math.min(height * 0.4, 340) : compact ? 136 : 160;
  const portraitWidth = large ? 220 : compact ? 88 : 104;
  const { travel } = fullBodyLayout(portraitWidth, portraitHeight, height);
  const tailX = useDerivedValue(() => portraitWidth / 2 - 12 + drift.wander.get() * travel);
  const bubbleMotion = useAnimatedStyle(() => ({ transform: [{ translateX: large ? 0 : drift.wander.get() * Math.min(6, travel) }] }));
  return (
    <View style={[styles.strip, large && styles.large]}>
      <StageAvatar cue={visual} width={portraitWidth} height={portraitHeight} reduceMotion={reduceMotion}
        speaking={dialogue.typing && !talk.listening && cue.action !== "wave"} disabled={protectedStep || blocked}
        onPress={talk.voiceInput ? talk.toggleMic : () => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })} drift={drift} />
      <Animated.View style={[large ? styles.largeBubble : styles.bubbleSlot, bubbleMotion]}>
        <SpeechBubble tailX={large ? tailX : undefined} dialogue={dialogue} side={large ? "down" : "left"} onAdvance={story ? () => router.push("/story") : undefined} hint={story ? t("story.open") : undefined} />
        {playerTurn && !blocked ? <PlayerBubble turn={playerTurn} /> : null}
        {!blocked && !protectedStep ? <ListeningFeedback listening={talk.listening} gesture={talk.gesture} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md, marginTop: 0, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm, width: "100%", maxWidth: theme.presence.maxWidth, alignSelf: "center", flexShrink: 0 },
  bubbleSlot: { flex: 1 },
  large: { flexDirection: "column-reverse", marginTop: 0 },
  largeBubble: { alignSelf: "stretch" },
});
