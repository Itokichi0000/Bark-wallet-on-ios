import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from "react-native-svg";
import { theme } from "@/theme";

export type NetworkAmbientState = "online" | "syncing" | "degraded" | "offline" | "maintenanceRequired";

/** Small deterministic PRNG so the star field is the same on every render. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The room's "weather". It is decoration only: every state it shows is also
 * written out in the status strip, and it never tries to alarm.
 */
export function SceneBackground({ state }: { state: NetworkAmbientState }) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => {
    const r = mulberry(7);
    return Array.from({ length: 46 }, () => ({ x: r() * width, y: r() * height, s: 0.5 + r() * 1.4, o: 0.25 + r() * 0.6 }));
  }, [width, height]);
  const starOpacity = state === "online" ? 1 : state === "syncing" ? 0.8 : state === "maintenanceRequired" ? 0.55 : 0.3;
  const tint = state === "maintenanceRequired" ? theme.colors.warning : theme.colors.primaryStrong;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="room" cx="50%" cy="46%" r="70%">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.22} />
            <Stop offset="55%" stopColor={theme.colors.backgroundRaised} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={theme.colors.background} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={theme.colors.background} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#room)" />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.s} fill={theme.colors.text} opacity={s.o * starOpacity} />
        ))}
        {state === "offline" &&
          Array.from({ length: 14 }, (_, i) => (
            <Line key={i} x1={0} y1={(height / 14) * i + 9} x2={width} y2={(height / 14) * i + 9} stroke={theme.colors.textMuted} strokeWidth={1} opacity={0.08} />
          ))}
        {state === "degraded" && <Rect x={0} y={0} width={width} height={height} fill={theme.colors.textMuted} opacity={0.06} />}
      </Svg>
    </View>
  );
}
