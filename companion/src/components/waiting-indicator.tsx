import { useEffect } from "react";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/game/useAvatarCue";
import { theme } from "@/theme";

/** Waiting, never a confirmation: a quiet lavender pulse with an adjacent text status. */
export function WaitingIndicator() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(1);
    if (!reduceMotion) opacity.set(withRepeat(withSequence(
      withTiming(0.35, { duration: 900, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
      withTiming(1, { duration: 900, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
    ), -1));
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View accessible={false} style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }, style]} />;
}
