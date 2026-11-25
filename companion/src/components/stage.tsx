import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
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
import { fullBodyLayout, hologramLayout, useAvatarDrift } from "./avatar-drift";
import { useLivingAvatar } from "./useLivingAvatar";
import { useDialogue } from "./dialogue";
import { Button, ModeBanner, NetworkTag } from "./ui";
import { ConversationContext, Reply, SpeechBubble, replyHaptic, useConversation } from "./conversation";
import { StageEcho, stageEchoLayout } from "./stage-echo";
import { useNoaTalk, type TalkChoice } from "./use-noa-talk";
import { HandsIndicator, MicButton } from "./talk-controls";

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

export function StageChoices({ choices, compact = false, deliberate = false, accessory }: { choices: readonly StageAnswer[]; compact?: boolean; deliberate?: boolean; accessory?: ReactNode }) {
  return <View style={styles.choices}>
    {choices.map((choice, index) => <View key={choice.id} style={compact ? undefined : styles.choice}>
      {deliberate ? <Button label={choice.label} onPress={() => { replyHaptic(); choice.onPress(); }} kind={index === 0 ? "primary" : "secondary"} disabled={choice.disabled} busy={choice.busy} accessibilityHint={choice.hint} /> :
        <Reply {...choice} round={compact} primary={!compact && (choice.primary ?? index === 0)} />}
    </View>)}
    {accessory}
  </View>;
}

type Props = {
  scene: "home" | "receive" | "send" | "story"; line: string; onLinePress?: () => void; choices: readonly StageAnswer[];
  children?: ReactNode; speechFacts?: ReactNode; caption?: ReactNode; onStagePress?: () => void; headerActions?: ReactNode; afterChoices?: ReactNode | ((keyboard: boolean) => ReactNode); choiceAccessory?: ReactNode; board?: ReactNode | ((size: number) => ReactNode); fallbackCue?: AvatarCue;
  boardCue?: AvatarCue; boardImmediate?: boolean;
  locked?: boolean; onBack?: () => void; review?: boolean; active?: boolean;
  sendResult?: { phase: SendPhase; operationId?: string }; receivedId?: string;
  talkChoices?: readonly TalkChoice[]; onCommand?(text: string): void; onSpokenAmount?(sats: string): void;
  turnKey?: string; pages?: { next: string; previous: string };
};

export function Stage(props: Props) {
  useSceneFocus(props.scene);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <SceneContext.Provider value={props.scene}><View style={styles.root}>
    <StageContent {...props} active={focused && props.active !== false} />
  </View></SceneContext.Provider>;
}

