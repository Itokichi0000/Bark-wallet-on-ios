import type { AvatarAction, AvatarCue } from "@/domain/avatar";

/**
 * Which motion clip a cue plays. Clips are transparent animated WebP files in
 * assets/avatar/motion: `idle` loops forever, every other clip plays once and
 * ends on the idle standing pose, so the renderer can fall back to `idle`.
 * `undefined` means there is no clip for this cue: show the still illustration.
 */
export const AVATAR_CLIPS = [
  "idle", "wave", "celebrate", "focus", "worry", "guide",
  "catch", "send", "think", "nod", "pointdown", "hush", "yawn", "startle", "talk", "search",
  // The board: `present` brings it out and ends on the holding pose, `hold` loops there, `putaway` returns to idle.
  "present", "hold", "putaway",
  // Lip-flap loops shown instead of `idle` / `hold` while her line is being typed out.
  "speak", "holdspeak",
  // Idle life.
  "sway", "hairfix", "peek",
] as const;
export type AvatarClip = (typeof AVATAR_CLIPS)[number];

/** Most clips are 76 frames at 15 fps. */
export const CLIP_DURATION_MS = 5067;
/** The two board transitions are shorter, so the QR code is not kept waiting. */
const SHORT_CLIPS: Partial<Record<AvatarClip, number>> = { present: 2733, putaway: 2533 };
export function clipDurationMs(clip: AvatarClip): number {
  return SHORT_CLIPS[clip] ?? CLIP_DURATION_MS;
}

/**
 * Where the blank board is inside the avatar frame while she holds it (fractions of the
 * frame's width and height, measured on assets/avatar/hold.png). The board is square.
 * Draw the QR code or camera view inside it with a small margin so her fingers stay visible.
 */
export const HOLD_BOARD = { x: 0.3072, y: 0.2001, width: 0.3843, height: 0.215 } as const;

/**
 * A cue with the `present` action is not a one-shot: play `present` once, then loop `hold`
 * for as long as the cue lasts, and play `putaway` when it ends. Content drawn on the board
 * should appear only once `present` has finished (CLIP_DURATION_MS) or at once under Reduce Motion.
 */
export function isHolding(cue: Pick<AvatarCue, "action">): boolean {
  return cue.action === "present";
}

/**
 * The loop under everything else: she is never a still image. While a line is appearing
 * in the dialogue box (`speaking`) her mouth moves; otherwise she breathes and blinks.
 */
export function baseLoop(o: { holding: boolean; speaking: boolean }): AvatarClip {
  if (o.holding) return o.speaking ? "holdspeak" : "hold";
  return o.speaking ? "speak" : "idle";
}

/** Roughly how long her mouth should move for a line: the time it takes to type it out. */
export function speakingMs(text: string, msPerChar = 45): number {
  return Math.min(8000, Math.max(900, [...text].length * msPerChar));
}

const BY_ACTION: Partial<Record<AvatarAction, AvatarClip>> = {
  // Success visuals: only cues derived from a confirmed result carry these actions.
  celebrate: "celebrate",
  catch: "catch",
  wave: "wave",
  warn: "worry",
  "point-left": "guide",
  "point-right": "guide",
  speak: "talk",
  talk: "talk",
  receive: "guide",
  listen: "focus",
  inspect: "search",
  search: "search",
  "prepare-send": "focus",
  // Sending off is a gesture, not a result: the celebration waits for PAYMENT_SUCCEEDED.
  sending: "send",
  think: "think",
  nod: "nod",
  "point-down": "pointdown",
  hush: "hush",
  yawn: "yawn",
  rest: "yawn",
  startle: "startle",
  float: "search",
  present: "present",
  sway: "sway",
  hairfix: "hairfix",
  peek: "peek",
};

export function clipForCue(cue: Pick<AvatarCue, "emotion" | "action">): AvatarClip | undefined {
  const clip = BY_ACTION[cue.action];
  if (clip) return clip;
  if (cue.emotion === "concerned") return "worry";
  if (cue.emotion === "focused") return "focus";
  if (cue.emotion === "thinking") return "think";
  if (cue.emotion === "neutral" || cue.emotion === "happy") return "idle";
  return undefined;
}
