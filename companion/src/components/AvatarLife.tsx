import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

/** Everything, including the board overlay, rides the same transform. */
export function AvatarLife({ children, height, width, reduceMotion, lineKey, pressed = false, amplitude = 3, shadow = true, close = false }: {
  children: ReactNode; height: number; width: number; reduceMotion: boolean; lineKey?: string; pressed?: boolean; amplitude?: number; shadow?: boolean; close?: boolean;
}) {
  const bob = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    bob.set(0);
    if (!reduceMotion) bob.set(withRepeat(withSequence(
      withTiming(1, { duration: 1600, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
      withTiming(-1, { duration: 1600, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
    ), -1));
    return () => cancelAnimation(bob);
  }, [reduceMotion, bob]);
  useEffect(() => {
    press.set(reduceMotion ? 1 : withTiming(pressed ? 0.98 : 1, { duration: 90 }));
    return () => cancelAnimation(press);
  }, [pressed, reduceMotion, press]);
  const body = useAnimatedStyle(() => ({ transform: [
    { translateY: reduceMotion || close ? 0 : bob.get() * amplitude },
    { scale: reduceMotion || close ? 1 : (1.006 + bob.get() * 0.006) * press.get() },
  ] }));
  const ground = useAnimatedStyle(() => ({ transform: [{ scaleX: reduceMotion ? 1 : 1 - bob.get() * 0.08 }, { scaleY: reduceMotion ? 1 : 1 - bob.get() * 0.12 }] }));
  return <Animated.View pointerEvents="box-none" style={{ width, height }}>
    {shadow ? <Animated.View pointerEvents="none" style={[styles.shadow, { width: width * 0.42, height: height * 0.025, left: width * 0.29, bottom: height * 0.012 }, ground]} /> : null}
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transformOrigin: "top center" }, body]}>{children}</Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({ shadow: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(138, 100, 230, 0.18)", boxShadow: "0 0 14px 5px rgba(160, 120, 255, 0.16)" } });
