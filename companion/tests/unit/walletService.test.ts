import { type DomainEvent, EventBus } from "@/domain/events";
import type { PendingOperation } from "@/domain/payment";
import type { SendQuote } from "@/domain/wallet";
import { AvatarOrchestrator } from "@/game/AvatarOrchestrator";
import { MockWalletAdapter } from "@/infrastructure/mock/MockWalletAdapter";
import { PendingOperationStore } from "@/infrastructure/storage/PendingOperationStore";
import type { WalletView } from "@/state/walletStore";
import { WalletService } from "@/usecases/WalletService";

const avatars: AvatarOrchestrator[] = [];
afterEach(() => { for (const a of avatars.splice(0)) a.dispose(); });

const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function setup(opts: { initialSats?: bigint; feeSats?: bigint; auth?: { ok: true } | { ok: false; reason: "cancelled" | "not-enrolled" | "failed" } } = {}) {
  let authCalls = 0;
  const adapter = new MockWalletAdapter({ initialSats: opts.initialSats ?? 10_000n, feeSats: opts.feeSats ?? 0n });
  const bus = new EventBus();
  const events: DomainEvent[] = [];
  bus.on((e) => events.push(e));
  const avatar = new AvatarOrchestrator();
  avatars.push(avatar);
  bus.on((e) => avatar.handle(e));
  let seed: string | null = null;
  const kv = new Map<string, string>();
  const ops = new PendingOperationStore({ getItem: async (k) => kv.get(k) ?? null, setItem: async (k, v) => void kv.set(k, v) });
  const backups: string[] = [];
  const state: WalletView = {
    lifecycle: "booting", syncing: false, movements: [], vtxos: [],
    backup: { status: "never", generation: 0, exportedGeneration: 0 },
    set(patch) { Object.assign(state, patch); },
  };
  const service = new WalletService({
    adapter, bus, ops,
    seeds: {
      has: async () => seed !== null, read: async () => seed,
      store: async (m) => { if (seed !== null) throw new Error("exists"); seed = m; },
      delete: async () => { seed = null; },
    },
    backup: { stateChanged: (r) => void backups.push(r) },
    view: { get: () => state },
    authorize: async () => { authCalls += 1; return opts.auth ?? { ok: true }; },
  });
  const types = () => events.map((e) => e.type);
  const quoteFor = (destination: string, amount = "500") => service.quoteSend({ method: "ark", destination, amountSats: amount });
  return { adapter, bus, events, types, avatar, ops, service, state, backups, quoteFor, seedValue: () => seed, authCalls: () => authCalls };
}

describe("WalletService lifecycle", () => {
  it("never creates a wallet on boot", async () => {
    const t = setup();
    await t.service.boot();
    expect(t.state.lifecycle).toBe("not-created");
    expect(await t.adapter.exists()).toBe(false);
    expect(t.seedValue()).toBeNull();
  });

  it("creates, stores the seed, syncs and reports ready", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    expect(t.state.lifecycle).toBe("ready");
    expect(t.seedValue()).toBe(MNEMONIC);
    expect(t.state.balance?.spendableSats).toBe("10000");
    expect(t.state.balance?.lastSyncedAt).toBeDefined();
    expect(t.types()).toContain("APP_READY");
    expect(t.backups).toContain("wallet-created");
  });

  it("refuses to boot a database that has no seed, instead of making a new wallet", async () => {
    const t = setup();
    await t.adapter.open(MNEMONIC, { create: true });
    await t.adapter.close();
    await t.service.boot();
    expect(t.state.lifecycle).toBe("error");
    expect(t.state.fatalError).toBe("orphan-database");
  });

  it("keeps the last numbers and says degraded when a sync fails", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const syncedAt = t.state.balance?.lastSyncedAt;
    t.adapter.failNextSync = true;
    expect(await t.service.refresh()).toBe(false);
    expect(t.state.lifecycle).toBe("degraded");
    expect(t.state.balance?.lastSyncedAt).toBe(syncedAt);
    expect(t.types()).toContain("WALLET_SYNC_FAILED");
  });
});

