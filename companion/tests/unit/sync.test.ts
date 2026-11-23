import { SyncScheduler } from "@/usecases/SyncScheduler";
import { homeHint } from "@/game/homeHint";

function harness(results: boolean[] = []) {
  const timers: { fn: () => void; ms: number }[] = [];
  let open = true;
  let calls = 0;
  const s = new SyncScheduler({
    refresh: async () => { calls += 1; return results.shift() ?? true; },
    isOpen: () => open,
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimer: (h) => { const i = timers.indexOf(h as never); if (i >= 0) timers.splice(i, 1); },
    idleMs: 60_000, watchMs: 8_000, maxMs: 300_000,
  });
  const fire = async () => { const t = timers.shift(); t?.fn(); await new Promise((r) => setImmediate(r)); };
  return { s, timers, fire, calls: () => calls, setOpen: (v: boolean) => { open = v; } };
}

describe("SyncScheduler", () => {
  it("syncs on the idle interval while active and stops when told", async () => {
    const h = harness();
    h.s.start();
    expect(h.timers.map((t) => t.ms)).toEqual([60_000]);
    await h.fire();
    expect(h.calls()).toBe(1);
    expect(h.timers.map((t) => t.ms)).toEqual([60_000]);
    h.s.stop();
    expect(h.timers).toHaveLength(0);
  });

  it("syncs at once and faster while a screen is watching, then returns to idle", async () => {
    const h = harness();
    h.s.start();
    const release = h.s.watch();
    await new Promise((r) => setImmediate(r));
    expect(h.calls()).toBe(1);
    expect(h.timers.map((t) => t.ms)).toEqual([8_000]);
    release();
    release();
    expect(h.timers.map((t) => t.ms)).toEqual([60_000]);
  });

  it("backs off after failures and resets on success", async () => {
    const h = harness([false, false, true]);
    h.s.start();
    await h.fire();
    expect(h.timers[0]?.ms).toBe(120_000);
    await h.fire();
    expect(h.timers[0]?.ms).toBe(240_000);
    await h.fire();
    expect(h.timers[0]?.ms).toBe(60_000);
  });

  it("never syncs a closed wallet or while stopped", async () => {
    const h = harness();
    h.setOpen(false);
    h.s.start();
    await h.fire();
    expect(h.calls()).toBe(0);
    h.s.stop();
    h.s.watch();
    await new Promise((r) => setImmediate(r));
    expect(h.calls()).toBe(0);
  });
});

describe("homeHint", () => {
  const base = {
    view: { lifecycle: "ready" as const, balance: { spendableSats: "1000", pendingSats: "0", needsRefreshSats: "0", totalSats: "1000" }, maintenance: undefined, backup: { status: "ok" as never, generation: 1, exportedGeneration: 1 }, lastSyncError: undefined, movements: [] as never[] },
    seedBackupConfirmed: true, isMock: false, hour: 9,
  };
  it("puts an unresolved payment above everything else", () => {
    const view = { ...base.view, lastSyncError: "x", movements: [{ status: "unknown", direction: "outgoing" }] as never[] };
    expect(homeHint({ ...base, view }).lineKey).toBe("hint.pending");
  });
  it("reminds about the seed, then the backup export, before suggesting payments", () => {
    expect(homeHint({ ...base, seedBackupConfirmed: false }).lineKey).toBe("hint.seed");
    expect(homeHint({ ...base, view: { ...base.view, backup: { ...base.view.backup, generation: 2 } } }).lineKey).toBe("hint.backup");
  });
  it("suggests receiving on an empty wallet and sending once there are funds", () => {
    expect(homeHint({ ...base, view: { ...base.view, balance: undefined } })).toEqual({ lineKey: "hint.receiveFirst", route: "/receive" });
    expect(homeHint(base).lineKey).toBe("hint.sendFirst");
  });
  it("falls back to a greeting", () => {
    const view = { ...base.view, movements: [{ status: "succeeded", direction: "outgoing" }] as never[] };
    expect(homeHint({ ...base, view }).lineKey).toBe("hint.morning");
    expect(homeHint({ ...base, view, hour: 20 }).lineKey).toBe("hint.evening");
  });
});
