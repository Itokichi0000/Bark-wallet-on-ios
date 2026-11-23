import type { ComponentType } from "react";
import type { AvatarCue } from "@/domain/avatar";

/**
 * Anything that can draw the companion. It receives a cue and nothing else:
 * no wallet, no balance, no callbacks into payment code. A Rive or Live2D
 * renderer can replace the sprite renderer by implementing this.
 */
export interface AvatarRendererProps {
  cue: AvatarCue;
  /** Height in points. The figure keeps its aspect ratio and is never cropped. */
  height: number;
  reduceMotion: boolean;
}

export type AvatarRenderer = ComponentType<AvatarRendererProps>;

/** width / height of the full figure, head to shoes, including its floating margin. */
export const AVATAR_ASPECT = 752 / 1344;
