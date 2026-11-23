import type { AvatarAction, AvatarEmotion } from "@/domain/avatar";

export interface IdleBeat {
  action: AvatarAction;
  emotion: AvatarEmotion;
  durationMs: number;
}

/**
 * Picks the small things the avatar does while nothing is happening.
 * Deterministic given its random source, so it can be tested.
 */
export class IdleDirector {
  private last: AvatarAction = "idle";
  constructor(private readonly random: () => number = Math.random) {}

  /** Milliseconds until the next beat: 5-10 s, per the design doc. */
  nextDelayMs(): number {
    return 5000 + Math.floor(this.random() * 5000);
  }

  next(): IdleBeat {
    const r = this.random();
    let beat: IdleBeat;
    if (r < 0.55) beat = { action: "blink", emotion: "neutral", durationMs: 220 };
    else if (r < 0.8) beat = { action: "float", emotion: "curious", durationMs: 1600 };
    else if (r < 0.93) beat = { action: "inspect", emotion: "thinking", durationMs: 1800 };
    else beat = { action: "wave", emotion: "happy", durationMs: 1400 };
    // Never the same non-blink gesture twice in a row.
    if (beat.action !== "blink" && beat.action === this.last) beat = { action: "blink", emotion: "neutral", durationMs: 220 };
    this.last = beat.action;
    return beat;
  }
}
