import { memo, useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { bus } from "@/container";
import { CuePriority, IDLE_CUE, type AvatarCue } from "@/domain/avatar";
import type { SendPhase } from "@/domain/payment";
import type { SceneId } from "@/domain/events";
import { AnimatedAvatarRenderer } from "@/game/AnimatedAvatarRenderer";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { AvatarLife } from "./AvatarLife";
import { AVATAR_ASPECT } from "@/game/AvatarRenderer";
import { useDialogue } from "./dialogue";
import { SpeechBubble } from "./conversation";
import { useLivingAvatar } from "./useLivingAvatar";


/** Focus/keyboard gate prevents offscreen routes from decoding extra animated WebPs. */
export const Companion = memo(function Companion(props: { scene: SceneId; large?: boolean; fallbackCue?: AvatarCue; unresolved?: boolean; sendResult?: { phase: SendPhase; operationId?: string } }) {
  const [focused, setFocused] = useState(false);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return focused && !keyboard ? <CompanionContent {...props} /> : null;
});

function CompanionContent({ scene, large = false, fallbackCue, unresolved = false, sendResult }: { scene: SceneId; large?: boolean; fallbackCue?: AvatarCue; unresolved?: boolean; sendResult?: { phase: SendPhase; operationId?: string } }) {
  const current = useAvatarCue();
  const reduceMotion = useReduceMotion();
  const t = useT();
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 700 || fontScale > 1.3;
  const foreignScreen = /^avatar\.screen\./.test(current.lineKey ?? "") && current.lineKey !== `avatar.screen.${scene}`;
  const unsafeForUnresolved = unresolved && (current.action === "celebrate" || current.action === "catch" || current.lineKey === "avatar.sending" || current.lineKey === "avatar.unknown");
  const expectedPayment = sendResult?.phase === "succeeded" ? `paid:${sendResult.operationId}` : sendResult?.phase === "failed" ? `failed:${sendResult.operationId}` : sendResult?.phase === "unknown" ? `unknown:${sendResult.operationId}` : sendResult?.phase === "submitting" ? current.eventId : undefined;
  const unrelatedPayment = !!sendResult && current.priority === CuePriority.paymentResult && current.eventId !== expectedPayment;
  const cue = fallbackCue && (unsafeForUnresolved || unrelatedPayment || current.priority < fallbackCue.priority) ? fallbackCue : foreignScreen ? IDLE_CUE : current;
  const line = t(cue.lineKey ?? `avatar.screen.${scene}`, cue.lineParams);
  const story = cue.lineKey === "avatar.storyUnlocked";
  const protectedStep = sendResult?.phase === "review" || sendResult?.phase === "authorizing" || sendResult?.phase === "submitting";
  const dialogue = useDialogue(line, reduceMotion, protectedStep);
  const visual = useLivingAvatar(cue, reduceMotion, dialogue.typing || protectedStep);
  const [pressed, setPressed] = useState(false);
  const portraitHeight = large ? Math.min(height * (compact ? 0.25 : 0.34), 290) : compact ? theme.presence.portraitShort : theme.presence.portrait;
  const avatarHeight = large ? portraitHeight : portraitHeight * theme.presence.portraitZoom;
  return (
    <View style={[styles.strip, large && styles.large]}>
      <Pressable disabled={protectedStep} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityRole="button" accessibilityLabel={t("home.avatar")} onPress={() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })} style={[styles.portrait, !large && styles.bust, { height: portraitHeight, width: large ? undefined : compact ? theme.presence.portraitShort : theme.presence.portrait }]}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AvatarLife height={avatarHeight} width={avatarHeight * AVATAR_ASPECT} reduceMotion={reduceMotion} lineKey={line} pressed={pressed} amplitude={large ? 3 : 1.5} shadow={large}>
            <AnimatedAvatarRenderer cue={visual} height={avatarHeight} reduceMotion={reduceMotion} speaking={dialogue.typing} />
          </AvatarLife>
        </View>
      </Pressable>
      <View style={large ? styles.largeBubble : styles.bubbleSlot}>
        <SpeechBubble dialogue={dialogue} side={large ? "down" : "left"} onAdvance={story ? () => router.push("/story") : undefined} hint={story ? t("story.open") : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md, marginTop: 0, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm, width: "100%", maxWidth: theme.presence.maxWidth, alignSelf: "center", flexShrink: 0 },
  portrait: { minWidth: theme.presence.touch, minHeight: theme.presence.touch, overflow: "hidden", alignItems: "center", justifyContent: "flex-start" },
  bust: { borderBottomLeftRadius: theme.radius.lg, borderBottomRightRadius: theme.radius.lg },
  bubbleSlot: { flex: 1 },
  large: { flexDirection: "column", marginTop: 0 },
  largeBubble: { alignSelf: "stretch" },
});
