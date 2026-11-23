import type { AvatarCue } from "@/domain/avatar";

/**
 * Which motion clip a cue plays. Clips are transparent animated WebP files in
 * assets/avatar/motion: `idle` loops forever, every other clip plays once and
 * ends on the idle standing pose, so the renderer can fall back to `idle`.
 * `undefined` means there is no clip for this cue: show the still illustration.
 */
export type AvatarClip = "idle" | "wave" | "celebrate" | "focus" | "worry" | "guide";

/** Every clip is 76 frames at 15 fps. */
export const CLIP_DURATION_MS = 5067;

export function clipForCue(cue: Pick<AvatarCue, "emotion" | "action">): AvatarClip | undefined {
  switch (cue.action) {
    case "celebrate": return "celebrate";
    case "wave": return "wave";
    case "warn": return "worry";
    case "point-left":
    case "point-right":
    case "speak":
    case "receive": return "guide";
    case "listen":
    case "inspect":
    case "prepare-send":
    case "sending": return "focus";
    case "rest": return undefined;
    default: break;
  }
  if (cue.emotion === "concerned") return "worry";
  if (cue.emotion === "focused" || cue.emotion === "thinking") return "focus";
  if (cue.emotion === "neutral" || cue.emotion === "happy") return "idle";
  return undefined;
}
