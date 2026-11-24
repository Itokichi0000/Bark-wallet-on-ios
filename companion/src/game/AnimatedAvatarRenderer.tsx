import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { CuePriority } from "@/domain/avatar";
import { AVATAR_ASPECT, type AvatarRendererProps } from "./AvatarRenderer";
import { AVATAR_FRAMES, frameForCue } from "./IllustratedAvatarRenderer";
import { baseLoop, clipDurationMs, clipForCue, HOLD_BOARD, isHolding, type AvatarClip } from "./avatarMotion";

const CLIPS = {
  speak: require("../../assets/avatar/motion/speak.webp") as number,
  holdspeak: require("../../assets/avatar/motion/holdspeak.webp") as number,
  sway: require("../../assets/avatar/motion/sway.webp") as number,
  hairfix: require("../../assets/avatar/motion/hairfix.webp") as number,
  peek: require("../../assets/avatar/motion/peek.webp") as number,
  idle: require("../../assets/avatar/motion/idle.webp") as number,
  wave: require("../../assets/avatar/motion/wave.webp") as number,
  celebrate: require("../../assets/avatar/motion/celebrate.webp") as number,
  focus: require("../../assets/avatar/motion/focus.webp") as number,
  worry: require("../../assets/avatar/motion/worry.webp") as number,
  guide: require("../../assets/avatar/motion/guide.webp") as number,
  catch: require("../../assets/avatar/motion/catch.webp") as number,
  send: require("../../assets/avatar/motion/send.webp") as number,
  think: require("../../assets/avatar/motion/think.webp") as number,
  nod: require("../../assets/avatar/motion/nod.webp") as number,
  pointdown: require("../../assets/avatar/motion/pointdown.webp") as number,
  hush: require("../../assets/avatar/motion/hush.webp") as number,
  yawn: require("../../assets/avatar/motion/yawn.webp") as number,
  startle: require("../../assets/avatar/motion/startle.webp") as number,
  talk: require("../../assets/avatar/motion/talk.webp") as number,
  search: require("../../assets/avatar/motion/search.webp") as number,
  present: require("../../assets/avatar/motion/present.webp") as number,
  hold: require("../../assets/avatar/motion/hold.webp") as number,
  putaway: require("../../assets/avatar/motion/putaway.webp") as number,
} satisfies Record<AvatarClip, number>;


// The fingers reach ~8% into the paper on hold/holdspeak. Keep them and the navy rim exposed.
export const BOARD_INSET = 0.10;
export const BOARD_CONTENT_RATIO = Math.min(1, HOLD_BOARD.height / (AVATAR_ASPECT * HOLD_BOARD.width)) - 2 * BOARD_INSET;
type Props = AvatarRendererProps & { speaking?: boolean; board?: ReactNode; boardImmediate?: boolean; onBoardActiveChange?: (active: boolean) => void; onFullBodyChange?: (active: boolean) => void };
type Playback = { id: string; clip?: AvatarClip };
const isBoardClip = (clip?: AvatarClip) => clip === "present" || clip === "hold" || clip === "putaway";

/** A single keyed one-shot above the active base. Its clock starts on first display. */
function Clip({ clip, onFinish }: { clip: AvatarClip; onFinish(): void }) {
  const [ready, setReady] = useState(false);
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; }, [onFinish]);
  useEffect(() => {
    if (!ready || clip === "idle" || clip === "hold") return;
    const timer = setTimeout(() => finish.current(), clipDurationMs(clip));
    return () => clearTimeout(timer);
  }, [ready, clip]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={CLIPS[clip]} style={StyleSheet.absoluteFill} contentFit="contain" autoplay useAppleWebpCodec={false} accessible={false} onDisplay={() => setReady(true)} onError={() => finish.current()} /></View>;
}

