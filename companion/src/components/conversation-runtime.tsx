import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { conversation } from "@/container";
import { useTalk } from "@/conversation/talkStore";
import { useSettings } from "@/state/settingsStore";

type Issue = { id: number; lineKey: string };
const IssueContext = createContext<Issue | undefined>(undefined);
export const useConversationIssue = () => useContext(IssueContext);

export function useSettingsHydrated() {
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  useEffect(() => {
    const off = useSettings.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useSettings.persist.hasHydrated());
    return off;
  }, []);
  return hydrated;
}

/** UI feedback survives turning a failed feature off (which clears the camera state). */
export function ConversationRuntime({ children }: { children: ReactNode }) {
  const [issue, setIssue] = useState<Issue>();
  const hydrated = useSettingsHydrated();
  useEffect(() => useTalk.subscribe((next) => {
    const settings = useSettings.getState();
    const micFailed = settings.voiceInput && (next.ears === "denied" || next.ears === "unavailable");
    const handsFailed = settings.handGestures && (next.eyes === "denied" || next.eyes === "unavailable");
    if (!micFailed && !handsFailed) return;
    setIssue((old) => ({ id: (old?.id ?? 0) + 1, lineKey: `talk.${micFailed ? "mic" : "hands"}.${micFailed ? next.ears : next.eyes}` }));
    useSettings.getState().update({ ...(micFailed ? { voiceInput: false } : {}), ...(handsFailed ? { handGestures: false } : {}) });
    if (micFailed) conversation.cancelListening();
    if (handsFailed) void conversation.syncEyes(AppState.currentState === "active");
  }), []);
  useEffect(() => useSettings.subscribe((next, prev) => {
    const retryVoice = next.voiceInput && !prev.voiceInput;
    const retryHands = next.handGestures && !prev.handGestures;
    if (retryVoice || retryHands) {
      setIssue(undefined);
      // A new opt-in starts with no active sensor. Clear the previous attempt's
      // failure so an unrelated gesture/partial update cannot disable the retry.
      const talk = useTalk.getState();
      useTalk.setState({
        ...(retryVoice && (talk.ears === "denied" || talk.ears === "unavailable") ? { ears: "off" as const } : {}),
        ...(retryHands && (talk.eyes === "denied" || talk.eyes === "unavailable") ? { eyes: "off" as const } : {}),
      });
    }
    if (!next.voiceInput && prev.voiceInput) conversation.cancelListening();
  }), []);
  useEffect(() => {
    if (hydrated) void conversation.syncEyes(AppState.currentState === "active");
  }, [hydrated]);
  useEffect(() => {
    if (!issue) return;
    const timer = setTimeout(() => setIssue(undefined), 9000);
    return () => clearTimeout(timer);
  }, [issue]);
  return <IssueContext.Provider value={issue}>{children}</IssueContext.Provider>;
}

// Focus callbacks can overlap during transitions. One screen's blur must not
// unblock another screen that is already displaying secrets.
const blockers = new Set<symbol>();
export function useConversationBlocked(blocked = true) {
  useFocusEffect(useCallback(() => {
    if (!blocked) return;
    const token = Symbol("private-screen");
    blockers.add(token);
    conversation.setBlocked(true);
    return () => { blockers.delete(token); conversation.setBlocked(blockers.size > 0); };
  }, [blocked]));
}
