import { CuePriority } from "@/domain/avatar";
import type { DomainEvent } from "@/domain/events";
import { AvatarOrchestrator, type OrchestratorClock } from "@/game/AvatarOrchestrator";
import { IdleDirector } from "@/game/IdleDirector";

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: OrchestratorClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (t) => void timers.delete(t as unknown as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { clock, advance };
}

describe("AvatarOrchestrator", () => {
  it("celebrates a payment exactly once per operation", () => {
    const { clock } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    const seen: string[] = [];
    o.subscribe((c) => seen.push(c.action));
    o.handle({ type: "PAYMENT_SUCCEEDED", id: "e1", operationId: "op-1" });
    o.handle({ type: "PAYMENT_SUCCEEDED", id: "e2", operationId: "op-1" });
    o.handle({ type: "PAYMENT_SUCCEEDED", id: "e3", operationId: "op-1" });
    expect(seen.filter((a) => a === "celebrate")).toHaveLength(1);
  });

  it("has no path to 'celebrate' except confirmed payment events", () => {
    const { clock, advance } = fakeClock();
    const others: DomainEvent[] = [
      { type: "APP_READY", id: "1" },
      { type: "MENU_OPENED", id: "2", menu: "send" },
      { type: "MENU_OPENED", id: "3", menu: "receive" },
      { type: "AVATAR_TAPPED", id: "4" },
      { type: "AMOUNT_ENTERED", id: "5" },
      { type: "PAYMENT_REVIEW_READY", id: "6" },
      { type: "PAYMENT_SUBMITTED", id: "7", operationId: "op" },
      { type: "PAYMENT_OUTCOME_UNKNOWN", id: "8", operationId: "op" },
      { type: "PAYMENT_FAILED", id: "9", operationId: "op2" },
      { type: "RECEIVE_SHOWN", id: "10" },
      { type: "WALLET_SYNC_STARTED", id: "11" },
      { type: "WALLET_SYNC_SUCCEEDED", id: "12", timestamp: "t" },
      { type: "WALLET_SYNC_FAILED", id: "13", errorCode: "x" },
      { type: "MAINTENANCE_REQUIRED", id: "14", severity: "urgent" },
      { type: "BACKUP_FAILED", id: "15" },
      { type: "VOICE_LISTENING", id: "16" },
      { type: "USER_IDLE", id: "17" },
    ];
    for (const e of others) {
      const o = new AvatarOrchestrator(clock);
      o.handle(e);
      expect(o.cue.action).not.toBe("celebrate");
      advance(10_000);
    }
  });

  it("shows 'sending', not success, while a payment is submitted or unknown", () => {
    const { clock } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    o.handle({ type: "PAYMENT_SUBMITTED", id: "1", operationId: "op" });
    expect(o.cue).toMatchObject({ action: "sending", lineKey: "avatar.sending" });
    o.handle({ type: "PAYMENT_OUTCOME_UNKNOWN", id: "2", operationId: "op" });
    expect(o.cue).toMatchObject({ action: "sending", emotion: "concerned", lineKey: "avatar.unknown" });
  });

  it("lets nothing less important interrupt a payment in flight", () => {
    const { clock } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    o.handle({ type: "PAYMENT_SUBMITTED", id: "1", operationId: "op" });
    o.handle({ type: "MENU_OPENED", id: "2", menu: "archive" });
    o.handle({ type: "AVATAR_TAPPED", id: "3" });
    expect(o.cue.action).toBe("sending");
    // A safety warning outranks it.
    o.handle({ type: "BACKUP_FAILED", id: "4" });
    expect(o.cue.priority).toBe(CuePriority.safety);
  });

  it("returns to idle after the hold time and drops stale cues on cancel", () => {
    const { clock, advance } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    o.handle({ type: "MENU_OPENED", id: "1", menu: "send" });
    expect(o.cue.action).toBe("point-left");
    advance(3000);
    expect(o.cue.id).toBe("idle");
    o.handle({ type: "PAYMENT_REVIEW_READY", id: "2" });
    o.cancel();
    expect(o.cue.id).toBe("idle");
  });

  it("does not let cancel() wipe a payment result", () => {
    const { clock } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    o.handle({ type: "PAYMENT_OUTCOME_UNKNOWN", id: "1", operationId: "op" });
    o.cancel();
    expect(o.cue.lineKey).toBe("avatar.unknown");
  });

  it("ignores rapid repeated taps", () => {
    const { clock, advance } = fakeClock();
    const o = new AvatarOrchestrator(clock);
    let n = 0;
    o.subscribe((c) => { if (c.lineKey === "avatar.tapped") n += 1; });
    for (let i = 0; i < 10; i++) {
      o.handle({ type: "AVATAR_TAPPED", id: `t${i}` });
      advance(50);
    }
    expect(n).toBe(1);
  });
});

