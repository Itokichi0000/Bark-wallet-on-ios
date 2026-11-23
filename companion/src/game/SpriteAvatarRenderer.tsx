import { useEffect, useMemo, useState } from "react";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { AvatarAction, AvatarEmotion } from "@/domain/avatar";
import { theme } from "@/theme";
import type { AvatarRendererProps } from "./AvatarRenderer";

/** The vector placeholder keeps its own proportions (viewBox 200 x 440). Kept as a fallback renderer. */
const AVATAR_ASPECT = 200 / 440;
import { IdleDirector } from "./IdleDirector";

/**
 * Placeholder companion, drawn entirely in code: an original full-body
 * figure (silver-violet bob, oversized hoodie, boots) so the home screen
 * works before commissioned art exists. Replace by another AvatarRenderer.
 */
const HAIR = "#B9B0D9";
const HAIR_SHADE = "#8C80B8";
const SKIN = "#F4E3E0";
const HOODIE = "#3B2D63";
const HOODIE_LIGHT = "#5A4691";
const LEGS = "#1E1733";
const BOOT = "#D9D2F2";
const GLOW = theme.colors.primary;

interface Pose { left: number; right: number }

function poseFor(action: AvatarAction, wavePhase: boolean): Pose {
  switch (action) {
    case "wave": return { left: 8, right: wavePhase ? -150 : -128 };
    case "point-left": return { left: 104, right: -8 };
    case "point-right": return { left: 8, right: -104 };
    case "prepare-send":
    case "sending": return { left: -38, right: 38 };
    case "receive": return { left: 8, right: -72 };
    case "celebrate": return { left: 150, right: -150 };
    case "warn": return { left: 18, right: -46 };
    case "listen": return { left: 8, right: -158 };
    case "inspect": return { left: -30, right: -8 };
    case "speak": return { left: 14, right: -24 };
    default: return { left: 8, right: -8 };
  }
}

function Eyes({ emotion, closed }: { emotion: AvatarEmotion; closed: boolean }) {
  const lx = 84, rx = 116, y = 98;
  if (closed || emotion === "sleepy") {
    return (
      <G stroke="#2A2140" strokeWidth={2.4} strokeLinecap="round">
        <Line x1={lx - 6} y1={y + 1} x2={lx + 6} y2={y + 1} />
        <Line x1={rx - 6} y1={y + 1} x2={rx + 6} y2={y + 1} />
      </G>
    );
  }
  if (emotion === "happy") {
    return (
      <G stroke="#2A2140" strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d={`M${lx - 6} ${y + 2} Q${lx} ${y - 6} ${lx + 6} ${y + 2}`} />
        <Path d={`M${rx - 6} ${y + 2} Q${rx} ${y - 6} ${rx + 6} ${y + 2}`} />
      </G>
    );
  }
  const big = emotion === "surprised" ? 1.25 : emotion === "focused" ? 0.8 : 1;
  const dx = emotion === "thinking" ? -2 : 0;
  const dy = emotion === "thinking" ? -2 : 0;
  return (
    <G>
      {[lx, rx].map((x, i) => (
        <G key={x}>
          <Ellipse cx={x} cy={y} rx={5.2 * (emotion === "curious" && i === 1 ? 1.2 : 1)} ry={7 * big} fill="#2A2140" />
          <Circle cx={x + dx + 1.4} cy={y + dy - 2.2} r={1.8} fill="#FFFFFF" />
          <Circle cx={x + dx} cy={y + dy + 1.5} r={2.2} fill={GLOW} opacity={0.7} />
        </G>
      ))}
      {(emotion === "concerned" || emotion === "focused") && (
        <G stroke="#6B5E96" strokeWidth={2} strokeLinecap="round">
          <Line x1={lx - 7} y1={emotion === "concerned" ? y - 13 : y - 12} x2={lx + 6} y2={emotion === "concerned" ? y - 16 : y - 12} />
          <Line x1={rx - 6} y1={emotion === "concerned" ? y - 16 : y - 12} x2={rx + 7} y2={emotion === "concerned" ? y - 13 : y - 12} />
        </G>
      )}
    </G>
  );
}

function Mouth({ emotion, talking }: { emotion: AvatarEmotion; talking: boolean }) {
  const y = 117;
  if (talking || emotion === "surprised") return <Ellipse cx={100} cy={y} rx={4} ry={talking ? 3.4 : 5} fill="#7A3B55" />;
  if (emotion === "happy") return <Path d={`M92 ${y - 2} Q100 ${y + 7} 108 ${y - 2}`} stroke="#7A3B55" strokeWidth={2.2} strokeLinecap="round" fill="none" />;
  if (emotion === "concerned") return <Path d={`M94 ${y + 2} Q100 ${y - 3} 106 ${y + 2}`} stroke="#7A3B55" strokeWidth={2} strokeLinecap="round" fill="none" />;
  return <Path d={`M95 ${y} Q100 ${y + 3} 105 ${y}`} stroke="#7A3B55" strokeWidth={2} strokeLinecap="round" fill="none" />;
}