function StageContent({ scene, line, onLinePress, choices, children, speechFacts, caption, onStagePress, headerActions, afterChoices, choiceAccessory, board, boardCue, boardImmediate, fallbackCue, locked = false, onBack, review = false, active, sendResult, receivedId, talkChoices, onCommand, onSpokenAmount, turnKey, pages }: Props) {
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

  const [replyHeight, setReplyHeight] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const [speechHeight, setSpeechHeight] = useState(0);
  const roomScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const sceneScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const unresolved = sendResult?.phase === "pending" || sendResult?.phase === "unknown";
  const expected = sendResult?.phase === "succeeded" ? `paid:${sendResult.operationId}` : sendResult?.phase === "failed" ? `failed:${sendResult.operationId}` : sendResult?.phase === "unknown" ? `unknown:${sendResult.operationId}` : undefined;
  const success = current.action === "celebrate" || current.action === "catch";
  const foreignResult = !!sendResult && current.priority === CuePriority.paymentResult && current.eventId !== expected && sendResult.phase !== "submitting";
  const unsafe = (unresolved && (success || current.action === "sending")) || (success && scene === "send" && (sendResult?.phase !== "succeeded" || current.eventId !== expected)) || (success && scene === "receive" && current.eventId !== `recv:${receivedId}`);
  const foreignScene = /^avatar\.screen\./.test(current.lineKey ?? "") && current.lineKey !== `avatar.screen.${scene}`;
  const cue = unsafe || foreignResult || foreignScene ? fallbackCue ?? IDLE_CUE : fallbackCue && current.priority < fallbackCue.priority ? fallbackCue : current;
  const paymentResult = cue.priority >= CuePriority.paymentResult && (cue.action === "catch" || cue.action === "celebrate" || cue.lineKey === "avatar.unknown");
  const protectedStep = review || locked;
  const conversation = useConversation(!!active, protectedStep, reduceMotion);
  const talk = useNoaTalk({ active: !!active, sensitive: protectedStep, turnKey: turnKey ?? `${scene}:${review}:${locked}`,
    choices: talkChoices ?? choices, say: conversation.say, cancel: conversation.cancel, onCommand, onAmount: onSpokenAmount, pages });
  const talkCue = !paymentResult && cue.priority < CuePriority.safety ? talk.cue : undefined;
  // The independent panel stays readable throughout presentation and listening.
  const presentation = boardCue && !paymentResult ? boardCue : talkCue && !protectedStep ? talkCue : cue;
  const spokenLine = protectedStep && talk.cue?.lineKey === "talk.send.review" ? t("talk.send.review") : talkCue?.lineKey ? t(talkCue.lineKey) : boardCue && cue.lineKey && cue.priority > CuePriority.menu ? t(cue.lineKey, cue.lineParams) : line;
  const listening = talk.listening || !!conversation.turn?.listening;
  const playerTurn = talk.listening ? { id: -1, text: talk.partial || t("talk.mic.listening"), listening: true } : conversation.turn;
  const dialogueState = useDialogue(spokenLine, reduceMotion, protectedStep || talk.listening, !!active && !listening);
  // Only the figure is pressable; reading takes priority over mic/reaction taps.
  // Undefined preserves StageAvatar's AVATAR_TAPPED fallback on both layouts.
  const onAvatarPress = dialogueState.typing ? dialogueState.complete : onStagePress ?? (talk.voiceInput ? talk.toggleMic : undefined);
  // Lip-flap uses the idle clip; keep it from replacing a requested wave.
  const speaking = dialogueState.typing && !listening && (talkCue ?? presentation).action !== "wave";
  // A scene greeting must not
  // start a 5s one-shot (and an extra decoder) before the first typed line.
  const homeRest = useMemo(() => scene === "home" && presentation.priority <= CuePriority.scene
    ? { ...presentation, action: "idle" as const } : presentation, [scene, presentation]);
  const visual = useLivingAvatar(homeRest, reduceMotion || !active, dialogueState.typing || protectedStep || !!board || listening);
  const close = !!board && !!boardCue;
  const roomWidth = Math.min(width, 620);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const compact = windowHeight < 740 || fontScale > 1.2;
  // Measure the entire natural footer (including wrapped replies) before giving
  // the remaining room to Noa. Hero minima must not displace input actions.
  const homeHero = scene === "home" && !keyboard && !compact;
  const compactSpeech = compact || keyboard || close || review || homeHero;
  // Home reuses the bubble's transparent tail margin beside the head. Keep the
  // face below the filled bubble, and put its tail beside (not over) her hair.
  const speechOverlap = homeHero ? 8 : 0;
  const minHero = close ? 0 : keyboard ? 48 : homeHero ? 456 : 160;
  const speechLimit = keyboard ? 48 : close ? 68 : review ? Math.min(140, available * 0.22) : Math.max(68, Math.min(120, available - replyHeight - minHero - 24));
  const portraitHeight = Math.max(minHero, available - speechHeight + speechOverlap - Math.max(64, replyHeight));
  const boardHeight = Math.max(0, available - speechHeight - replyHeight);
  // Keep the echo slot in the figure's allocation, independent of whether a
  // chip, typed message or voice partial is currently being echoed.
  const echoSlot = stageEchoLayout(roomWidth, close ? boardHeight : portraitHeight, close);
  const drift = useAvatarDrift(reduceMotion || !active, dialogueState.typing && choices.length > 0 && !protectedStep);
  const body = close ? hologramLayout(roomWidth, echoSlot.figureHeight).body : fullBodyLayout(review ? roomWidth : echoSlot.figureWidth, review ? (compact ? 120 : 160) : echoSlot.figureHeight, windowHeight);
  const headX = useDerivedValue(() => body.left + body.bodyWidth / 2 + drift.wander.get() * body.travel + (close ? 0 : body.bodyHeight * 0.4 * Math.sin(drift.tilt.get() * Math.PI / 180)));
  const bubbleWidth = roomWidth - (compactSpeech ? 32 : 64);
  const bubbleLeft = useDerivedValue(() => Math.max(16, Math.min(roomWidth - bubbleWidth - 16, headX.get() - bubbleWidth / 2)));
  const tailX = useDerivedValue(() => Math.max(16, Math.min(bubbleWidth - 24, headX.get() + (homeHero ? body.bodyWidth * 0.30 : 0) - bubbleLeft.get() - 12)));
  const bubbleMotion = useAnimatedStyle(() => ({ transform: [{ translateX: bubbleLeft.get() }] }));
  const revealEditor = () => { if (keyboard) { if (scene === "home") sceneScroll.current?.scrollToEnd({ animated: false }); else sceneScroll.current?.scrollTo({ y: 0, animated: false }); } };
  useEffect(() => {
    if (!active) return;
    setKeyboard(Keyboard.isVisible());
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, [active]);
  useEffect(() => { if (!keyboard) sceneScroll.current?.scrollTo({ y: 0, animated: false }); }, [keyboard]);
  useEffect(() => { roomScroll.current?.scrollTo({ y: 0, animated: false }); }, [close]);
  useEffect(() => { roomScroll.current?.scrollTo({ y: 0, animated: false }); }, [line]);
  const balanceText = balanceHidden ? "••••••" : view.balance ? formatAmount(view.balance.spendableSats, unit) : t("home.balanceUnknown");
  const balanceLabel = `${t("home.spendable")}: ${balanceText}. ${t(balanceHidden ? "home.show" : "home.hide")}`;
  const balancePill = <Pressable onPress={() => { update({ balanceHidden: !balanceHidden }); userAction(balanceHidden ? "balance-shown" : "balance-hidden"); }} accessibilityRole="button" accessibilityLabel={balanceLabel} style={({ pressed }) => [styles.balance, fontScale > 1.5 && { flex: 0 }, pressed && { opacity: 0.75 }]}>
    {fontScale <= 1.2 ? <BitcoinIcon name={balanceHidden ? "hidden" : "visible"} size={18} /> : null}
    <Text style={[styles.balanceText, fontScale > 1.2 && { fontSize: 13 }]}>{balanceText}</Text>
  </Pressable>;
  const speech = <Animated.View style={[styles.speechSlot, { width: bubbleWidth, marginLeft: (width - roomWidth) / 2, marginBottom: -speechOverlap }, bubbleMotion]} onLayout={(e) => setSpeechHeight(e.nativeEvent.layout.height)}>
    <SpeechBubble tailX={tailX} compact={compactSpeech} naturalHeight={false} maxHeight={speechLimit} dialogue={dialogueState} onAdvance={onLinePress} subdued={listening}>{speechFacts}</SpeechBubble>
  </Animated.View>;
  const replies = <>
    {caption}
    {!review && children ? <View style={styles.answers}>{children}</View> : null}
    <StageChoices choices={choices} deliberate={protectedStep} accessory={<>{choiceAccessory}{scene !== "home" && !protectedStep ? <MicButton onPress={talk.toggleMic} listening={talk.listening} enabled={talk.voiceInput} /> : null}</>} />
    {typeof afterChoices === "function" ? afterChoices(keyboard) : afterChoices}
  </>;
  const echo = !protectedStep ? <StageEcho slot={echoSlot} turn={playerTurn} listening={talk.listening} gesture={talk.gesture} /> : null;
  return <>
    <SceneBackground state={ambientState(view)} active={active} avatarX={headX} stageWidth={roomWidth} />
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <SafeAreaView style={styles.safe} edges={keyboard ? ["top"] : ["top", "bottom"]}>
      <ModeBanner />
      <View style={styles.hud}>
        <View style={styles.hudTop}>
        {scene !== "home" ? <Pressable onPress={onBack ?? finishStage} disabled={locked} accessibilityRole="button" accessibilityLabel={t("common.back")} accessibilityState={{ disabled: locked }} style={[styles.icon, locked && { opacity: 0.3 }]}><BitcoinIcon name="caret-left" size={20} /></Pressable> : null}
        <NetworkTag />
        {fontScale <= 1.5 ? balancePill : <View style={{ flex: 1 }} />}
        <SyncStatus compact disabled={locked} showCompanion={false} />
        {headerActions && !keyboard ? headerActions : null}
        <Pressable onPress={() => router.push("/settings")} disabled={locked} accessibilityRole="button" accessibilityLabel={t("settings.title")} accessibilityState={{ disabled: locked }} style={[styles.icon, locked && { opacity: 0.3 }]}><BitcoinIcon name="gear" size={20} /></Pressable>
        </View>
        {fontScale > 1.5 ? balancePill : null}
        <HandsIndicator />
      </View>
      {IS_MAINNET ? <Text style={styles.mainnet} accessibilityRole="alert">{t("net.mainnetLong")}</Text> : null}
        <ConversationContext.Provider value={{ ...conversation, mic: protectedStep ? undefined : { onPress: talk.toggleMic, listening: talk.listening, enabled: talk.voiceInput } }}>
        <View style={styles.safe} onLayout={(e) => setAvailable(e.nativeEvent.layout.height)}>
          {close ? <>
            {speech}
            <View style={{ height: boardHeight, alignItems: "center", flexShrink: 0 }}>
              <View style={{ width: roomWidth, height: boardHeight }}>
                {active && board ? <StageBoard cue={visual} onPress={onAvatarPress} width={roomWidth} height={echoSlot.figureHeight} reduceMotion={reduceMotion} speaking={speaking} board={board} drift={drift} /> : null}
                {echo}
              </View>
            </View>
            <ScrollView style={styles.safe} automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled">
              <View style={[styles.replyArea, styles.compactReplies]} onLayout={(e) => setReplyHeight(e.nativeEvent.layout.height)}>{replies}</View>
            </ScrollView>
          </> : review ? <>
            {speech}
            <View style={{ height: compact ? 120 : 160, alignItems: "center", overflow: "hidden" }}>
              {active ? <StageAvatar cue={visual} width={roomWidth} height={compact ? 120 : 160} reduceMotion={reduceMotion} speaking={false} disabled drift={drift} /> : null}
            </View>
            <ScrollView ref={roomScroll} style={styles.safe} contentContainerStyle={styles.reviewBody} keyboardShouldPersistTaps="handled">
              <Animated.View style={[styles.receipt, panelStyle]}>{children}</Animated.View>
            </ScrollView>
            <View style={[styles.replyArea, compact && styles.compactReplies]}>{replies}</View>
          </> : <>
            {speech}
            <View style={[styles.hero, { flex: 0, height: portraitHeight }]} onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}>
              <View style={{ width: roomWidth, height: portraitHeight }}>
                {active && heroHeight > 0 ?
                  <StageAvatar cue={visual} width={roomWidth} height={echoSlot.figureHeight} layout={body} reduceMotion={reduceMotion} speaking={speaking} disabled={protectedStep} drift={drift} onPress={onAvatarPress} /> : null}
                {echo}
              </View>
            </View>
            <ScrollView ref={sceneScroll} style={styles.safe}
              automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
              onLayout={revealEditor}>
              <View style={[styles.replyArea, (compact || homeHero) && styles.compactReplies, keyboard && styles.keyboardReplies]}
                onLayout={(e) => { setReplyHeight(e.nativeEvent.layout.height); revealEditor(); }}>{replies}</View>
            </ScrollView>
          </>}

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
  compactReplies: { paddingBottom: 8, gap: 4 },
  speechSlot: { width: `${theme.presence.bubbleWidth * 100}%`, paddingTop: theme.spacing.sm, zIndex: 2, flexShrink: 0 },
  replyArea: { paddingHorizontal: theme.presence.edge, paddingBottom: theme.spacing.sm, gap: theme.presence.gap, zIndex: 3, flexShrink: 0 },
  keyboardReplies: { paddingBottom: 8, gap: 4 },
  answers: { gap: theme.presence.gap, flexShrink: 0 },
  receipt: { backgroundColor: c.panelSolid, padding: theme.spacing.md, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: c.controlBorder, gap: theme.spacing.md },
  choices: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: theme.presence.gap },
  choice: { maxWidth: "100%", flexShrink: 1 },
});
