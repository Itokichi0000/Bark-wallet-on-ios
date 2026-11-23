/**
 * Keeps the wallet fresh without the user having to ask.
 *
 * - While the app is in the foreground and the wallet is open: one sync every `idleMs`.
 * - While a screen is waiting for something (the receive screen): every `watchMs`.
 * - After a failed sync the gap doubles, up to `maxMs`, and resets on the next success.
 * - Nothing runs in the background, while the wallet is closed, or while a sync is in flight.
 *
 * It only ever calls `refresh`, which reads; it cannot send or move funds.
 */
export interface SyncSchedulerDeps {
  refresh: () => Promise<boolean>;
  /** Is there an open wallet to sync? */
  isOpen: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  idleMs?: number;
  watchMs?: number;
  maxMs?: number;
}

export class SyncScheduler {
  private readonly idleMs: number;
  private readonly watchMs: number;
  private readonly maxMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private timer: unknown;
  private active = false;
  private watchers = 0;
  private failures = 0;

  constructor(private readonly d: SyncSchedulerDeps) {
    this.idleMs = d.idleMs ?? 60_000;
    this.watchMs = d.watchMs ?? 8_000;
    this.maxMs = d.maxMs ?? 5 * 60_000;
    this.setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = d.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Call when the app comes to the foreground (and once at start-up). */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.schedule();
  }

  /** Call when the app leaves the foreground. */
  stop(): void {
    this.active = false;
    this.cancel();
  }

  /** A screen is waiting for news. Returns the function that ends the wait. Syncs once right away. */
  watch(): () => void {
    this.watchers += 1;
    this.failures = 0;
    if (this.active) {
      this.cancel();
      void this.tick();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.watchers -= 1;
      if (this.active) this.schedule();
    };
  }

  /** Next gap in ms; exposed for tests. */
  delayMs(): number {
    const base = this.watchers > 0 ? this.watchMs : this.idleMs;
    return Math.min(this.maxMs, base * 2 ** Math.min(this.failures, 10));
  }

  private cancel(): void {
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    this.cancel();
    this.timer = this.setTimer(() => void this.tick(), this.delayMs());
  }

  private async tick(): Promise<void> {
    this.timer = undefined;
    if (!this.active) return;
    if (this.d.isOpen()) {
      const ok = await this.d.refresh().catch(() => false);
      this.failures = ok ? 0 : this.failures + 1;
    }
    if (this.active && this.timer === undefined) this.schedule();
  }
}
