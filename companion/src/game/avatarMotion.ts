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
] as const;
export type AvatarClip = (typeof AVATAR_CLIPS)[number];

/** Every clip is 76 frames at 15 fps. */
export const CLIP_DURATION_MS = 5067;

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
