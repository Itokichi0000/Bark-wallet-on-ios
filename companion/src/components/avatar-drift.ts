import { useEffect } from "react";
import { PixelRatio } from "react-native";
import { useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { MOTION_PIXEL_HEIGHT } from "@/game/AnimatedAvatarRenderer";
import { AVATAR_ASPECT } from "@/game/AvatarRenderer";

export type AvatarDrift = { wander: SharedValue<number>; bob: SharedValue<number>; scale: SharedValue<number>; tilt: SharedValue<number> };
/** One UI-thread clock shared by the figure, its tail, floor light and particles. */
export function useAvatarDrift(still: boolean, asking = false): AvatarDrift {
  const wander = useSharedValue(0), bob = useSharedValue(0), scale = useSharedValue(1), tilt = useSharedValue(0);
  const clock = useSharedValue(0), bias = useSharedValue(0);
  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = Math.min(timeSincePreviousFrame ?? 0, 64);
    clock.set(clock.get() + dt);
    const t = clock.get() / 1000;
    bias.set(bias.get() + ((asking ? 0.18 : 0) - bias.get()) * dt / 1800);
    // Incommensurate periods avoid an obvious repeat; asking gently favours replies on the right.
    wander.set(Math.max(-1, Math.min(1, 0.76 * Math.sin(t * 2 * Math.PI / 13.7) + 0.24 * Math.sin(t * 2 * Math.PI / 9.1) + bias.get())));
    bob.set(5 * Math.sin(t * 2 * Math.PI / 6.7) + 1.5 * Math.sin(t * 2 * Math.PI / 4.3));
    scale.set(1 + 0.015 * Math.sin(t * 2 * Math.PI / 7.9));
    tilt.set(0.8 * Math.sin(t * 2 * Math.PI / 11.3));
  }, false);
  useEffect(() => {
    frame.setActive(!still);
    if (still) { wander.set(0); bob.set(0); scale.set(1); tilt.set(0); }
    return () => frame.setActive(false);
  }, [still, frame, wander, bob, scale, tilt]);
  return { wander, bob, scale, tilt };
}

/** Bounds include the full gesture frame, tilt, breathe and bob; no source-pixel upscaling. */
export function fullBodyLayout(width: number, height: number, screenHeight = height) {
  const bodyHeight = Math.max(1, Math.min((height - 14) / 1.023, screenHeight * 0.54, MOTION_PIXEL_HEIGHT / PixelRatio.get() / 1.015, (width - 16) / AVATAR_ASPECT / 1.04));
  const bodyWidth = bodyHeight * AVATAR_ASPECT;
  const extent = bodyWidth * 1.015 / 2 + bodyHeight * 0.009;
  return { bodyHeight, bodyWidth, travel: Math.max(0, Math.min(width * 0.15, width / 2 - extent - 8)), top: Math.max((height - bodyHeight) / 2, height - bodyHeight - 12), left: (width - bodyWidth) / 2 };
}

export type FigureLayout = ReturnType<typeof fullBodyLayout>;

export function hologramLayout(width: number, height?: number) {
  const preferredContentSize = Math.max(220, Math.min(240, 220 + (width - 390) * 0.4));
  // A keyboard can remain visible during a transition into the QR/scanner.
  // Its frame must fit the actual stage too, without taking room from replies.
  const contentSize = Math.max(1, Math.min(preferredContentSize, (height ?? Infinity) - 12));
  const panelSize = contentSize + 12;
  const preferredBodyHeight = Math.min(395 + Math.max(0, width - 390) * 0.5, 420, MOTION_PIXEL_HEIGHT / PixelRatio.get());
  // Decoded alpha envelope of pointdown / idle / speak, including every frame.
  // The left transparent margin can leave the viewport; the visible figure cannot.
  // Keep the upper-right panel above the pointing hand, with 4pt separation.
  const headRoom = width < 390 ? panelSize + 8 : 110;
  const minHeight = preferredBodyHeight + headRoom + 8;
  const stageHeight = height ?? minHeight;
  const bodyHeight = Math.max(1, Math.min(preferredBodyHeight, stageHeight - headRoom - 8));
  const bodyWidth = bodyHeight * AVATAR_ASPECT;
  // Retain the original alpha-safe placement at normal heights. In the short
  // keyboard layout, use separate frame lanes so even a small QR stays clear.
  const panelLeft = width - panelSize - 4;
  const small = stageHeight < headRoom + 160;
  const lane = small ? fullBodyLayout(Math.max(1, panelLeft - 8), stageHeight) : undefined;
  const body = lane ? { ...lane, travel: Math.min(3, lane.travel) } : { bodyHeight, bodyWidth, left: -20 * bodyHeight / preferredBodyHeight, top: stageHeight - bodyHeight - 8, travel: 3 };
  return { contentSize, panelSize, panelLeft, minHeight, body };
}
