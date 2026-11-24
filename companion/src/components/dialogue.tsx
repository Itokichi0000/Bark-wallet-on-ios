import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, Text, View, type StyleProp, type TextStyle } from "react-native";
import { theme } from "@/theme";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/state/settingsStore";
import { noaVoice } from "@/voice/NoaVoice";

/** One clock drives both the visible letters and the mouth. No duration guess or audio. */
export function useDialogue(line: string, reduceMotion: boolean, immediate = false, active = true) {
  const lastAnnouncement = useRef<string | undefined>(undefined);
  const lastTick = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || lastTick.current === line) return;
    lastTick.current = line;
    const s = useSettings.getState();
    if (s.hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    // Her recorded voice: only lines recorded in advance can sound, so nothing typed or secret is ever spoken.
    if (s.language === "ja") noaVoice.say(s.noaVoice, line);
    else noaVoice.stop();
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
      {/* One text layout owns both visible and unrevealed glyphs. An absolute
          overlay could wrap differently and paint over the following footnotes. */}
      <Text style={style}>{dialogue.visible}<Text style={{ color: "transparent" }}>{dialogue.line.slice(dialogue.visible.length)}</Text></Text>
    </View>

  </Pressable>;
}
