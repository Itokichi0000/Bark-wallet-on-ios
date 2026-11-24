import { create } from "zustand";
import type { HandGesture } from "../../modules/noa-gestures/src";

/**
 * Live state of the voice/gesture conversation, for screens to render.
 * `ears`: the microphone. `listening` = waiting for speech, `hearing` = speech is coming in.
 * `eyes`: the front camera watching for hands.
 */
export type EarsState = "off" | "ready" | "listening" | "hearing" | "unavailable" | "denied";
export type EyesState = "off" | "watching" | "unavailable" | "denied";

export interface TalkState {
  ears: EarsState;
  /** What she is hearing right now (interim), shown as the owner's bubble being "spoken". */
  partial: string;
  /** The last finished utterance. `id` changes on every new one. */
  heard?: { id: number; text: string };
  eyes: EyesState;
  /** The last gesture seen. `id` changes on every new one. */
  gesture?: { id: number; gesture: HandGesture };
}

export const useTalk = create<TalkState>()(() => ({ ears: "off", partial: "", eyes: "off" }));
