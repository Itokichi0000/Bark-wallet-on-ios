import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Image as NativeImage, StyleSheet, View } from "react-native";
import { CuePriority } from "@/domain/avatar";
import { AVATAR_ASPECT, type AvatarRendererProps } from "./AvatarRenderer";
import { AVATAR_FRAMES, frameForCue } from "./IllustratedAvatarRenderer";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { baseLoop, clipDurationMs, clipForCue, type AvatarClip } from "./avatarMotion";

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

// Metro reads actual asset metadata. The cap stays honest while Claude replaces clips in place.
export const MOTION_PIXEL_HEIGHT = Math.min(...Object.values(CLIPS).map((source) => NativeImage.resolveAssetSource(source)?.height ?? 858));


type Props = AvatarRendererProps & { speaking?: boolean; floatingPanel?: boolean };
type Playback = { id: string; clip?: AvatarClip };

/** Keep one anticipated native resource warm, without mounting a hidden decoder view. */
function useNextClip(clip: AvatarClip) {
  useEffect(() => {
    let disposed = false;
    let resource: Awaited<ReturnType<typeof Image.loadAsync>> | undefined;
    void Image.loadAsync(CLIPS[clip]).then((image) => {
      if (disposed) image.release(); else resource = image;
    }).catch(() => { /* Playback retains its normal asset fallback. */ });
    return () => { disposed = true; resource?.release(); };
  }, [clip]);
}

function Clip({ clip, onReady, onEnding, onFinish }: { clip: AvatarClip; onReady(): void; onEnding(): void; onFinish(): void }) {
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onReady, onEnding, onFinish });
  callbacks.current = { onReady, onEnding, onFinish };
  useEffect(() => {
    if (!ready) return;
    const fade = setTimeout(() => callbacks.current.onEnding(), Math.max(0, clipDurationMs(clip) - 120));
    const end = setTimeout(() => callbacks.current.onFinish(), clipDurationMs(clip));
    return () => { clearTimeout(fade); clearTimeout(end); };
  }, [ready, clip]);
  return <Image source={CLIPS[clip]} style={StyleSheet.absoluteFill} contentFit="contain" autoplay useAppleWebpCodec={false} accessible={false}
    onDisplay={() => { if (!ready) { setReady(true); callbacks.current.onReady(); } }} onError={() => callbacks.current.onFinish()} />;
}

export function AnimatedAvatarRenderer(props: Props) {
  if (props.reduceMotion) return <View pointerEvents="none" style={{ width: props.height * AVATAR_ASPECT, height: props.height }}>
    <NativeImage source={AVATAR_FRAMES[frameForCue(props.cue)]} style={StyleSheet.absoluteFill} resizeMode="contain" fadeDuration={0} accessible={false} />
  </View>;
  return <MotionAvatarRenderer {...props} />;
}

function MotionAvatarRenderer({ cue, height, speaking = false, floatingPanel = false }: Props) {
  const next = useRef(cue);
  next.current = cue;
  const [playback, setPlayback] = useState<Playback>(() => ({ id: cue.id, clip: clipForCue(cue) }));
  const blend = useSharedValue(0);
  useEffect(() => {
    setPlayback((previous) => {
      if ((cue.id === "idle" || cue.id === "send-stage:succeeded") && previous.clip && previous.clip !== "idle") return previous;
      return { id: cue.id, clip: speaking && cue.priority < CuePriority.paymentResult && !floatingPanel ? "idle" : clipForCue(cue) };
    });
  }, [cue.id, cue.action, cue.emotion, floatingPanel]);
  useEffect(() => {
    if (speaking && cue.priority < CuePriority.paymentResult && !floatingPanel) setPlayback((previous) =>
      previous.clip === "celebrate" || previous.clip === "catch" ? previous : { id: cue.id, clip: "idle" });
  }, [speaking, cue.id, cue.priority, floatingPanel]);
  const finish = useCallback(() => setPlayback((previous) => ({
    id: `${previous.id}:rest`,
    clip: floatingPanel ? "idle" : previous.clip === "present" && next.current.action === "present" ? "pointdown" : next.current.action === "listen" ? "focus" : "idle",
  })), [floatingPanel]);
  // Reduce Motion uses the static renderer above, without mounting/preloading clips.
  const base = baseLoop({ holding: false, speaking });
  // The large QR-side figure uses the measured pointing gesture. Wide-arm clips
  // would cross the panel or leave the left edge at this scale.
  const oneShot = playback.clip && playback.clip !== "idle" && playback.clip !== "hold"
    ? floatingPanel ? playback.clip === "present" || playback.clip === "pointdown" ? "pointdown" : undefined : playback.clip
    : undefined;
  useEffect(() => { blend.set(0); return () => cancelAnimation(blend); }, [playback.id, oneShot, blend]);
  useNextClip(oneShot === "present" ? "pointdown" : oneShot ? base : speaking ? "idle" : "speak");
  const baseStyle = useAnimatedStyle(() => ({ opacity: 1 - blend.get() }));
  const shotStyle = useAnimatedStyle(() => ({ opacity: blend.get() }));
  return <View pointerEvents="none" style={{ width: height * AVATAR_ASPECT, height }}>
    <Animated.View style={[StyleSheet.absoluteFill, baseStyle]}>
      <Image source={CLIPS[base]} style={StyleSheet.absoluteFill} contentFit="contain" autoplay transition={120} useAppleWebpCodec={false} accessible={false} />
    </Animated.View>
    {oneShot ? <Animated.View style={[StyleSheet.absoluteFill, shotStyle]}><Clip key={`${playback.id}:${oneShot}`} clip={oneShot}
      onReady={() => blend.set(withTiming(1, { duration: 120 }))} onEnding={() => blend.set(withTiming(0, { duration: 120 }))} onFinish={finish} /></Animated.View> : null}
  </View>;
}