function Arm({ side, angle }: { side: "left" | "right"; angle: number }) {
  const x = side === "left" ? 64 : 136;
  return (
    <G rotation={angle} origin={`${x}, 172`}>
      <Rect x={x - 11} y={164} width={22} height={86} rx={11} fill={HOODIE} />
      <Rect x={x - 11} y={232} width={22} height={10} fill={HOODIE_LIGHT} />
      <Circle cx={x} cy={258} r={9} fill={SKIN} />
    </G>
  );
}

function Props({ action }: { action: AvatarAction }) {
  if (action === "prepare-send" || action === "sending") {
    return (
      <G>
        <Circle cx={100} cy={236} r={26} fill="url(#orb)" />
        <Circle cx={100} cy={236} r={action === "sending" ? 9 : 6} fill="#FFFFFF" opacity={0.95} />
      </G>
    );
  }
  if (action === "receive") {
    return (
      <G opacity={0.92}>
        <Rect x={156} y={128} width={38} height={38} rx={5} fill="none" stroke={GLOW} strokeWidth={1.6} />
        {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ((r + c) % 2 === 0 || r === 1 ? <Rect key={`${r}${c}`} x={162 + c * 9} y={134 + r * 9} width={7} height={7} fill={GLOW} /> : null)))}
      </G>
    );
  }
  if (action === "celebrate") {
    return (
      <G fill={theme.colors.warning}>
        {[[40, 60], [164, 48], [28, 150], [176, 140], [100, 12]].map(([x, y]) => (
          <Path key={`${x}-${y}`} d={`M${x} ${(y ?? 0) - 7} L${(x ?? 0) + 2} ${(y ?? 0) - 2} L${(x ?? 0) + 7} ${y} L${(x ?? 0) + 2} ${(y ?? 0) + 2} L${x} ${(y ?? 0) + 7} L${(x ?? 0) - 2} ${(y ?? 0) + 2} L${(x ?? 0) - 7} ${y} L${(x ?? 0) - 2} ${(y ?? 0) - 2} Z`} />
        ))}
      </G>
    );
  }
  if (action === "warn") {
    return (
      <G>
        <Path d="M168 96 L186 128 L150 128 Z" fill="none" stroke={theme.colors.warning} strokeWidth={2} strokeLinejoin="round" />
        <Line x1={168} y1={107} x2={168} y2={118} stroke={theme.colors.warning} strokeWidth={2.4} strokeLinecap="round" />
        <Circle cx={168} cy={123} r={1.6} fill={theme.colors.warning} />
      </G>
    );
  }
  if (action === "listen") {
    return (
      <G stroke={GLOW} strokeWidth={2} fill="none" strokeLinecap="round">
        <Path d="M160 84 Q168 96 160 108" />
        <Path d="M168 76 Q180 96 168 116" opacity={0.6} />
      </G>
    );
  }
  if (action === "inspect") return <Circle cx={52} cy={236} r={14} fill="url(#orb)" />;
  return null;
}

