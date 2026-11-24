import type { HandGesture } from "../../modules/noa-gestures/src";

/**
 * What a hand gesture may do. Pure, so the rules are testable and cannot drift into screens.
 *
 * A gesture can greet, ask Noa to listen, turn a story page, or pick the reply she suggests.
 * It can never move money: on review, authorisation or sending it picks nothing, and the
 * replies that send, retry or reveal anything are never chosen by a gesture.
 */
export type GestureAction =
  | { kind: "wave-back" }
  | { kind: "listen" }
  | { kind: "choose"; choice: string }
  | { kind: "page"; direction: "next" | "previous" }
  | { kind: "none" };

export interface GestureContext {
  /** Replies on screen, in order; the first is the one she suggests. */
  choices: readonly string[];
  /** Review, authorisation, sending, or any screen showing secrets. */
  sensitive: boolean;
  /** The screen turns pages (story reader). */
  pages?: boolean;
}

/** Replies a gesture may never pick, wherever they appear. */
export const GESTURE_FORBIDDEN: readonly string[] = ["send", "retry", "max", "confirm-send", "reveal", "delete"];

export function gestureAction(gesture: HandGesture, ctx: GestureContext): GestureAction {
  if (gesture === "wave") return { kind: "wave-back" };
  if (ctx.sensitive) return { kind: "none" };
  if (gesture === "palm") return { kind: "listen" };
  if (gesture === "swipeLeft" || gesture === "swipeRight") {
    return ctx.pages ? { kind: "page", direction: gesture === "swipeLeft" ? "next" : "previous" } : { kind: "none" };
  }
  // thumbsUp: "yes" to her suggestion.
  const suggested = ctx.choices[0];
  if (!suggested || GESTURE_FORBIDDEN.includes(suggested)) return { kind: "none" };
  return { kind: "choose", choice: suggested };
}
