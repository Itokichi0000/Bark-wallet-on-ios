import { createContext, memo, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/state/settingsStore";
import { useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { BitcoinIcon, type BitcoinIconName } from "./BitcoinIcon";
import { DialogueLine, type DialogueState } from "./dialogue";

const p = theme.presence;
const c = theme.colors;
const ease = Easing.bezier(...p.easeOut);
export function replyHaptic() { if (useSettings.getState().hapticsEnabled) void Haptics.selectionAsync().catch(() => undefined); }

type Turn = { id: number; text: string; listening: boolean };
type Conversation = { turn?: Turn; say(text: string, action: () => void): void };
export const ConversationContext = createContext<Conversation | undefined>(undefined);

/** Only presentation/navigation continuations wait. Review/auth/submission never enter this timer. */
export function useConversation(active: boolean, protectedStep: boolean, reduceMotion: boolean): Conversation {
  const [turn, setTurn] = useState<Turn>();
  const serial = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = useCallback(() => { clearTimeout(timer.current); serial.current++; }, []);
  useEffect(() => { if (!active || protectedStep || reduceMotion) { clear(); setTurn(undefined); } return clear; }, [active, protectedStep, reduceMotion, clear]);
  const say = useCallback((text: string, action: () => void) => {
    clear();
    replyHaptic();
    if (!active) return;
    if (protectedStep || reduceMotion) { setTurn({ id: serial.current, text, listening: false }); action(); return; }
    const id = serial.current;
    setTurn({ id, text, listening: true });
    timer.current = setTimeout(() => {
      if (id !== serial.current) return;
      setTurn({ id, text, listening: false });
      action();
    }, p.beatMs);
  }, [active, protectedStep, reduceMotion, clear]);
  return { turn, say };
}

/** One filled SVG tail overlaps the same-colour silhouette by a point: no border seam. */
function Tail({ side, compact = false }: { side: "down" | "left"; compact?: boolean }) {
  return <Svg pointerEvents="none" accessible={false} width={compact ? 8 : p.tail} height={compact ? 8 : p.tail} viewBox="0 0 24 24" style={side === "down" ? [styles.tailDown, compact && { bottom: -7 }] : styles.tailLeft}>
    <Path d={side === "down" ? "M0 0H24Q13 6 16 24Q2 17 0 0Z" : "M24 0V24Q16 12 0 16Q9 2 24 0Z"} fill={c.speech} />
  </Svg>;
}

export const SpeechBubble = memo(function SpeechBubble({ dialogue, children, onAdvance, hint, side = "down", subdued = false, compact = false, maxHeight }: {
  dialogue: DialogueState; children?: ReactNode; onAdvance?: () => void; hint?: string; side?: "down" | "left"; subdued?: boolean; compact?: boolean; maxHeight?: number;
}) {
  const { fontScale } = useWindowDimensions();
  const enter = useSharedValue(1);
  const resize = useSharedValue(1);
  const measured = useRef(0);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    enter.set(0);
    enter.set(withTiming(1, { duration: dialogue.reduceMotion ? p.fadeMs : p.bubbleMs, easing: ease }));
    return () => cancelAnimation(enter);
  }, [dialogue.line, dialogue.reduceMotion, enter]);
  const pop = useAnimatedStyle(() => ({ opacity: enter.get() * (subdued ? 0.55 : 1), transform: [{ scale: dialogue.reduceMotion ? 1 : 0.94 + enter.get() * 0.06 }] }));
  const silhouette = useAnimatedStyle(() => ({ transform: [{ scaleY: dialogue.reduceMotion ? 1 : resize.get() }] }));
  return <Animated.View style={[styles.speech, compact && styles.compactSpeech, { transformOrigin: side === "left" ? [-p.tail, p.bubblePadding + p.tail * 0.66, 0] : ["66%", bubbleHeight + p.tail, 0] }, pop]} onLayout={(event) => {
    const next = event.nativeEvent.layout.height;
    if (measured.current && next !== measured.current && !dialogue.reduceMotion) {
      resize.set(measured.current / next);
      resize.set(withTiming(1, { duration: p.bubbleMs, easing: ease }));
    }
    measured.current = next;
    setBubbleHeight(next);
  }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.silhouette, silhouette]} />
    <Tail side={side} compact={compact} />
    <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: maxHeight ?? p.speechLine * fontScale * 5 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
      <DialogueLine dialogue={dialogue} style={[styles.speechText, compact && styles.compactSpeechText]} onAdvance={onAdvance} hint={hint} />
      {children ? <View style={styles.facts}>{children}</View> : null}
    </ScrollView>
  </Animated.View>;
});

export function SpeechFact({ children, tone = "muted", selectable = false }: { children: ReactNode; tone?: "muted" | "warning" | "danger"; selectable?: boolean }) {
  return <Text selectable={selectable} accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.fact, { color: tone === "danger" ? c.speechDanger : tone === "warning" ? c.speechWarning : c.speechMuted }]}>{children}</Text>;
}

export const PlayerBubble = memo(function PlayerBubble({ turn }: { turn: Turn }) {
  const reduceMotion = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const progress = useSharedValue(1);
  useEffect(() => { progress.set(0); progress.set(withTiming(1, { duration: p.replyMs, easing: ease })); return () => cancelAnimation(progress); }, [turn.id, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduceMotion ? 0 : p.rise * (1 - progress.get()) }] }));
  return <Animated.View style={[styles.player, motion]}><ScrollView nestedScrollEnabled style={{ maxHeight: p.replyLine * fontScale * 5 }}><Text style={styles.playerText}>{turn.text}</Text></ScrollView></Animated.View>;
});

