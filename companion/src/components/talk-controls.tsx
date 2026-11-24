import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useTalk } from "@/conversation/talkStore";
import { useReduceMotion } from "@/game/useAvatarCue";
import { useT } from "@/i18n";
import { theme } from "@/theme";
import { BitcoinIcon } from "./BitcoinIcon";

const c = theme.colors;

export function MicButton({ onPress, listening, enabled }: { onPress(): void; listening: boolean; enabled: boolean }) {
  const t = useT();
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={t(listening ? "talk.mic.stop" : enabled ? "talk.mic.start" : "talk.mic.enable")}
    accessibilityState={{ selected: listening }} style={[styles.mic, listening && styles.micOn]}>
    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
      <Rect x={9} y={2} width={6} height={12} rx={3} fill="none" stroke={c.text} strokeWidth={1.7} />
      <Path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" fill="none" stroke={c.text} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  </Pressable>;
}

/** In-flow at the owner's side; it never covers replies or the held QR. */
export function ListeningFeedback({ listening, gesture }: { listening: boolean; gesture?: string }) {
  const t = useT();
  const reduceMotion = useReduceMotion();
  const wasListening = useRef(false);
  useEffect(() => {
    if (listening) AccessibilityInfo.announceForAccessibility(t("talk.mic.listening"));
    else if (wasListening.current) AccessibilityInfo.announceForAccessibility(t("talk.mic.ready"));
    wasListening.current = listening;
  }, [listening, t]);
  if (!listening && !gesture) return null;
  return <View style={styles.feedback}>
    {gesture ? <Text accessibilityLabel={t("talk.gesture.seen")} style={styles.gesture}>{gesture}</Text> : null}
    {listening ? <View style={styles.listening} accessibilityLiveRegion="polite" accessible accessibilityLabel={t("talk.mic.listening")}>
      <Animated.View accessible={false} style={[styles.ring, !reduceMotion && {
        animationName: { "0%, 100%": { opacity: 0.45, transform: [{ scale: 0.9 }] }, "50%": { opacity: 1, transform: [{ scale: 1 }] } },
        animationDuration: "1800ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out",
      }]} />
      <Text style={styles.label}>{t("talk.mic.listening")}</Text>
    </View> : null}
  </View>;
}

export function HandsIndicator() {
  const watching = useTalk((s) => s.eyes === "watching");
  const t = useT();
  if (!watching) return null;
  return <View style={styles.hands} accessible accessibilityLabel={t("talk.hands.watching")}>
    <BitcoinIcon name="visible" size={14} />
    <Text style={styles.label}>{t("talk.hands.watching")}</Text>
  </View>;
}

const styles = StyleSheet.create({
  mic: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.controlBorder, borderRadius: theme.radius.pill },
  micOn: { borderColor: c.primary, backgroundColor: c.panel },
  feedback: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  listening: { flexDirection: "row", alignItems: "center", gap: 8 },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.primary },
  label: { color: c.textMuted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  gesture: { fontSize: 20, paddingHorizontal: 6 },
  hands: { alignSelf: "flex-end", flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, backgroundColor: c.panel },
});
