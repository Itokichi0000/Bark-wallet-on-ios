import { memo, useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { bus } from "@/container";
import type { AvatarCue } from "@/domain/avatar";
import { AnimatedAvatarRenderer } from "@/game/AnimatedAvatarRenderer";
import { useT } from "@/i18n";
import { fullBodyLayout, hologramLayout, type AvatarDrift, type FigureLayout } from "./avatar-drift";

export const StageAvatar = memo(function StageAvatar({ cue, width, height, reduceMotion, speaking, disabled = false, onPress, drift, layout, besidePanel = false }: {
  speaking: boolean; disabled?: boolean; cue: AvatarCue; width: number; height: number; reduceMotion: boolean; onPress?: () => void; drift: AvatarDrift;
  layout?: FigureLayout; besidePanel?: boolean;
}) {
  const t = useT();
  const { height: screenHeight } = useWindowDimensions();
  const { bodyHeight, bodyWidth, travel, top, left } = layout ?? fullBodyLayout(width, height, screenHeight);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: drift.wander.get() * travel }, { translateY: drift.bob.get() * (besidePanel ? 0.25 : 1) }, { scale: besidePanel ? 1 : drift.scale.get() }, { rotateZ: `${besidePanel ? 0 : drift.tilt.get()}deg` }] }));
  const ground = useAnimatedStyle(() => ({ transform: [{ translateX: drift.wander.get() * travel }, { scaleX: 1 - drift.bob.get() * (besidePanel ? 0.002 : 0.009) }] }));
  return <View style={{ width, height }}>
    <Animated.View pointerEvents="none" style={[styles.glow, { width: bodyWidth * 0.5, left: left + bodyWidth * 0.25, top: top + bodyHeight - 7 }, ground]} />
    <Animated.View style={[{ position: "absolute", top, left, width: bodyWidth, height: bodyHeight }, motion]}>
      <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t("home.avatar")} disabled={disabled}
        onPress={onPress ?? (() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") }))}>
        <AnimatedAvatarRenderer speaking={speaking} cue={cue} height={bodyHeight} reduceMotion={reduceMotion} floatingPanel={besidePanel} />
      </Pressable>
    </Animated.View>
  </View>;
});

/** Separate visible silhouettes, overlapping only transparent frame margins. */
export function StageBoard({ cue, onPress, width, height, reduceMotion, speaking, board, drift }: {
  cue: AvatarCue; width: number; height: number; reduceMotion: boolean; speaking: boolean; onPress?: () => void; drift: AvatarDrift;
  board: ReactNode | ((size: number) => ReactNode);
}) {
  const { contentSize, panelSize, panelLeft, body } = hologramLayout(width, height);
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    enter.set(reduceMotion ? 1 : 0);
    if (!reduceMotion) enter.set(withTiming(1, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    return () => cancelAnimation(enter);
  }, [reduceMotion, enter]);
  const materialise = useAnimatedStyle(() => ({ opacity: enter.get() }));
  const shimmer = useAnimatedStyle(() => ({ opacity: (1 - enter.get()) * 0.55, transform: [{ translateX: enter.get() * panelSize }] }));
  return <View style={{ width, height, overflow: "hidden" }}>
    <StageAvatar cue={cue} width={width} height={height} layout={body} besidePanel reduceMotion={reduceMotion} speaking={speaking} onPress={onPress} drift={drift} />
    <Animated.View style={[styles.panel, { position: "absolute", left: panelLeft, top: 0, width: panelSize, height: panelSize }, materialise]}>
      <View style={{ width: contentSize, height: contentSize, backgroundColor: "white" }}>{typeof board === "function" ? board(contentSize) : board}</View>
      <Animated.View pointerEvents="none" style={[styles.shimmer, shimmer]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  glow: { position: "absolute", height: 8, borderRadius: 999, backgroundColor: "rgba(97, 221, 236, 0.18)", boxShadow: "0 0 14px 5px rgba(163, 126, 255, 0.2)" },
  panel: { borderWidth: 2, borderColor: "#B5A0FF", borderRadius: 8, backgroundColor: "white", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(120, 220, 255, 0.2)", overflow: "hidden" },
  shimmer: { position: "absolute", left: -24, top: 0, bottom: 0, width: 24, backgroundColor: "#BAEEFF" },
});
