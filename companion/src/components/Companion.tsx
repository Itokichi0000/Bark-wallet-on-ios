import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { bus } from "@/container";
import { CuePriority, IDLE_CUE, type AvatarCue } from "@/domain/avatar";
import type { SendPhase } from "@/domain/payment";
import type { SceneId } from "@/domain/events";
import { AnimatedAvatarRenderer } from "@/game/AnimatedAvatarRenderer";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";
import { useLivingAvatar } from "./useLivingAvatar";

const c = theme.colors;

/** Transforms/opacity only; a replacement cue interrupts the spring on the UI thread. */
export function HudBubble({ children, changeKey, reduceMotion }: { children: ReactNode; changeKey: string; reduceMotion: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    progress.set(reduceMotion ? withTiming(1, { duration: 140 }) : withSpring(1, { duration: 260, dampingRatio: 0.85 }));
    return () => cancelAnimation(progress);
  }, [changeKey, reduceMotion, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.65 + Math.min(1, progress.get()) * 0.35,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * 5 }, { scale: reduceMotion ? 1 : 0.97 + progress.get() * 0.03 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

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
  const visual = useLivingAvatar(cue, reduceMotion);
  const line = t(cue.lineKey ?? `avatar.screen.${scene}`, cue.lineParams);
  const story = cue.lineKey === "avatar.storyUnlocked";
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [line]);
  const portraitHeight = large ? Math.min(height * (compact ? 0.25 : 0.34), 290) : compact ? 76 : 112;
  return (
    <View style={[styles.strip, large && styles.large]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("home.avatar")} onPress={() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })} style={[styles.portrait, { height: portraitHeight, width: large ? undefined : compact ? 66 : 94 }]}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AnimatedAvatarRenderer cue={visual} height={large ? portraitHeight : portraitHeight * 1.75} reduceMotion={reduceMotion} />
        </View>
      </Pressable>
      <View style={large ? styles.largeBubble : styles.bubbleSlot}>
        <HudBubble changeKey={line} reduceMotion={reduceMotion}>
          <Pressable
            onPress={story ? () => router.push("/story") : compact ? () => setExpanded(!expanded) : undefined}
            accessibilityRole={story || compact ? "button" : undefined}
            accessibilityLabel={line}
            accessibilityHint={story ? t("story.open") : compact ? t("companion.expand") : undefined}
            accessibilityState={compact && !story ? { expanded } : undefined}
            style={styles.bubble}
          >
            <Text style={styles.name}>{t("companion.name")}</Text>
            <Text style={styles.line} numberOfLines={compact && !expanded ? 2 : undefined} accessibilityLiveRegion="polite">{line}</Text>
            {story ? <Text style={styles.link}>{t("story.open")} ›</Text> : null}
          </Pressable>
        </HudBubble>
      </View>
    </View>
  );
}

/** Home subscribes here, so reactions don't re-render balance/history or the whole route. */
export const HomeCompanion = memo(function HomeCompanion({ hint, height, children, active = true }: {
  hint: { lineKey: string; route?: Href }; height: number; children?: ReactNode; active?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return focused && active ? <HomeCompanionContent hint={hint} height={height}>{children}</HomeCompanionContent> : null;
});

function HomeCompanionContent({ hint, height, children }: { hint: { lineKey: string; route?: Href }; height: number; children?: ReactNode }) {
  const cue = useAvatarCue();
  const reduceMotion = useReduceMotion();
  const visual = useLivingAvatar(cue, reduceMotion);
  const t = useT();
  const showHint = !cue.lineKey || /^avatar\.screen\./.test(cue.lineKey);
  const route = cue.lineKey === "avatar.storyUnlocked" ? "/story" : showHint ? hint.route : undefined;
  const line = t(showHint ? hint.lineKey : cue.lineKey!, showHint ? undefined : cue.lineParams);
  return <>
    <HudBubble changeKey={line} reduceMotion={reduceMotion}>
      <Pressable onPress={route ? () => router.push(route) : undefined} accessibilityRole={route ? "button" : undefined} style={[styles.bubble, styles.homeBubble]}>
        <Text style={[styles.line, { flex: 1 }]} accessibilityLiveRegion="polite">{line}</Text>
        {route ? <BitcoinIcon name="caret-right" size={16} /> : null}
      </Pressable>
    </HudBubble>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Pressable onPress={() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") })} accessibilityRole="button" accessibilityLabel={t("home.avatar")} style={styles.hero}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><AnimatedAvatarRenderer cue={visual} height={height} reduceMotion={reduceMotion} /></View>
      </Pressable>
    </View>
    {children}
  </>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline, backgroundColor: c.backgroundRaised, width: "100%", maxWidth: 620, alignSelf: "center", flexShrink: 0 },
  portrait: { minWidth: 44, minHeight: 44, overflow: "hidden", alignItems: "center", justifyContent: "flex-start" },
  bubbleSlot: { flex: 1, paddingVertical: 4 },
  bubble: { minHeight: 44, borderWidth: 1, borderColor: c.outline, backgroundColor: c.panelSolid, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  name: { color: c.primary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  line: { color: c.text, fontSize: 13, lineHeight: 19 },
  link: { color: c.primary, fontSize: 12, fontWeight: "600", paddingTop: 4 },
  large: { flexDirection: "column", borderTopWidth: 0, borderRadius: 24, paddingVertical: 12 },
  largeBubble: { alignSelf: "stretch" },
  homeBubble: { flexDirection: "row", alignItems: "center", gap: 8 },
  hero: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
