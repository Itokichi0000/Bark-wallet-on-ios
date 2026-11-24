import { memo, useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { theme } from "@/theme";
import { useReduceMotion } from "./useAvatarCue";

export type NetworkAmbientState = "online" | "syncing" | "degraded" | "offline" | "maintenanceRequired";
const c = theme.colors;
const p = theme.presence;

/** Static lighting plus one cheap drifting particle layer behind the character. */
export const SceneBackground = memo(function SceneBackground({ state, active = true, avatarX, stageWidth = 0 }: { state: NetworkAmbientState; active?: boolean; avatarX?: SharedValue<number>; stageWidth?: number }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.set(0);
    if (!reduceMotion && active) drift.set(withRepeat(withSequence(withTiming(1, { duration: p.ambientMs, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: p.ambientMs, easing: Easing.inOut(Easing.sin) })), -1));
    return () => cancelAnimation(drift);
  }, [reduceMotion, active, drift]);
  const motion = useAnimatedStyle(() => ({ opacity: 0.3 + drift.get() * 0.18, transform: [{ translateX: avatarX ? -(avatarX.get() - stageWidth / 2) * 0.04 : 0 }, { translateY: -drift.get() * p.rise }] }));
  const stars = useMemo(() => Array.from({ length: 24 }, (_, n) => ({ x: ((n * 73 + 19) % 101) / 101 * width, y: ((n * 47 + 13) % 103) / 103 * height, r: n % 3 === 0 ? 1.5 : 0.8 })), [width, height]);
  const tint = state === "maintenanceRequired" ? c.warning : c.primary;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="room" cx="50%" cy="42%" rx="58%" ry="48%"><Stop offset="0" stopColor={tint} stopOpacity={0.22} /><Stop offset="1" stopColor={c.background} stopOpacity={0} /></RadialGradient>
        <RadialGradient id="rim"><Stop offset="0" stopColor={tint} stopOpacity={0.24} /><Stop offset="1" stopColor={tint} stopOpacity={0} /></RadialGradient>
        <RadialGradient id="vignette" cx="50%" cy="42%" r="75%"><Stop offset="0.3" stopColor={c.background} stopOpacity={0} /><Stop offset="1" stopColor={c.background} stopOpacity={0.9} /></RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={c.background} />
      <Rect width={width} height={height} fill="url(#room)" />
      <Ellipse cx={width * 0.5} cy={height * 0.46} rx={width * 0.4} ry={height * 0.36} fill="url(#rim)" />
      <Ellipse cx={width * 0.5} cy={height * 0.86} rx={width * 0.44} ry={height * 0.07} fill="url(#rim)" />
      <Rect width={width} height={height} fill="url(#vignette)" />
    </Svg>
    {!reduceMotion && active ? <Animated.View style={[StyleSheet.absoluteFill, motion]}><Svg width={width} height={height}>{stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={c.text} />)}</Svg></Animated.View> : null}
  </View>;
});