describe("IdleDirector", () => {
  it("waits 5-10 seconds and never repeats a gesture back to back", () => {
    const seq = [0.6, 0.6, 0.6, 0.99, 0.99, 0.1];
    let i = 0;
    const d = new IdleDirector(() => seq[i++ % seq.length] ?? 0);
    for (let k = 0; k < 6; k++) {
      const delay = d.nextDelayMs();
      expect(delay).toBeGreaterThanOrEqual(5000);
      expect(delay).toBeLessThan(10000);
    }
    i = 0;
    const actions = Array.from({ length: 5 }, () => d.next().action);
    for (let k = 1; k < actions.length; k++) {
      if (actions[k] !== "blink") expect(actions[k]).not.toBe(actions[k - 1]);
    }
  });
});

describe("illustrated avatar frames", () => {
  // The renderer module pulls in images and Reanimated; the mapping is pure, so load it with those stubbed.
  jest.mock("react-native-reanimated", () => ({ __esModule: true, default: {}, Easing: { inOut: () => 0, sin: 0 } }));
  const { frameForCue, AVATAR_FRAMES } = require("@/game/IllustratedAvatarRenderer") as typeof import("@/game/IllustratedAvatarRenderer");

  it("has a picture for every emotion and never shows the celebration pose without the celebrate action", () => {
    const emotions = ["neutral", "happy", "curious", "thinking", "focused", "surprised", "sleepy", "concerned"] as const;
    const actions = ["idle", "blink", "float", "wave", "point-left", "point-right", "listen", "speak", "inspect", "prepare-send", "sending", "receive", "celebrate", "warn", "rest"] as const;
    for (const emotion of emotions) {
      for (const action of actions) {
        const frame = frameForCue({ emotion, action });
        expect(frame in AVATAR_FRAMES).toBe(true);
        expect(frame === "celebrate").toBe(action === "celebrate");
      }
    }
    expect(frameForCue({ emotion: "happy", action: "sending" })).toBe("happy");
    expect(frameForCue({ emotion: "concerned", action: "sending" })).toBe("concerned");
  });
});

describe("motion clips", () => {
  const { clipForCue } = require("@/game/avatarMotion") as typeof import("@/game/avatarMotion");
  it("plays the celebration only for a celebrate cue", () => {
    const actions = ["idle", "blink", "float", "wave", "point-left", "point-right", "listen", "speak", "inspect", "prepare-send", "sending", "receive", "warn", "rest"] as const;
    for (const action of actions) {
      for (const emotion of ["neutral", "happy", "curious", "thinking", "focused", "surprised", "sleepy", "concerned"] as const) {
        expect(clipForCue({ action, emotion })).not.toBe("celebrate");
      }
    }
    expect(clipForCue({ action: "celebrate", emotion: "happy" })).toBe("celebrate");
  });
  it("shows worry for warnings and never a cheerful clip", () => {
    expect(clipForCue({ action: "warn", emotion: "concerned" })).toBe("worry");
    expect(clipForCue({ action: "idle", emotion: "concerned" })).toBe("worry");
  });
  it("falls back to a still for poses without a clip", () => {
    expect(clipForCue({ action: "rest", emotion: "sleepy" })).toBeUndefined();
    expect(clipForCue({ action: "idle", emotion: "surprised" })).toBeUndefined();
    expect(clipForCue({ action: "idle", emotion: "neutral" })).toBe("idle");
  });
});
