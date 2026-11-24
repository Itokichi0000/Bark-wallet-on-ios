import { memo, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, withSequence } from "react-native-reanimated";
import { bus } from "@/container";
import type { AvatarCue } from "@/domain/avatar";
import { AnimatedAvatarRenderer, BOARD_CONTENT_RATIO } from "@/game/AnimatedAvatarRenderer";
import { AVATAR_ASPECT } from "@/game/AvatarRenderer";
import { HOLD_BOARD, isHolding } from "@/game/avatarMotion";
import { AvatarLife } from "./AvatarLife";
import { theme } from "@/theme";
import { useT } from "@/i18n";

export function stageBoardSize(width: number) {
  // This is the paper width. The actual QR surface (including its quiet zone)
  // is 220pt at 390pt and never shrinks below 200pt to accommodate a footer.
  return Math.max(200, Math.min(240, width - 170)) / BOARD_CONTENT_RATIO;
}
export function stageBoardContentSize(width: number) { return stageBoardSize(width) * BOARD_CONTENT_RATIO; }
export function stageCloseHeight(width: number) { return stageBoardSize(width) / HOLD_BOARD.width / AVATAR_ASPECT * 0.44 + theme.spacing.md; }

export const StageAvatar = memo(function StageAvatar({ cue, width, height, reduceMotion, board, boardImmediate, onBoardActiveChange, speaking, lineKey, disabled = false, fullBody = false, bust = false, minimumBustHeight = 0, replyBeat, onPress, framingHeight, headOffset = 0 }: {
  speaking: boolean; lineKey: string; disabled?: boolean; cue: AvatarCue; width: number; height: number; reduceMotion: boolean; board?: ReactNode; onBoardActiveChange(active: boolean): void;
  boardImmediate?: boolean; headOffset?: number; framingHeight?: number; fullBody?: boolean; bust?: boolean; minimumBustHeight?: number; replyBeat?: number; onPress?: () => void;
}) {
  const t = useT();
  const { height: windowHeight } = useWindowDimensions();
  const p = theme.presence;
  const [celebrating, setCelebrating] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [boardActive, setBoardActive] = useState(isHolding(cue));
  const close = isHolding(cue) || boardActive;
  const fullHeight = stageBoardSize(width) / HOLD_BOARD.width / AVATAR_ASPECT;
  const fullWidth = fullHeight * AVATAR_ASPECT;
  const frame = Math.max(1, (framingHeight ?? height) - theme.spacing.sm * 2);
  const restingScale = bust
    ? Math.min(width / AVATAR_ASPECT, Math.max(minimumBustHeight, frame / 0.30)) / fullHeight
    : fullBody || (!reduceMotion && celebrating) ? Math.min(frame / fullHeight, width / fullWidth)
    : Math.min(windowHeight < p.shortScreen ? p.heroShort : p.heroTall, Math.max(180, frame / 0.45)) / fullHeight;
  const scale = useSharedValue(close ? 1 : restingScale);
  const y = useSharedValue(headOffset + theme.spacing.sm);
  useEffect(() => { onBoardActiveChange(close); }, [close, onBoardActiveChange]);
  useEffect(() => {
    const target = close ? 1 : restingScale;
    const offset = headOffset + theme.spacing.sm; // Never move the head above the HUD to squeeze in a board.
    scale.set(reduceMotion ? target : withTiming(target, { duration: p.cameraMs, easing: Easing.bezier(...p.easeMove) }));
    y.set(reduceMotion ? offset : withTiming(offset, { duration: p.cameraMs, easing: Easing.bezier(...p.easeMove) }));
    return () => { cancelAnimation(scale); cancelAnimation(y); };
  }, [close, restingScale, headOffset, reduceMotion, scale, y]);
  const nod = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(nod); nod.set(0);
    if (replyBeat !== undefined && !reduceMotion && !disabled) nod.set(withSequence(withTiming(3, { duration: 90 }), withTiming(0, { duration: p.beatMs - 90 })));
    return () => cancelAnimation(nod);
  }, [replyBeat, reduceMotion, disabled, nod, p.beatMs]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() + nod.get() }, { scale: scale.get() }] }));
  return <View style={{ width, height, overflow: "hidden" }}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t("home.avatar")}
      disabled={disabled} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      onPress={onPress ?? (() => bus.emit({ type: "AVATAR_TAPPED", id: bus.nextId("tap") }))} />
    <Animated.View pointerEvents="box-none" style={[{ position: "absolute", top: 0, left: (width - fullWidth) / 2, width: fullWidth, height: fullHeight, transformOrigin: "top center" }, motion]}>
      <AvatarLife height={fullHeight} width={fullWidth} reduceMotion={reduceMotion} lineKey={lineKey} pressed={pressed} close={close} amplitude={close ? 0 : 1.5 / Math.max(0.05, restingScale)} shadow={!close}>
      <AnimatedAvatarRenderer speaking={speaking} cue={cue} height={fullHeight} reduceMotion={reduceMotion} board={board} boardImmediate={boardImmediate} onBoardActiveChange={setBoardActive} onFullBodyChange={setCelebrating} />
      </AvatarLife>
    </Animated.View>
  </View>;
});

/** Measured in-flow composition. The portrait can become a small bust, but
 * the entire paper (including fingers/rim and the QR quiet zone) stays visible. */
export function stageBoardLayout(width: number, height: number) {
  const contentSize = Math.max(200, Math.min(stageBoardContentSize(width), (height - 96) * BOARD_CONTENT_RATIO));
  const fullHeight = contentSize / BOARD_CONTENT_RATIO / HOLD_BOARD.width / AVATAR_ASPECT;
  const paperHeight = fullHeight * HOLD_BOARD.height;
  const rim = 8;
  const headHeight = Math.max(48, Math.min(140, height - paperHeight - rim * 2));
  return { contentSize, fullHeight, paperHeight, headHeight, rim };
}
export function StageBoard({ cue, width, height, reduceMotion, speaking, board }: {
  cue: AvatarCue; width: number; height: number; reduceMotion: boolean; speaking: boolean;
  board: ReactNode | ((size: number) => ReactNode);
}) {
  const { contentSize, fullHeight, paperHeight, headHeight, rim } = stageBoardLayout(width, height);
  const fullWidth = fullHeight * AVATAR_ASPECT;
  const portraitHeight = headHeight / HOLD_BOARD.y;
  return <View style={{ width, minHeight: headHeight + paperHeight + rim * 2, flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
    <View style={{ width, height: headHeight, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: (width - portraitHeight * AVATAR_ASPECT) / 2 }}>
        <AnimatedAvatarRenderer cue={cue} height={portraitHeight} reduceMotion={reduceMotion} speaking={speaking} boardImmediate />
      </View>
    </View>
    <View style={{ width, height: paperHeight + rim * 2, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: (width - fullWidth) / 2, top: rim - fullHeight * HOLD_BOARD.y }}>
        <AnimatedAvatarRenderer cue={cue} height={fullHeight} reduceMotion speaking={false} boardImmediate
          board={typeof board === "function" ? board(contentSize) : board} />
      </View>
    </View>
  </View>;
}
