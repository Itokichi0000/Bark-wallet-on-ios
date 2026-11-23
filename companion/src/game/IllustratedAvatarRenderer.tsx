import { useEffect } from "react";
import { type ImageSourcePropType, StyleSheet } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import type { AvatarCue } from "@/domain/avatar";
import { theme } from "@/theme";
import { AVATAR_ASPECT, type AvatarRendererProps } from "./AvatarRenderer";

/**
 * Full-body illustrations of the companion, one per expression plus two poses.
 * Generated artwork of an original character (docs/ANIMATION_ASSET_SPEC.md).
 * All share one canvas (752 x 1344) with the feet in the same place, so
 * swapping them reads as a change of expression rather than a jump.
 */
export const AVATAR_FRAMES = {
  neutral: require("../../assets/avatar/neutral.png") as ImageSourcePropType,
  happy: require("../../assets/avatar/happy.png") as ImageSourcePropType,
  curious: require("../../assets/avatar/curious.png") as ImageSourcePropType,
  focused: require("../../assets/avatar/focused.png") as ImageSourcePropType,
  concerned: require("../../assets/avatar/concerned.png") as ImageSourcePropType,
  surprised: require("../../assets/avatar/surprised.png") as ImageSourcePropType,
  sleepy: require("../../assets/avatar/sleepy.png") as ImageSourcePropType,
  celebrate: require("../../assets/avatar/celebrate.png") as ImageSourcePropType,
  wave: require("../../assets/avatar/wave.png") as ImageSourcePropType,
} as const;

export type AvatarFrame = keyof typeof AVATAR_FRAMES;
const FRAME_NAMES = Object.keys(AVATAR_FRAMES) as AvatarFrame[];

/** Which picture a cue shows. A pose wins over an expression; everything else is the expression alone. */
export function frameForCue(cue: Pick<AvatarCue, "emotion" | "action">): AvatarFrame {
  if (cue.action === "celebrate") return "celebrate";
  if (cue.action === "wave") return "wave";
  if (cue.action === "rest") return "sleepy";
  if (cue.action === "warn") return "concerned";
  if (cue.emotion === "thinking") return "curious";
  return cue.emotion;
}

function Frame({ source, visible, reduceMotion }: { source: ImageSourcePropType; visible: boolean; reduceMotion: boolean }) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.value = reduceMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: 160 });
  }, [visible, reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.Image source={source} resizeMode="contain" style={[StyleSheet.absoluteFill, styles.image, style]} fadeDuration={0} />;
}

export function IllustratedAvatarRenderer({ cue, height, reduceMotion }: AvatarRendererProps) {
  const width = height * AVATAR_ASPECT;
  const frame = frameForCue(cue);
  const float = useSharedValue(0);
  const jump = useSharedValue(0);

  // Gentle breathing float; off entirely under reduce-motion.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(float);
      float.value = 0;
      return;
    }
    float.value = withRepeat(withTiming(1, { duration: theme.motion.idleCycleMs / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(float);
  }, [reduceMotion, float]);

  // One small hop when a confirmed success arrives.
  useEffect(() => {
    if (cue.action !== "celebrate" || reduceMotion) return;
    jump.value = withSequence(withTiming(-18, { duration: 160 }), withTiming(0, { duration: 220 }), withTiming(-9, { duration: 130 }), withTiming(0, { duration: 180 }));
  }, [cue.id, cue.action, reduceMotion, jump]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: float.value * -6 + jump.value }] }));

  return (
    <Animated.View style={[{ width, height }, style]} accessible accessibilityRole="image" accessibilityLabel="Companion">
      {FRAME_NAMES.map((name) => (
        <Frame key={name} source={AVATAR_FRAMES[name]} visible={name === frame} reduceMotion={reduceMotion} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
});
