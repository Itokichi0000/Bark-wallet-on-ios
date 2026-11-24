import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { conversation } from "@/container";
import { gestureAction } from "@/conversation/gesturePolicy";
import { useTalk } from "@/conversation/talkStore";
import { matchSpokenChoice, spokenAmountSats, type SpokenChoice } from "@/conversation/utterance";
import { CuePriority, type AvatarCue } from "@/domain/avatar";
import { useSettings } from "@/state/settingsStore";
import { useConversationIssue } from "./conversation-runtime";

export type TalkChoice = SpokenChoice & { onPress(): void; disabled?: boolean; busy?: boolean };
type Options = {
  active: boolean; sensitive: boolean; blocked?: boolean; turnKey: string;
  choices: readonly TalkChoice[];
  say(text: string, action: () => void): void;
  cancel(): void;
  onCommand?(text: string): void;
  onAmount?(sats: string): void;
  pages?: { next: string; previous: string };
};
const gestureSymbols = { wave: "👋", palm: "✋", thumbsUp: "👍", swipeLeft: "←", swipeRight: "→" };

/** Only the focused screen subscribes. Native events reuse visible replies;
 * the service's policies remain the authority on what can be chosen. */
export function useNoaTalk(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const { ears, partial } = useTalk();
  const voiceInput = useSettings((s) => s.voiceInput);
  const issue = useConversationIssue();
  const [response, setResponse] = useState<{ id: number; lineKey: string; wave?: boolean }>();
  const [gesture, setGesture] = useState<{ id: number; symbol: string }>();
  const seq = useRef(0);
  const starting = useRef(false);
  const focused = useRef(false);
  const scope = useRef(0);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; scope.current++; conversation.cancelListening(); };
  }, []));
  const listening = options.active && !options.blocked && (ears === "listening" || ears === "hearing");
  const canAct = () => focused.current && latest.current.active && !latest.current.blocked && AppState.currentState === "active";
  const respond = useCallback((lineKey: string, wave = false) => setResponse({ id: ++seq.current, lineKey, wave }), []);
  const toggleMic = useCallback(() => {
    if (!canAct()) return;
    if (latest.current.sensitive) { respond("talk.send.review"); return; }
    if (!useSettings.getState().voiceInput) { respond("talk.mic.enable"); return; }
    const state = useTalk.getState().ears;
    if (state === "listening" || state === "hearing") { conversation.stopListening(); return; }
    if (starting.current) return;
    starting.current = true;
    latest.current.cancel();
    setResponse(undefined);
    void Speech.stop();
    const turnKey = latest.current.turnKey;
    const session = scope.current;
    void conversation.listen().then((ok) => {
      if (!canAct() || latest.current.sensitive || latest.current.turnKey !== turnKey || session !== scope.current) conversation.cancelListening();
      else if (!ok && useSettings.getState().voiceInput) respond("talk.mic.unavailable");
    }).catch(() => {
      conversation.cancelListening();
      useSettings.getState().update({ voiceInput: false });
      if (canAct()) respond("talk.mic.unavailable");
    }).finally(() => { starting.current = false; });
  }, [respond]);

  useEffect(() => {
    if (!options.active || options.blocked) return;
    const choose = (id: string, echo?: string) => {
      const ctx = latest.current;
      const choice = ctx.choices.find((c) => c.id === id);
      if (!choice || choice.disabled || choice.busy || ctx.sensitive) return;
      setResponse(undefined);
      const session = scope.current;
      ctx.say(echo ?? choice.label, () => {
        // A quote, scan, navigation or new page may have arrived during the echo beat.
        const now = latest.current;
        if (!canAct() || now.sensitive || now.turnKey !== ctx.turnKey || scope.current !== session) return;
        const current = now.choices.find((c) => c.id === id);
        if (current && !current.disabled && !current.busy) current.onPress();
      });
    };
    const offWords = conversation.onUtterance((text) => {
      if (!canAct() || !useSettings.getState().voiceInput) return;
      const ctx = latest.current;
      if (ctx.sensitive) { respond("talk.send.review"); return; }
      setResponse(undefined);
      const session = scope.current;
      if (ctx.onCommand) {
        ctx.say(text, () => {
          if (canAct() && !latest.current.sensitive && latest.current.turnKey === ctx.turnKey && scope.current === session) latest.current.onCommand?.(text);
        });
        return;
      }
      const amount = ctx.onAmount ? spokenAmountSats(text) : undefined;
      if (amount !== undefined) {
        ctx.say(text, () => {
          if (canAct() && !latest.current.sensitive && latest.current.turnKey === ctx.turnKey && scope.current === session) {
            latest.current.onAmount?.(amount);
            respond("talk.amount.heard");
          }
        });
        return;
      }
      const id = matchSpokenChoice(text, ctx.choices.filter((c) => !c.disabled && !c.busy));
      if (id) { choose(id, text); return; }
      ctx.say(text, () => {
        if (!canAct() || latest.current.sensitive || latest.current.turnKey !== ctx.turnKey || scope.current !== session) return;
        respond("voice.unknown");
      });
    });
    const offHands = conversation.onGesture((hand) => {
      if (!canAct() || !useSettings.getState().handGestures) return;
      const ctx = latest.current;
      // Keep the suggested reply first even when disabled; choose() then ignores
      // it. Removing it would silently make a different reply the suggestion.
      const action = gestureAction(hand, { choices: ctx.choices.map((c) => c.id), sensitive: ctx.sensitive, pages: !!ctx.pages });
      setGesture({ id: ++seq.current, symbol: gestureSymbols[hand] });
      // Even wave is only a reminder during review/auth/submission.
      if (ctx.sensitive) { respond("talk.send.review"); return; }
      switch (action.kind) {
        case "wave-back": respond("avatar.waveBack", true); break;
        case "listen": {
          const ears = useTalk.getState().ears;
          if (ears !== "listening" && ears !== "hearing") toggleMic();
          break;
        }
        case "choose": choose(action.choice); break;
        case "page": { const id = ctx.pages?.[action.direction]; if (id) choose(id); break; }
        case "none": break;
      }
    });
    return () => { offWords(); offHands(); scope.current++; conversation.cancelListening(); };
  }, [options.active, options.blocked, respond, toggleMic]);
  useEffect(() => {
    setResponse(undefined);
    setGesture(undefined);
    scope.current++;
    if (options.active) conversation.cancelListening();
  }, [options.turnKey, options.sensitive, options.active]);
  useEffect(() => {
    if (!response) return;
    const timer = setTimeout(() => setResponse(undefined), 5000);
    return () => clearTimeout(timer);
  }, [response]);
  useEffect(() => {
    if (!gesture) return;
    const timer = setTimeout(() => setGesture(undefined), 1400);
    return () => clearTimeout(timer);
  }, [gesture]);
  const feedback = options.active && !options.blocked ? options.sensitive ? response : issue ?? response : undefined;
  const cue = useMemo<AvatarCue | undefined>(() => listening && !options.sensitive ? {
    id: "conversation:listening", action: "listen", emotion: "curious", lineKey: "avatar.listening", priority: CuePriority.voice, interruptible: true, holdMs: 0,
  } : feedback ? {
    id: `conversation:${feedback.id}:${feedback.lineKey}`, action: "wave" in feedback && feedback.wave ? "wave" : "talk", emotion: "wave" in feedback && feedback.wave ? "happy" : "neutral",
    lineKey: feedback.lineKey, priority: CuePriority.voice, interruptible: true, holdMs: 5000,
  } : undefined, [listening, options.sensitive, feedback]);
  return { listening, partial, cue, voiceInput, toggleMic, gesture: gesture?.symbol };
}