export function SpriteAvatarRenderer({ cue, height, reduceMotion }: AvatarRendererProps) {
  const width = height * AVATAR_ASPECT;
  const director = useMemo(() => new IdleDirector(), []);
  const [blink, setBlink] = useState(false);
  const [wavePhase, setWavePhase] = useState(false);
  const [beat, setBeat] = useState<{ action: AvatarAction; emotion: AvatarEmotion } | null>(null);
  const float = useSharedValue(0);
  const jump = useSharedValue(0);

  const isIdle = cue.action === "idle";
  const action = isIdle && beat ? beat.action : cue.action;
  const emotion = isIdle && beat ? beat.emotion : cue.emotion;

  // Floating: a few points up and down. Off entirely under reduce-motion.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(float);
      float.value = 0;
      return;
    }
    float.value = withRepeat(withTiming(1, { duration: theme.motion.idleCycleMs / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(float);
  }, [reduceMotion, float]);

  // One small jump when a celebrate cue arrives; the cue itself is only ever issued for confirmed results.
  useEffect(() => {
    if (cue.action !== "celebrate" || reduceMotion) return;
    jump.value = withSequence(withTiming(-18, { duration: 180 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
  }, [cue.id, cue.action, reduceMotion, jump]);

  // Idle beats (blink, glance, small wave) only while nothing else is being shown.
  useEffect(() => {
    if (!isIdle || reduceMotion) {
      setBeat(null);
      setBlink(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const b = director.next();
        if (b.action === "blink") setBlink(true);
        else setBeat({ action: b.action === "float" ? "idle" : b.action, emotion: b.emotion });
        timer = setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          setBeat(null);
          schedule();
        }, b.durationMs);
      }, director.nextDelayMs());
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isIdle, reduceMotion, director]);

  useEffect(() => {
    if (action !== "wave" || reduceMotion) return;
    const t = setInterval(() => setWavePhase((p) => !p), 260);
    return () => clearInterval(t);
  }, [action, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: float.value * -6 + jump.value }] }));
  const pose = poseFor(action, wavePhase);
  const resting = action === "rest";

  return (
    <Animated.View style={[{ width, height }, style]} accessible accessibilityRole="image" accessibilityLabel="Companion">
      <Svg width={width} height={height} viewBox="0 0 200 440">
        <Defs>
          <RadialGradient id="orb" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="45%" stopColor={GLOW} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={GLOW} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={GLOW} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={GLOW} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* light ring under the feet */}
        <Ellipse cx={100} cy={420} rx={70} ry={12} fill="url(#halo)" />
        <Ellipse cx={100} cy={420} rx={54} ry={8} fill="none" stroke={GLOW} strokeWidth={1.4} opacity={0.8} />

        {/* legs and boots */}
        <Rect x={76} y={282} width={20} height={98} rx={9} fill={LEGS} />
        <Rect x={104} y={282} width={20} height={98} rx={9} fill={LEGS} />
        <Path d="M70 372 h28 v26 q0 10 -10 10 h-22 q-8 0 -8 -8 q0 -9 12 -11 Z" fill={BOOT} />
        <Path d="M102 372 h28 v17 q12 2 12 11 q0 8 -8 8 h-22 q-10 0 -10 -10 Z" fill={BOOT} />
        <Rect x={70} y={372} width={28} height={6} fill={GLOW} opacity={0.8} />
        <Rect x={102} y={372} width={28} height={6} fill={GLOW} opacity={0.8} />

        {/* hoodie */}
        <Path d="M56 176 q0 -26 44 -26 q44 0 44 26 l6 104 q0 14 -14 14 h-72 q-14 0 -14 -14 Z" fill={HOODIE} />
        <Path d="M64 262 h72 v14 h-72 Z" fill={HOODIE_LIGHT} />
        <Path d="M78 152 q22 22 44 0 l-4 22 q-18 12 -36 0 Z" fill={HOODIE_LIGHT} />
        <Line x1={92} y1={176} x2={90} y2={206} stroke={BOOT} strokeWidth={2} strokeLinecap="round" />
        <Line x1={108} y1={176} x2={110} y2={206} stroke={BOOT} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={100} cy={226} r={9} fill="none" stroke={GLOW} strokeWidth={1.6} opacity={0.9} />
        <Path d="M96 226 l3 3 l6 -7" stroke={GLOW} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.9} />

        <Arm side="left" angle={pose.left} />
        <Arm side="right" angle={pose.right} />

        {/* head */}
        <G rotation={resting ? 8 : action === "inspect" || emotion === "thinking" ? -6 : 0} origin="100, 130">
          <Rect x={93} y={128} width={14} height={22} rx={6} fill={SKIN} />
          <Path d="M52 96 q0 -52 48 -52 q48 0 48 52 q0 30 -10 46 q-8 -6 -8 -22 h-60 q0 16 -8 22 q-10 -16 -10 -46 Z" fill={HAIR_SHADE} />
          <Circle cx={100} cy={96} r={40} fill={SKIN} />
          <Path d="M58 92 q2 -42 42 -42 q40 0 42 42 q-14 -6 -22 -24 q-12 18 -34 22 q-4 -8 -4 -14 q-8 14 -24 16 Z" fill={HAIR} />
          <Path d="M98 50 q-6 -22 10 -30 q-4 14 2 30 Z" fill={HAIR} />
          <Path d="M128 62 l8 -5 l8 5 v9 l-8 5 l-8 -5 Z" fill={GLOW} opacity={0.95} />
          <Eyes emotion={emotion} closed={blink || resting} />
          <Mouth emotion={emotion} talking={action === "speak"} />
          <Ellipse cx={72} cy={110} rx={6} ry={3.4} fill="#F2A7B5" opacity={0.55} />
          <Ellipse cx={128} cy={110} rx={6} ry={3.4} fill="#F2A7B5" opacity={0.55} />
        </G>

        <Props action={action} />
      </Svg>
    </Animated.View>
  );
}
