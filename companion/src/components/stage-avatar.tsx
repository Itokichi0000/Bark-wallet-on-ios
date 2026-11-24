import { memo, useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
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
  // ~250pt held board on a phone, including its rim/fingers; the QR surface is >=200pt.
  return Math.max(200 / BOARD_CONTENT_RATIO, Math.min(width * 0.64, 260));
}
export function stageBoardContentSize(width: number) { return stageBoardSize(width) * BOARD_CONTENT_RATIO; }
export function stageCloseHeight(width: number) { return stageBoardSize(width) / HOLD_BOARD.width / AVATAR_ASPECT * 0.44 + theme.spacing.md; }

export const StageAvatar = memo(function StageAvatar({ cue, width, height, reduceMotion, board, boardImmediate, onBoardActiveChange, speaking, lineKey, disabled = false, fullBody = false, replyBeat, onPress, framingHeight, headOffset = 0 }: {
  speaking: boolean; lineKey: string; disabled?: boolean; cue: AvatarCue; width: number; height: number; reduceMotion: boolean; board?: ReactNode; onBoardActiveChange(active: boolean): void;
  boardImmediate?: boolean; headOffset?: number; framingHeight?: number; fullBody?: boolean; replyBeat?: number; onPress?: () => void;
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
  const restingScale = fullBody || (!reduceMotion && celebrating) ? Math.min((framingHeight ?? height) / fullHeight, width / fullWidth) : Math.min(windowHeight < p.shortScreen ? p.heroShort : p.heroTall, Math.max(180, (framingHeight ?? height) / 0.45)) / fullHeight;
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

/** A foreground prop: the head and board use separate camera distances on
 * constrained phones. Both keep their aspect ratio; the board's rim/fingers
 * are a crop of the same hold artwork, not a stretched full-body sprite. */
export function StageBoard({ cue, width, height, reduceMotion, speaking, board }: {
  cue: AvatarCue; width: number; height: number; reduceMotion: boolean; speaking: boolean;
  board: ReactNode | ((size: number) => ReactNode);
}) {
  const boardSize = Math.max(200, Math.min(240, height - 48));
  const portraitHeight = Math.max(48, Math.min(140, height - boardSize));
  const portraitFullHeight = portraitHeight / 0.20;
  const propHeight = boardSize / HOLD_BOARD.height;
  const propWidth = propHeight * AVATAR_ASPECT;
  const paperWidth = propWidth * HOLD_BOARD.width;
  const contentSize = paperWidth * BOARD_CONTENT_RATIO;
  return <View style={{ width, height, alignItems: "center", justifyContent: "flex-end" }}>
    <View pointerEvents="none" style={{ width, height: portraitHeight, overflow: "hidden", alignItems: "center" }}>
      <AnimatedAvatarRenderer cue={cue} height={portraitFullHeight} reduceMotion={reduceMotion} speaking={speaking} boardImmediate />
    </View>
    <View style={{ width, height: boardSize, overflow: "hidden", alignItems: "center" }}>
      <Image pointerEvents="none" source={require("../../assets/avatar/hold.png")} contentFit="contain" accessible={false}
        style={{ position: "absolute", width: propWidth, height: propHeight, left: (width - propWidth) / 2, top: -propHeight * HOLD_BOARD.y }} />
      <View style={{ position: "absolute", top: (boardSize - contentSize) / 2, left: (width - propWidth) / 2 + propWidth * HOLD_BOARD.x + (paperWidth - contentSize) / 2, width: contentSize, height: contentSize, backgroundColor: "#FFFFFF" }}>
        {typeof board === "function" ? board(contentSize) : board}
      </View>
    </View>
  </View>;
}
