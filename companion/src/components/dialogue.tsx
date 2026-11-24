import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { theme } from "@/theme";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/state/settingsStore";

/** One clock drives both the visible letters and the mouth. No duration guess or audio. */
export function useDialogue(line: string, reduceMotion: boolean, immediate = false, active = true) {
  const lastAnnouncement = useRef<string | undefined>(undefined);
  const lastTick = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || lastTick.current === line) return;
    lastTick.current = line;
    if (useSettings.getState().hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [line, active]);
  const [reader, setReader] = useState<boolean>();
  const [frame, setFrame] = useState({ line, count: 0, skipped: false });
  const letters = Array.from(line);
  const instant = !active || reduceMotion || reader === true || immediate;
  const count = frame.line === line ? frame.count : 0;
  const skipped = frame.line === line && frame.skipped;
  const typing = !instant && !skipped && count < letters.length;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (alive) setReader(enabled); }, () => { if (alive) setReader(false); });
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setReader);
    return () => { alive = false; sub.remove(); };
  }, []);
  useEffect(() => {
    if (skipped) return;
    setFrame({ line, count: 0, skipped: false });
    if (instant) return;
    let timer: ReturnType<typeof setTimeout>;
    // Deadlines, not a chain of per-letter delays: a busy JS frame must not
    // turn a 180ms punctuation beat into seconds of accumulated drift.
    const started = Date.now();
    let due = 45;
    let n = 0;
    const tick = () => {
      const elapsed = Date.now() - started;
      while (n < letters.length && elapsed >= due) {
        n++;
        due += /[。、！？…,.!?]/u.test(letters[n - 1] ?? "") ? 180 : 45;
      }
      setFrame({ line, count: n, skipped: false });
      if (n < letters.length) timer = setTimeout(tick, Math.max(1, due - elapsed));
    };
    timer = setTimeout(tick, 45);
    return () => clearTimeout(timer);
  }, [line, instant, skipped]);
  useEffect(() => {
    // Android uses the stable live-region label; iOS needs an explicit full-line announcement.
    if (active && reader && Platform.OS === "ios" && lastAnnouncement.current !== line) {
      lastAnnouncement.current = line;
      AccessibilityInfo.announceForAccessibility(line);
    }
  }, [reader, line, active]);
  return { line, visible: instant || skipped ? line : letters.slice(0, count).join(""), typing,
    immediate: instant || skipped, reduceMotion, complete: () => setFrame({ line, count: letters.length, skipped: true }) };
}
export type DialogueState = ReturnType<typeof useDialogue>;
export function DialogueLine({ dialogue, style, onAdvance, hint }: { dialogue: DialogueState; style?: StyleProp<TextStyle>; onAdvance?: () => void; hint?: string }) {
  return <Pressable accessible accessibilityRole="button" accessibilityLabel={dialogue.line} accessibilityHint={hint}
    accessibilityLiveRegion="polite" onPress={dialogue.typing ? dialogue.complete : onAdvance ?? dialogue.complete}
    style={{ minHeight: theme.presence.touch, justifyContent: "center" }}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The full line determines layout from the first frame; only the overlay changes. */}
      <Text style={[style, { opacity: 0 }]}>{dialogue.line}</Text>
      <Text style={[style, StyleSheet.absoluteFill]}>{dialogue.visible}</Text>
    </View>

  </Pressable>;
}

