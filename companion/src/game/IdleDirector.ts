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

  /** Pause between gestures: 1.5-4 s. With the breathing loop underneath she is never still for long. */
  nextDelayMs(): number {
    return 1500 + Math.floor(this.random() * 2500);
  }

  next(): IdleBeat {
    const r = this.random();
    let beat: IdleBeat;
    // Gestures are full motion clips (about 5 s); a blink leaves the idle loop running.
    if (r < 0.1) beat = { action: "blink", emotion: "neutral", durationMs: 220 };
    else if (r < 0.28) beat = { action: "sway", emotion: "happy", durationMs: 5000 };
    else if (r < 0.44) beat = { action: "hairfix", emotion: "neutral", durationMs: 5000 };
    else if (r < 0.58) beat = { action: "peek", emotion: "curious", durationMs: 5000 };
    else if (r < 0.70) beat = { action: "search", emotion: "curious", durationMs: 5000 };
    else if (r < 0.80) beat = { action: "think", emotion: "thinking", durationMs: 5000 };
    else if (r < 0.88) beat = { action: "nod", emotion: "happy", durationMs: 5000 };
    else if (r < 0.95) beat = { action: "wave", emotion: "happy", durationMs: 5000 };
    else beat = { action: "yawn", emotion: "sleepy", durationMs: 5000 };
    // Never the same non-blink gesture twice in a row.
    if (beat.action !== "blink" && beat.action === this.last) beat = { action: "blink", emotion: "neutral", durationMs: 220 };
    this.last = beat.action;
    return beat;
  }
}
