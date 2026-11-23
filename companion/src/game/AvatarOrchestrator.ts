import { type AvatarCue, CuePriority, IDLE_CUE } from "@/domain/avatar";
import type { DomainEvent } from "@/domain/events";

type Listener = (cue: AvatarCue) => void;
type Timer = ReturnType<typeof setTimeout>;

export interface OrchestratorClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): Timer;
  clearTimeout(t: Timer): void;
}

const realClock: OrchestratorClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

const TAP_COOLDOWN_MS = 900;
const SEEN_EVENT_LIMIT = 200;

/**
 * Turns domain events into the single cue the avatar is showing.
 *
 * It only reads events; it holds no wallet state and cannot cause a payment.
 * A cue is a *derived display*. The celebrate cue exists only as the mapping
 * of PAYMENT_SUCCEEDED / PAYMENT_RECEIVED, which only use cases emit.
 */
export class AvatarOrchestrator {
  private current: AvatarCue = IDLE_CUE;
  private listeners = new Set<Listener>();
  private timer: Timer | undefined;
  private seen: string[] = [];
  private lastTapAt = -Infinity;

  constructor(private readonly clock: OrchestratorClock = realClock) {}

  get cue(): AvatarCue {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handle(event: DomainEvent): void {
    const cue = this.cueFor(event);
    if (cue) this.play(cue);
  }

  /** Play a cue unless something more important is on screen. Returns whether it played. */
  play(cue: AvatarCue): boolean {
    if (cue.eventId !== undefined) {
      if (this.seen.includes(cue.eventId)) return false;
    }
    const busy = this.current.id !== IDLE_CUE.id;
    if (busy && cue.priority < this.current.priority) return false;
    // A payment in flight holds the stage against its peers, except for the result of a payment, which must always land.
    const isPaymentResult = /^(paid|failed|unknown):/.test(cue.eventId ?? "");
    if (busy && cue.priority === this.current.priority && !this.current.interruptible && !isPaymentResult) return false;
    if (cue.eventId !== undefined) {
      this.seen.push(cue.eventId);
      if (this.seen.length > SEEN_EVENT_LIMIT) this.seen.shift();
    }
    this.set(cue);
    return true;
  }

  /** Drop whatever is playing, e.g. when leaving a scene, so stale lines never appear later. */
  cancel(maxPriority: number = CuePriority.paymentResult - 1): void {
    if (this.current.priority <= maxPriority) this.set(IDLE_CUE);
  }

  dispose(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.listeners.clear();
  }

  private set(cue: AvatarCue): void {
    if (this.timer !== undefined) {
      this.clock.clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.current = cue;
    if (cue.holdMs > 0) {
      this.timer = this.clock.setTimeout(() => {
        this.timer = undefined;
        if (this.current === cue) this.set(IDLE_CUE);
      }, cue.holdMs);
    }
    for (const l of [...this.listeners]) l(cue);
  }

  private cueFor(e: DomainEvent): AvatarCue | undefined {
    const base = { id: e.id, eventId: e.id };
    switch (e.type) {
      case "APP_READY":
        return { ...base, emotion: "happy", action: "wave", lineKey: "avatar.welcome", priority: CuePriority.menu, interruptible: true, holdMs: 3200 };
      case "AVATAR_TAPPED": {
        const now = this.clock.now();
        if (now - this.lastTapAt < TAP_COOLDOWN_MS) return undefined;
        this.lastTapAt = now;
        return { ...base, emotion: "surprised", action: "wave", lineKey: "avatar.tapped", soundKey: "tap", priority: CuePriority.menu, interruptible: true, holdMs: 1800 };
      }
      case "MENU_OPENED":
        return {
          ...base,
          emotion: e.menu === "assets" ? "curious" : "happy",
          action: e.menu === "send" || e.menu === "assets" ? "point-left" : e.menu === "receive" ? "receive" : "point-right",
          lineKey: `avatar.menu.${e.menu}`,
          soundKey: "menu",
          priority: CuePriority.menu,
          interruptible: true,
          holdMs: 2600,
        };
      case "RECEIVE_SHOWN":
        return { ...base, emotion: "happy", action: "receive", lineKey: "avatar.receive", priority: CuePriority.menu, interruptible: true, holdMs: 0 };
      case "AMOUNT_ENTERED":
        return { ...base, emotion: "focused", action: "inspect", lineKey: "avatar.amount", priority: CuePriority.sendInput, interruptible: true, holdMs: 2000 };
      case "PAYMENT_REVIEW_READY":
        return { ...base, emotion: "focused", action: "prepare-send", lineKey: "avatar.review", priority: CuePriority.sendInput, interruptible: true, holdMs: 0 };
      case "PAYMENT_SUBMITTED":
        return { ...base, emotion: "focused", action: "sending", lineKey: "avatar.sending", priority: CuePriority.paymentResult, interruptible: false, holdMs: 0 };
      case "PAYMENT_SUCCEEDED":
        return { ...base, eventId: `paid:${e.operationId}`, emotion: "happy", action: "celebrate", lineKey: "avatar.sent", soundKey: "success", priority: CuePriority.paymentResult, interruptible: true, holdMs: 4000 };
      case "PAYMENT_FAILED":
        return { ...base, eventId: `failed:${e.operationId}`, emotion: "concerned", action: "warn", lineKey: "avatar.failed", priority: CuePriority.paymentResult, interruptible: true, holdMs: 5000 };
      case "PAYMENT_OUTCOME_UNKNOWN":
        return { ...base, eventId: `unknown:${e.operationId}`, emotion: "concerned", action: "sending", lineKey: "avatar.unknown", priority: CuePriority.paymentResult, interruptible: true, holdMs: 0 };
      case "PAYMENT_RECEIVED":
        return { ...base, eventId: `recv:${e.movementId}`, emotion: "happy", action: "celebrate", lineKey: "avatar.received", soundKey: "success", priority: CuePriority.paymentResult, interruptible: true, holdMs: 4000 };
      case "WALLET_SYNC_FAILED":
        return { ...base, emotion: "concerned", action: "warn", lineKey: "avatar.syncFailed", priority: CuePriority.mistake, interruptible: true, holdMs: 4000 };
      case "MAINTENANCE_REQUIRED":
        return { ...base, emotion: "concerned", action: "inspect", lineKey: e.severity === "urgent" ? "avatar.maintenanceUrgent" : "avatar.maintenance", priority: CuePriority.safety, interruptible: true, holdMs: 6000 };
      case "BACKUP_FAILED":
        return { ...base, emotion: "concerned", action: "warn", lineKey: "avatar.backupFailed", priority: CuePriority.safety, interruptible: true, holdMs: 6000 };
      case "VOICE_LISTENING":
        return { ...base, emotion: "curious", action: "listen", lineKey: "avatar.listening", priority: CuePriority.voice, interruptible: true, holdMs: 0 };
      case "USER_IDLE":
        return { ...base, emotion: "sleepy", action: "rest", priority: CuePriority.idle, interruptible: true, holdMs: 0 };
      case "WALLET_SYNC_STARTED":
      case "WALLET_SYNC_SUCCEEDED":
        return undefined;
    }
  }
}