function Board({ height, children }: { height: number; children: ReactNode }) {
  const width = height * AVATAR_ASPECT;
  const size = width * HOLD_BOARD.width * BOARD_CONTENT_RATIO;
  return <View style={{ position: "absolute", left: width * HOLD_BOARD.x + (width * HOLD_BOARD.width - size) / 2, top: height * HOLD_BOARD.y + (height * HOLD_BOARD.height - size) / 2,
    width: size, height: size,
    backgroundColor: "#FFFFFF", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

function MotionAvatar({ cue, height, board, boardImmediate = false, speaking = false, onBoardActiveChange, onFullBodyChange }: Props) {
  const next = useRef(cue);
  const [playback, setPlayback] = useState<Playback>(() => ({ id: cue.id, clip: boardImmediate && isHolding(cue) ? "hold" : speaking && cue.priority < CuePriority.paymentResult && !isHolding(cue) ? "idle" : clipForCue(cue) }));
  useEffect(() => {
    // Retain the confirmed result queued behind putaway even if its short cue expires.
    const expired = cue.id === "idle" || cue.id === "send-stage:succeeded";
    if (!(expired && isBoardClip(playback.clip))) next.current = cue;
    setPlayback((previous) => {
      if (isHolding(cue)) {
        // Scanning is interactive immediately, including its permission controls.
        if (boardImmediate) return previous.clip === "hold" ? previous : { id: cue.id, clip: "hold" };
        if (previous.clip === "present" || previous.clip === "hold") return previous;
        return { id: cue.id, clip: "present" };
      }
      if (isBoardClip(previous.clip)) return previous.clip === "putaway" ? previous : { id: `${previous.id}:away`, clip: "putaway" };
      // Let a short service cue finish. Explicit pending/unknown fallbacks still interrupt.
      if ((cue.id === "idle" || cue.id === "send-stage:succeeded") && previous.clip && previous.clip !== "idle") return previous;
      return { id: cue.id, clip: speaking && cue.priority < CuePriority.paymentResult ? "idle" : clipForCue(cue) };
    });
  }, [cue.id, cue.action, cue.emotion, boardImmediate]);
  useEffect(() => {
    // Lip-flap owns ordinary dialogue. Never interrupt a board transition or a service result.
    if (speaking && cue.priority < CuePriority.paymentResult) setPlayback((previous) => !isBoardClip(previous.clip) && previous.clip !== "celebrate" && previous.clip !== "catch"
      ? { id: `${cue.id}:speaking`, clip: "idle" } : previous);
  }, [speaking, cue.id, cue.priority]);
  const boardActive = isBoardClip(playback.clip);
  useEffect(() => { onBoardActiveChange?.(boardActive); }, [boardActive, onBoardActiveChange]);
  const finish = useCallback(() => {
    setPlayback((previous) => {
      if (previous.clip === "present" && isHolding(next.current)) return { id: `${previous.id}:hold`, clip: "hold" };
      if (previous.clip === "putaway") return { id: next.current.id, clip: clipForCue(next.current) };
      return { id: `${previous.id}:rest`, clip: "idle" };
    });
  }, []);
  const holding = playback.clip === "hold" && isHolding(cue);
  const base = baseLoop({ holding, speaking });
  const oneShot = playback.clip && playback.clip !== "idle" && playback.clip !== "hold" ? playback.clip : undefined;
  useEffect(() => { onFullBodyChange?.(oneShot === "celebrate" || oneShot === "catch"); }, [oneShot, onFullBodyChange]);
  return <View pointerEvents="box-none" style={{ width: height * AVATAR_ASPECT, height }}>
    {/* One source-swapping Image: native 120ms cross-dissolve, no four hidden loop decoders. */}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: oneShot ? 0 : 1 }]}>
      <Image source={CLIPS[base]} style={StyleSheet.absoluteFill} contentFit="contain" autoplay transition={120} useAppleWebpCodec={false} accessible={false} />
    </View>
    {oneShot ? <Clip key={`${playback.id}:${oneShot}`} clip={oneShot} onFinish={finish} /> : null}
    {holding && board ? <Board height={height}>{board}</Board> : null}
  </View>;
}

function StillAvatar({ cue, height, board, onBoardActiveChange }: Props) {
  const holding = isHolding(cue);
  useEffect(() => { onBoardActiveChange?.(holding); }, [holding, onBoardActiveChange]);
  return <View pointerEvents="box-none" style={{ width: height * AVATAR_ASPECT, height }}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={holding ? require("../../assets/avatar/hold.png") : AVATAR_FRAMES[frameForCue(cue)] as number} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} /></View>
    {holding && board ? <Board height={height}>{board}</Board> : null}
  </View>;
}

export function AnimatedAvatarRenderer(props: Props) {
  // No animated WebP is even mounted with Reduce Motion enabled.
  return props.reduceMotion ? <StillAvatar {...props} /> : <MotionAvatar {...props} />;
}