export function Reply({ label, onPress, primary, disabled, busy, icon, hint, round, unread }: {
  label: string; onPress(): void; primary?: boolean; disabled?: boolean; busy?: boolean; icon?: BitcoinIconName; hint?: string; round?: boolean; unread?: boolean;
}) {
  const conversation = useContext(ConversationContext);
  const selected = conversation?.turn?.listening && conversation.turn.text === label;
  const dimmed = !!conversation?.turn?.listening && !selected;
  const opacity = useSharedValue(1);
  useEffect(() => { opacity.set(withTiming(dimmed ? 0.45 : 1, { duration: p.replyMs })); return () => cancelAnimation(opacity); }, [dimmed, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[{ maxWidth: "100%", flexShrink: 1 }, fade]}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }} disabled={disabled || busy}
    onPress={() => conversation ? conversation.say(label, onPress) : (replyHaptic(), onPress())}
    style={({ pressed }) => [styles.reply, primary && styles.primary, round && styles.round, { opacity: disabled || busy ? 0.45 : pressed ? 0.65 : 1 }]}>
    {busy ? <ActivityIndicator color={c.text} /> : icon ? <BitcoinIcon name={icon} color={primary ? c.background : c.text} size={20} /> : null}
    <Text style={[styles.replyText, round && styles.roundLabel, primary && { color: c.background }]}>{label}</Text>
    {unread ? <View style={styles.unread} /> : null}
  </Pressable></Animated.View>;
}

/** The keyboard and iOS dictation use the same native TextInput; no voice-send path. */
export function TalkInput({ onSubmit }: { onSubmit(text: string): void }) {
  const [text, setText] = useState("");
  const t = useT();
  const conversation = useContext(ConversationContext);
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText(""); Keyboard.dismiss();
    if (conversation) conversation.say(value, () => onSubmit(value)); else onSubmit(value);
  };
  return <ReplyComposer value={text} onChangeText={setText} placeholder={t("presence.talkPlaceholder")} accessibilityLabel={t("talk.title")} submitLabel={t("talk.send")} onSend={submit} disabled={!text.trim()} />;
}

export function ReplyComposer({ onSend, submitLabel, disabled, children, replyText, ...input }: TextInputProps & {
  onSend(): void; submitLabel: string; disabled?: boolean; children?: ReactNode; replyText?: string;
}) {
  const conversation = useContext(ConversationContext);
  const submit = () => { if (disabled) return; if (replyText && conversation) { Keyboard.dismiss(); conversation.say(replyText, onSend); } else onSend(); };
  return <View style={styles.composer}>
    <View style={styles.composeRow}>
      <TextInput {...input} placeholderTextColor={c.textMuted} style={[styles.input, input.style]} returnKeyType={input.returnKeyType ?? "send"} onSubmitEditing={submit} />
      <Pressable accessibilityRole="button" accessibilityLabel={submitLabel} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={submit} style={({ pressed }) => [styles.arrow, { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}>
        <BitcoinIcon name="caret-right" size={22} color={c.background} />
      </Pressable>
    </View>
    {children}
  </View>;
}

const styles = StyleSheet.create({
  speech: { padding: p.bubblePadding, minHeight: p.touch, marginBottom: p.tail, alignSelf: "stretch" },
  silhouette: { borderRadius: p.bubbleRadius, borderCurve: "continuous", backgroundColor: c.speech, boxShadow: p.bubbleShadow, transformOrigin: "bottom center" },
  tailDown: { position: "absolute", bottom: -p.tail + 1, left: "62%" },
  tailLeft: { position: "absolute", left: -p.tail + 1, top: p.bubblePadding },
  speechText: { color: c.speechInk, fontSize: p.speechSize, lineHeight: p.speechLine },
  facts: { gap: p.gap, paddingTop: p.gap },
  fact: { fontSize: p.footnoteSize, lineHeight: p.footnoteLine },
  player: { maxWidth: "85%", alignSelf: "flex-end", padding: p.bubblePadding, borderRadius: p.replyRadius, borderBottomRightRadius: theme.spacing.xs, backgroundColor: c.primary, marginBottom: p.gap },
  playerText: { color: c.background, fontSize: p.replySize, lineHeight: p.replyLine },
  reply: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: p.gap, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, minHeight: p.touch, borderRadius: p.replyRadius, borderBottomRightRadius: theme.spacing.xs, backgroundColor: c.reply, borderWidth: 1, borderColor: c.replyBorder, boxShadow: p.replyShadow },
  primary: { backgroundColor: c.primary, borderColor: c.primary },
  round: { minWidth: p.iconReply, minHeight: 58, flexDirection: "column", gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 6 },
  roundLabel: { fontSize: 11, lineHeight: 15 },
  compactSpeech: { padding: 6, marginBottom: 8 },
  compactSpeechText: { fontSize: 15, lineHeight: 21 },
  replyText: { flexShrink: 1, color: c.text, fontSize: p.replySize, lineHeight: p.replyLine, fontWeight: "600", textAlign: "center" },
  unread: { position: "absolute", right: theme.spacing.xs, top: theme.spacing.xs, width: p.gap, height: p.gap, borderRadius: theme.radius.pill, backgroundColor: c.primary },
  composer: { alignSelf: "stretch", padding: theme.spacing.sm, borderRadius: p.replyRadius, borderBottomRightRadius: theme.spacing.xs, backgroundColor: c.reply, borderWidth: 1, borderColor: c.replyBorder, gap: p.gap },
  composeRow: { flexDirection: "row", alignItems: "center", gap: p.gap },
  input: { flex: 1, minWidth: 0, color: c.text, fontSize: p.replySize, minHeight: p.touch, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  arrow: { minWidth: p.touch, minHeight: p.touch, borderRadius: theme.radius.pill, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
});
