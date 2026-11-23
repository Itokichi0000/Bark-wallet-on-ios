import { BitcoinIcon, type BitcoinIconName } from "@/components/BitcoinIcon";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Ellipse } from "react-native-svg";
import type { MenuId } from "@/domain/events";
import { theme } from "@/theme";

export interface MenuItem {
  id: MenuId;
  label: string;
  sublabel: string;
  glyph?: string;
  hint: string;
}

interface Props {
  width: number;
  height: number;
  items: MenuItem[];
  reduceMotion: boolean;
  onSelect(id: MenuId): void;
}

/** Base angle of each slot on the ellipse, in degrees (0 = right, clockwise). Fixed quadrants per the design doc. */
const SLOT_ANGLE: Record<MenuId, number> = { send: 212, receive: 328, assets: 148, archive: 32 };
const MENU_ICON: Record<MenuId, BitcoinIconName> = { send: "send", receive: "receive", assets: "wallet", archive: "transactions" };
const DRIFT_DEG = 7;
const ITEM_W = 92;
const ITEM_H = 60;

function Item({ item, cx, cy, rx, ry, phase, onSelect }: {
  item: MenuItem; cx: number; cy: number; rx: number; ry: number; phase: SharedValue<number>; onSelect(id: MenuId): void;
}) {
  const base = SLOT_ANGLE[item.id];
  const style = useAnimatedStyle(() => {
    const a = ((base + Math.sin(phase.value * Math.PI * 2) * DRIFT_DEG) * Math.PI) / 180;
    return {
      transform: [
        { translateX: cx + rx * Math.cos(a) - ITEM_W / 2 },
        { translateY: cy + ry * Math.sin(a) - ITEM_H / 2 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.itemWrap, style]}>
      <Pressable
        onPress={() => onSelect(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityHint={item.hint}
        hitSlop={8}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <BitcoinIcon name={MENU_ICON[item.id]} size={20} />
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
        <Text style={styles.sublabel}>{item.sublabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Four hologram panels riding an elliptical orbit around the companion.
 * Each stays in its own quadrant and drifts gently along the ring; the ring
 * itself turns. Under reduce-motion everything is still.
 */
export function HologramMenu({ width, height, items, reduceMotion, onSelect }: Props) {
  const phase = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(phase);
      cancelAnimation(spin);
      phase.value = 0;
      spin.value = 0;
      return;
    }
    phase.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    spin.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(phase);
      cancelAnimation(spin);
    };
  }, [reduceMotion, phase, spin]);

  const cx = width / 2;
  const cy = height / 2;
  // Keep panels inside the screen and clear of the figure's face and shoes.
  const rx = Math.max(60, width / 2 - ITEM_W / 2 - 6);
  const ry = Math.max(70, height * 0.3);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <View pointerEvents="box-none" style={{ width, height, position: "absolute" }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={width} height={height}>
          <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={theme.colors.outline} strokeWidth={1} strokeDasharray="2 10" opacity={0.7} />
          <Ellipse cx={cx} cy={cy} rx={rx * 0.86} ry={ry * 0.86} fill="none" stroke={theme.colors.primary} strokeWidth={0.6} strokeDasharray="28 18" opacity={0.35} />
        </Svg>
      </Animated.View>
      {items.map((item) => (
        <Item key={item.id} item={item} cx={cx} cy={cy} rx={rx} ry={ry} phase={phase} onSelect={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  itemWrap: { position: "absolute", left: 0, top: 0, width: ITEM_W, height: ITEM_H },
  item: {
    flex: 1, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.panel, paddingHorizontal: 6,
  },
  itemPressed: { backgroundColor: theme.colors.primaryStrong, transform: [{ scale: 1.06 }] },
  glyph: { color: theme.colors.primary, fontSize: 15, lineHeight: 18 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  sublabel: { color: theme.colors.textMuted, fontSize: 9, letterSpacing: 1.5 },
});
