import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { AVATAR_ASPECT, type AvatarRendererProps } from "./AvatarRenderer";
import { AVATAR_FRAMES, frameForCue, IllustratedAvatarRenderer } from "./IllustratedAvatarRenderer";
import { CLIP_DURATION_MS, clipForCue, type AvatarClip } from "./avatarMotion";

const CLIPS = {
  idle: require("../../assets/avatar/motion/idle.webp") as number,
  wave: require("../../assets/avatar/motion/wave.webp") as number,
  celebrate: require("../../assets/avatar/motion/celebrate.webp") as number,
  focus: require("../../assets/avatar/motion/focus.webp") as number,
  worry: require("../../assets/avatar/motion/worry.webp") as number,
  guide: require("../../assets/avatar/motion/guide.webp") as number,
} satisfies Record<AvatarClip, number>;

const FADE_MS = 160;
const FADE = { duration: FADE_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) };

/** A keyed instance owns one playback; re-renders of the same cue cannot replay it. */
function OneShot({ clip, opacity }: { clip: Exclude<AvatarClip, "idle">; opacity: SharedValue<number> }) {
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    if (!ready) return;
    // Count from the first displayed frame, not from the start of local decoding.
    opacity.set(withSequence(
      withTiming(1, FADE),
      withDelay(CLIP_DURATION_MS - FADE_MS, withTiming(0, FADE)),
    ));
    const timer = setTimeout(() => setFinished(true), CLIP_DURATION_MS + FADE_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(opacity);
      opacity.set(0);
    };
  }, [ready, opacity]);

  if (finished) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={CLIPS[clip]}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        autoplay
        useAppleWebpCodec={false}
        accessible={false}
        onDisplay={() => setReady(true)}
      />
    </Animated.View>
  );
}

function MotionAvatar({ cue, height }: Omit<AvatarRendererProps, "reduceMotion">) {
  const clip = clipForCue(cue);
  const opacity = useSharedValue(0);
  const idleStyle = useAnimatedStyle(() => ({ opacity: clip === undefined ? 0 : 1 - opacity.get() }));

  return (
    <View style={{ width: height * AVATAR_ASPECT, height }} accessible accessibilityRole="image" accessibilityLabel="Companion">
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {/* Keep idle decoding and playing even while a still or one-shot covers it. */}
        <Animated.View style={[StyleSheet.absoluteFill, idleStyle]}>
          <Image source={CLIPS.idle} style={StyleSheet.absoluteFill} contentFit="contain" autoplay useAppleWebpCodec={false} accessible={false} />
        </Animated.View>
        {clip === undefined ? (
          // Every AVATAR_FRAMES entry is a local require (Metro asset ID).
          <Image source={AVATAR_FRAMES[frameForCue(cue)] as number} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
        ) : clip !== "idle" ? (
          <OneShot key={cue.id} clip={clip} opacity={opacity} />
        ) : null}
      </View>
    </View>
  );
}

export function AnimatedAvatarRenderer(props: AvatarRendererProps) {
  // Unmount the entire animated subtree so Reduce Motion never decodes a clip.
  if (props.reduceMotion) return <IllustratedAvatarRenderer {...props} />;
  return <MotionAvatar cue={props.cue} height={props.height} />;
}
