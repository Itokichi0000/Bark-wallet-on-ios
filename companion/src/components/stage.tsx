import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { IS_MAINNET } from "@/config/network";
import { CuePriority, IDLE_CUE, type AvatarCue } from "@/domain/avatar";
import type { SendPhase } from "@/domain/payment";
import { SceneBackground } from "@/game/SceneBackground";
import { useAvatarCue, useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { useSettings } from "@/state/settingsStore";
import { useWalletStore } from "@/state/walletStore";
import { theme } from "@/theme";
import { formatAmount } from "@/utils/format";
import { BitcoinIcon, type BitcoinIconName } from "./BitcoinIcon";
import { SceneContext, userAction, useSceneFocus } from "./companionEvents";
import { ambientState } from "./StatusStrip";
import { SyncStatus } from "./SyncStatus";
import { StageAvatar, StageBoard } from "./stage-avatar";
import { useLivingAvatar } from "./useLivingAvatar";
import { useDialogue } from "./dialogue";
import { Button, ModeBanner, NetworkTag } from "./ui";
import { ConversationContext, PlayerBubble, Reply, SpeechBubble, replyHaptic, useConversation } from "./conversation";

const c = theme.colors;
export type StageAnswer = { id: string; label: string; onPress(): void; primary?: boolean; disabled?: boolean; busy?: boolean; hint?: string; icon?: BitcoinIconName; unread?: boolean; alwaysVisible?: boolean };
export const finishStage = () => router.canGoBack() ? router.back() : router.replace("/home");

/** Screen-owned presentation: reactions never withdraw or replay the board. */
export function usePresentBoard(enabled: boolean, emotion: AvatarCue["emotion"], lineKey: string) {
  return useMemo<AvatarCue | undefined>(() => enabled ? {
    id: `board:${lineKey}`, emotion, action: "present", lineKey,
    priority: CuePriority.menu, interruptible: true, holdMs: 0,
  } : undefined, [enabled, emotion, lineKey]);
}

export function StageChoices({ choices, compact = false, deliberate = false }: { choices: readonly StageAnswer[]; compact?: boolean; deliberate?: boolean }) {
  return <View style={styles.choices}>
    {choices.map((choice, index) => <View key={choice.id} style={compact ? undefined : styles.choice}>
      {deliberate ? <Button label={choice.label} onPress={() => { replyHaptic(); choice.onPress(); }} kind={index === 0 ? "primary" : "secondary"} disabled={choice.disabled} busy={choice.busy} accessibilityHint={choice.hint} /> :
        <Reply {...choice} round={compact} primary={!compact && (choice.primary ?? index === 0)} />}
    </View>)}
  </View>;
}

type Props = {
  scene: "home" | "receive" | "send" | "story"; line: string; onLinePress?: () => void; choices: readonly StageAnswer[];
  children?: ReactNode; speechFacts?: ReactNode; caption?: ReactNode; onStagePress?: () => void; headerActions?: ReactNode; afterChoices?: ReactNode; board?: ReactNode | ((size: number) => ReactNode); fallbackCue?: AvatarCue;
  boardCue?: AvatarCue; boardImmediate?: boolean;
  locked?: boolean; onBack?: () => void; review?: boolean; active?: boolean;
  sendResult?: { phase: SendPhase; operationId?: string }; receivedId?: string;
};

export function Stage(props: Props) {
  useSceneFocus(props.scene);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <SceneContext.Provider value={props.scene}><View style={styles.root}>
    <StageContent {...props} active={focused && props.active !== false} />
  </View></SceneContext.Provider>;
}

function StageContent({ scene, line, onLinePress, choices, children, speechFacts, caption, onStagePress, headerActions, afterChoices, board, boardCue, boardImmediate, fallbackCue, locked = false, onBack, review = false, active, sendResult, receivedId }: Props) {
  const t = useT();
  const { width, height: windowHeight, fontScale } = useWindowDimensions();
  const view = useWalletStore();
  const { unit, balanceHidden, update } = useSettings();
  const reduceMotion = useReduceMotion();
  const current = useAvatarCue();
  const panelProgress = useSharedValue(1);
  useEffect(() => {
    if (!review) return;
    panelProgress.set(0);
    panelProgress.set(withTiming(1, { duration: reduceMotion ? theme.presence.fadeMs : theme.presence.receiptMs, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    return () => cancelAnimation(panelProgress);
  }, [review, reduceMotion, panelProgress]);
  const panelStyle = useAnimatedStyle(() => ({ opacity: 0.8 + panelProgress.get() * 0.2, transform: [{ translateY: reduceMotion ? 0 : (1 - panelProgress.get()) * theme.presence.rise }] }));
  const [available, setAvailable] = useState(windowHeight - 120);
  const [boardActive, setBoardActive] = useState(false);
  const [replyHeight, setReplyHeight] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const roomScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const unresolved = sendResult?.phase === "pending" || sendResult?.phase === "unknown";
  const expected = sendResult?.phase === "succeeded" ? `paid:${sendResult.operationId}` : sendResult?.phase === "failed" ? `failed:${sendResult.operationId}` : sendResult?.phase === "unknown" ? `unknown:${sendResult.operationId}` : undefined;
  const success = current.action === "celebrate" || current.action === "catch";
  const foreignResult = !!sendResult && current.priority === CuePriority.paymentResult && current.eventId !== expected && sendResult.phase !== "submitting";
  const unsafe = (unresolved && (success || current.action === "sending")) || (success && scene === "send" && (sendResult?.phase !== "succeeded" || current.eventId !== expected)) || (success && scene === "receive" && current.eventId !== `recv:${receivedId}`);
  const foreignScene = /^avatar\.screen\./.test(current.lineKey ?? "") && current.lineKey !== `avatar.screen.${scene}`;
  const cue = unsafe || foreignResult || foreignScene ? fallbackCue ?? IDLE_CUE : fallbackCue && current.priority < fallbackCue.priority ? fallbackCue : current;
  const paymentResult = cue.priority >= CuePriority.paymentResult && (cue.action === "catch" || cue.action === "celebrate" || cue.lineKey === "avatar.unknown");
  const presentation = boardCue && !paymentResult ? boardCue : cue;
  const spokenLine = boardCue && cue.lineKey && cue.priority > CuePriority.menu ? t(cue.lineKey, cue.lineParams) : line;
  const protectedStep = review || locked;
  const conversation = useConversation(!!active, protectedStep, reduceMotion);
  const listening = !!conversation.turn?.listening;
  const dialogueState = useDialogue(spokenLine, reduceMotion, protectedStep, !!active && !listening);
  // Home enters at its conversational framing. A scene greeting must not
  // start a 5s one-shot (and an extra decoder) before the first typed line.
  const homeRest = useMemo(() => scene === "home" && presentation.priority <= CuePriority.scene
    ? { ...presentation, action: "idle" as const } : presentation, [scene, presentation]);
  const visual = useLivingAvatar(homeRest, reduceMotion || !active, dialogueState.typing || protectedStep || boardActive || listening);
  const close = !!board && !!boardCue;
  const roomWidth = Math.min(width, 620);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const compact = windowHeight < 740 || fontScale > 1.2;
  // Footer is measured first and stays outside the scene. The face/board get
  // the remaining space; lengthy warnings can scroll inside speech only.
  const minHero = close ? 248 : keyboard ? 0 : 72;
  const speechLimit = Math.max(44, available - replyHeight - minHero - (compact ? 24 : 58));
  const revealInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    if (input) roomScroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, 20, true);
  }, []);
  useEffect(() => {
    if (!active) return;
    setKeyboard(Keyboard.isVisible());
    const show = Keyboard.addListener("keyboardDidShow", () => { setKeyboard(true); revealInput(); });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, [active, revealInput]);
  useEffect(() => { roomScroll.current?.scrollTo({ y: 0, animated: false }); }, [close]);
  useEffect(() => { roomScroll.current?.scrollTo({ y: 0, animated: false }); }, [line]);
  const balanceText = balanceHidden ? "••••••" : view.balance ? formatAmount(view.balance.spendableSats, unit) : t("home.balanceUnknown");
  const balanceLabel = `${t("home.spendable")}: ${balanceText}. ${t(balanceHidden ? "home.show" : "home.hide")}`;
  const balancePill = <Pressable onPress={() => { update({ balanceHidden: !balanceHidden }); userAction(balanceHidden ? "balance-shown" : "balance-hidden"); }} accessibilityRole="button" accessibilityLabel={balanceLabel} style={({ pressed }) => [styles.balance, fontScale > 1.5 && { flex: 0 }, pressed && { opacity: 0.75 }]}>
    {fontScale <= 1.2 ? <BitcoinIcon name={balanceHidden ? "hidden" : "visible"} size={18} /> : null}
    <Text style={[styles.balanceText, fontScale > 1.2 && { fontSize: 13 }]}>{balanceText}</Text>
  </Pressable>;
  const speech = <View style={[styles.speechSlot, compact && styles.wideSpeech]}>
    <SpeechBubble compact={compact} maxHeight={speechLimit} dialogue={dialogueState} onAdvance={onLinePress} subdued={listening}>{speechFacts}</SpeechBubble>
  </View>;
  return <>
    <SceneBackground state={ambientState(view)} active={active} />
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ModeBanner />
      <View style={styles.hud}>
        <View style={styles.hudTop}>
        {scene !== "home" ? <Pressable onPress={onBack ?? finishStage} disabled={locked} accessibilityRole="button" accessibilityLabel={t("common.back")} accessibilityState={{ disabled: locked }} style={[styles.icon, locked && { opacity: 0.3 }]}><BitcoinIcon name="caret-left" size={20} /></Pressable> : null}
        <NetworkTag />
        {fontScale <= 1.5 ? balancePill : <View style={{ flex: 1 }} />}
        <SyncStatus compact disabled={locked} showCompanion={false} />
        <Pressable onPress={() => router.push("/settings")} disabled={locked} accessibilityRole="button" accessibilityLabel={t("settings.title")} accessibilityState={{ disabled: locked }} style={[styles.icon, locked && { opacity: 0.3 }]}><BitcoinIcon name="gear" size={20} /></Pressable>
        </View>
        {fontScale > 1.5 ? balancePill : null}
      </View>
      {IS_MAINNET ? <Text style={styles.mainnet} accessibilityRole="alert">{t("net.mainnetLong")}</Text> : null}
        <ConversationContext.Provider value={conversation}>
        <View style={styles.safe} onLayout={(e) => setAvailable(e.nativeEvent.layout.height)}>
          {review ? <ScrollView ref={roomScroll} style={styles.safe} contentContainerStyle={styles.reviewBody} keyboardShouldPersistTaps="handled">
            {speech}
            <View style={{ height: 88, overflow: "hidden" }}>
              {active ? <StageAvatar cue={visual} width={roomWidth} height={88} reduceMotion={reduceMotion} onBoardActiveChange={setBoardActive} speaking={false} lineKey={spokenLine} disabled framingHeight={88} /> : null}
            </View>
            <Animated.View style={[styles.receipt, panelStyle]}>{children}</Animated.View>
          </ScrollView> : <>
            {speech}
            <View style={styles.hero} onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}>
              {active && heroHeight > 0 ? close ? <StageBoard cue={visual} width={roomWidth} height={heroHeight} reduceMotion={reduceMotion} speaking={dialogueState.typing && !listening} board={board} /> :
                <StageAvatar cue={visual} width={roomWidth} height={heroHeight} reduceMotion={reduceMotion} onBoardActiveChange={setBoardActive} speaking={dialogueState.typing && !listening} lineKey={spokenLine} disabled={protectedStep} framingHeight={heroHeight} fullBody={cue.action === "celebrate" || cue.action === "catch"} replyBeat={listening ? conversation.turn?.id : undefined} onPress={onStagePress ? (dialogueState.typing ? dialogueState.complete : onStagePress) : undefined} /> : null}
            </View>
          </>}
          <View style={[styles.replyArea, compact && styles.compactReplies]} onLayout={(e) => setReplyHeight(e.nativeEvent.layout.height)}>
            {caption}
            {/* A listening echo is transient; it must never displace a board or an input. */}
            {conversation.turn?.listening && !close && !keyboard && !children ? <PlayerBubble turn={conversation.turn} /> : null}
            {!review && children ? <ScrollView ref={roomScroll} style={{ maxHeight: Math.max(80, available - (keyboard ? 68 : 160) - 120) }} keyboardShouldPersistTaps="handled" onLayout={() => { if (keyboard) revealInput(); }} onContentSizeChange={() => { if (keyboard) revealInput(); }}>
              <View style={styles.answers}>{children}</View>
            </ScrollView> : null}
            <StageChoices choices={choices} deliberate={protectedStep} />
            {afterChoices}
            {headerActions && !keyboard ? <View style={styles.extras}>{headerActions}</View> : null}
          </View>
        </View>
        </ConversationContext.Provider>
    </SafeAreaView>
    </KeyboardAvoidingView>
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, safe: { flex: 1 },
  hud: { paddingHorizontal: 16, paddingVertical: 6, gap: 6, width: "100%", maxWidth: 620, alignSelf: "center" },
  hudTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  icon: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  balance: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: c.panel },
  balanceText: { flexShrink: 1, color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  mainnet: { color: c.danger, fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
  hero: { flex: 1, minHeight: 0, overflow: "hidden", alignItems: "center" },
  reviewBody: { paddingBottom: 12 },
  wideSpeech: { width: "auto", marginRight: 16, paddingTop: 4 },
  compactReplies: { paddingBottom: 8, gap: 4 },
  speechSlot: { width: `${theme.presence.bubbleWidth * 100}%`, marginLeft: theme.presence.edge, paddingTop: theme.spacing.sm, zIndex: 2 },
  replyArea: { paddingHorizontal: theme.presence.edge, paddingBottom: theme.spacing.sm, gap: theme.presence.gap, zIndex: 3, flexShrink: 0 },
  answers: { gap: theme.presence.gap },
  receipt: { backgroundColor: c.panelSolid, padding: theme.spacing.md, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: c.controlBorder, gap: theme.spacing.md },
  choices: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: theme.presence.gap },
  choice: { maxWidth: "100%", flexShrink: 1 },
  extras: { alignItems: "flex-end" },
});