describe("WalletService sending", () => {
  it("sends once and announces success only after the wallet confirms it", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mockalice");
    expect(t.types()).not.toContain("PAYMENT_SUCCEEDED");
    const outcome = await t.service.confirmSend("op-a", quote);
    expect(outcome.status).toBe("succeeded");
    expect(t.adapter.sendCalls).toBe(1);
    const order = t.types().filter((x) => x.startsWith("PAYMENT_"));
    expect(order).toEqual(["PAYMENT_REVIEW_READY", "PAYMENT_SUBMITTED", "PAYMENT_SUCCEEDED"]);
    expect(t.backups).toContain("send");
  });

  it("does not send twice for the same operation id", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mockalice");
    await t.service.confirmSend("op-a", quote);
    const again = await t.service.confirmSend("op-a", quote);
    expect(again.status).toBe("succeeded");
    expect(t.adapter.sendCalls).toBe(1);
    expect(t.types().filter((x) => x === "PAYMENT_SUCCEEDED")).toHaveLength(1);
  });

  it("does not send a second payment while one is in flight", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mockalice");
    const [a, b] = await Promise.all([t.service.confirmSend("op-a", quote), t.service.confirmSend("op-b", quote)]);
    expect(t.adapter.sendCalls).toBe(1);
    expect([a.status, b.status].sort()).toEqual(["failed", "succeeded"]);
  });

  it("records the operation before calling the SDK", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mockalice");
    let seenAtCall: PendingOperation | undefined;
    const original = t.adapter.sendReviewedPayment.bind(t.adapter);
    t.adapter.sendReviewedPayment = async (q: SendQuote) => {
      seenAtCall = await t.ops.get("op-a");
      return original(q);
    };
    await t.service.confirmSend("op-a", quote);
    expect(seenAtCall?.status).toBe("submitting");
  });

  it("a timeout that actually paid is found by reconciliation, without resending", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const outcome = await t.service.confirmSend("op-u", await t.quoteFor("tark1mockunknownbob"));
    expect(t.adapter.sendCalls).toBe(1);
    expect(outcome.status).toBe("succeeded");
    expect(t.state.balance?.spendableSats).toBe("9500");
    expect(t.types().filter((x) => x === "PAYMENT_SUCCEEDED")).toHaveLength(1);
  });

  it("a timeout with no record and a clean sync is a definitive failure", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const outcome = await t.service.confirmSend("op-l", await t.quoteFor("tark1mocklostcarol"));
    expect(outcome.status).toBe("failed");
    expect(t.adapter.sendCalls).toBe(1);
    expect(t.state.balance?.spendableSats).toBe("10000");
    expect(t.types()).toContain("PAYMENT_FAILED");
    expect(t.types()).not.toContain("PAYMENT_SUCCEEDED");
  });

  it("a timeout while offline stays unknown, is never retried, and resolves later", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mocklostdave");
    t.adapter.failNextSync = true; // the reconciliation sync fails too, so there is no evidence either way
    const outcome = await t.service.confirmSend("op-o", quote);
    expect(outcome.status).toBe("unknown");
    expect(t.types()).toContain("PAYMENT_OUTCOME_UNKNOWN");
    expect(t.types()).not.toContain("PAYMENT_SUCCEEDED");
    expect(t.types()).not.toContain("PAYMENT_FAILED");
    expect(await t.service.unresolvedOperations()).toHaveLength(1);

    // Back online, e.g. on the next app start: a clean sync shows it never left.
    const resolved = await t.service.reconcileAll();
    expect(resolved[0]?.status).toBe("failed");
    expect(t.adapter.sendCalls).toBe(1);
    expect(await t.service.unresolvedOperations()).toHaveLength(0);
    expect(t.types()).not.toContain("PAYMENT_SUCCEEDED");
  });

  it("a locally recorded successful movement is accepted as proof even when the follow-up sync fails", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const quote = await t.quoteFor("tark1mockunknowndave");
    t.adapter.failNextSync = true;
    const outcome = await t.service.confirmSend("op-o2", quote);
    expect(outcome.status).toBe("succeeded");
    expect(t.adapter.sendCalls).toBe(1);
  });

  it("an operation left 'submitting' by a kill is reconciled on restart, not resent", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    await t.ops.put({
      operationId: "op-k", method: "ark", destination: "tark1mockerin", amountSats: "500", feeSats: "0",
      movementIdBefore: null, status: "submitting", createdAt: new Date().toISOString(),
    });
    const resolved = await t.service.reconcileAll();
    expect(resolved[0]?.status).toBe("failed"); // nothing in history, clean sync: it never left
    expect(t.adapter.sendCalls).toBe(0);
  });

  it("pending is neither success nor failure, then settles", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const outcome = await t.service.confirmSend("op-p", await t.quoteFor("tark1mockpendingfrank"));
    expect(outcome.status).toBe("pending");
    expect(t.types()).not.toContain("PAYMENT_SUCCEEDED");
    expect(t.types()).not.toContain("PAYMENT_FAILED");
    const resolved = await t.service.reconcileAll();
    expect(resolved[0]?.status).toBe("succeeded");
    expect(t.types().filter((x) => x === "PAYMENT_SUCCEEDED")).toHaveLength(1);
  });

  it("a definitive failure reports failure and leaves the balance alone", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const outcome = await t.service.confirmSend("op-f", await t.quoteFor("tark1mockfailgina"));
    expect(outcome.status).toBe("failed");
    expect(t.state.balance?.spendableSats).toBe("10000");
  });

  it("quotes include the fee, and MAX leaves room for it", async () => {
    const t = setup({ initialSats: 1000n, feeSats: 30n });
    await t.service.create(MNEMONIC);
    const max = await t.service.quoteMaxSend("ark");
    expect(max).toEqual({ ok: true, amountSats: "970", feeSats: "30" });
    const quote = await t.quoteFor("tark1mockalice", "970");
    expect(quote).toMatchObject({ feeSats: "30", totalDebitSats: "1000", balanceAfterSats: "0" });
    await expect(t.quoteFor("tark1mockalice", "971")).rejects.toMatchObject({ code: "insufficient-funds", message: "1" });
  });

  it("celebrates an incoming payment once, even if the SDK reports it twice", async () => {
    const t = setup({ initialSats: 0n });
    await t.service.create(MNEMONIC);
    let celebrations = 0;
    t.avatar.subscribe((cue) => { if (cue.action === "catch") celebrations += 1; });
    const m = t.adapter.simulateIncoming(2_000n);
    t.bus.emit({ type: "PAYMENT_RECEIVED", id: "dup", movementId: m.id });
    expect(celebrations).toBe(1);
    expect(t.backups).toContain("movement-created");
  });
});

describe("WalletService seed reveal", () => {
  it("authenticates on every call and returns the words only on success", async () => {
    const t = setup();
    await t.service.create(MNEMONIC);
    const first = await t.service.revealSeed("p");
    const second = await t.service.revealSeed("p");
    expect(first).toEqual({ ok: true, words: MNEMONIC.split(" ") });
    expect(second.ok).toBe(true);
    expect(t.authCalls()).toBe(2);
  });

  it("returns nothing when authentication is cancelled, fails, or the device has no lock", async () => {
    for (const reason of ["cancelled", "failed", "not-enrolled"] as const) {
      const t = setup({ auth: { ok: false, reason } });
      await t.service.create(MNEMONIC);
      const r = await t.service.revealSeed("p");
      expect(r).toEqual({ ok: false, reason });
      expect(JSON.stringify(r)).not.toContain("abandon");
    }
  });

  it("reports a missing seed instead of inventing one", async () => {
    const t = setup();
    expect(await t.service.revealSeed("p")).toEqual({ ok: false, reason: "missing" });
  });
});
