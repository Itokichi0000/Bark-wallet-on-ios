import { errorMessage } from "@/domain/errors";
import type { EventBus } from "@/domain/events";
import type { PendingOperation } from "@/domain/payment";
import type {
  DestinationCheck, LightningInvoiceRequest, LightningReceiveState, MaxSendResult, PaymentMethod, SendDraft, SendQuote, SubmitOutcome, WalletAdapter, WalletChange,
} from "@/domain/wallet";
import type { WalletView } from "@/state/walletStore";
import { resolveOperation } from "./reconcile";

export interface SeedVault {
  has(): Promise<boolean>;
  read(): Promise<string | null>;
  store(mnemonic: string): Promise<void>;
  delete(): Promise<void>;
}

export interface OperationLog {
  put(op: PendingOperation): Promise<void>;
  get(operationId: string): Promise<PendingOperation | undefined>;
  unresolved(): Promise<PendingOperation[]>;
}

export interface BackupTrigger {
  /** Called after every wallet state change. Must not throw. */
  stateChanged(reason: string): void;
}

export interface WalletServiceDeps {
  adapter: WalletAdapter;
  bus: EventBus;
  seeds: SeedVault;
  ops: OperationLog;
  backup: BackupTrigger;
  view: { get(): WalletView };
  /** Device-owner check (biometrics / passcode) with the app's lock policy applied. */
  authorize?: (prompt: string) => Promise<{ ok: true } | { ok: false; reason: "cancelled" | "not-enrolled" | "failed" }>;
  now?: () => Date;
}

export type SeedReveal =
  | { ok: true; words: string[] }
  | { ok: false; reason: "cancelled" | "not-enrolled" | "failed" | "missing" };

/**
 * The single owner of the wallet's lifecycle. Screens call this; nothing
 * else opens the wallet, sends, or emits payment events.
 */
export class WalletService {
  private unsubscribe: (() => void) | undefined;
  private refreshing: Promise<boolean> | undefined;
  private sending = false;
  private opCounter = 0;

  constructor(private readonly d: WalletServiceDeps) {}

  private get view(): WalletView {
    return this.d.view.get();
  }
  private now(): Date {
    return this.d.now ? this.d.now() : new Date();
  }

  /** Decide where the app starts. Never creates a wallet on its own. */
  async boot(): Promise<void> {
    this.view.set({ lifecycle: "booting", fatalError: undefined });
    try {
      const [hasSeed, hasWallet] = await Promise.all([this.d.seeds.has(), this.d.adapter.exists()]);
      if (!hasSeed) {
        // A database without its seed is not something to paper over by making a new wallet.
        this.view.set(hasWallet
          ? { lifecycle: "error", fatalError: "orphan-database" }
          : { lifecycle: "not-created" });
        return;
      }
      if (!hasWallet) {
        this.view.set({ lifecycle: "error", fatalError: "seed-without-database" });
        return;
      }
      await this.openExisting();
    } catch (e) {
      this.view.set({ lifecycle: "error", fatalError: errorMessage(e) });
    }
  }

  private async openExisting(): Promise<void> {
    const mnemonic = await this.d.seeds.read();
    if (!mnemonic) throw new Error("seed-missing");
    this.view.set({ lifecycle: "opening" });
    await this.d.adapter.open(mnemonic, { create: false });
    await this.afterOpen();
  }

  private async afterOpen(): Promise<void> {
    this.view.set({ info: await this.d.adapter.info() });
    this.unsubscribe?.();
    this.unsubscribe = this.d.adapter.subscribe((c) => this.onChange(c));
    this.view.set({ lifecycle: "syncing" });
    await this.refresh();
    await this.reconcileAll();
    this.d.bus.emit({ type: "APP_READY", id: this.d.bus.nextId("ready") });
  }

  /** Create a brand-new wallet. The seed is stored before the wallet exists, so a wallet never outlives its seed. */
  async create(mnemonic: string): Promise<void> {
    if (await this.d.adapter.exists()) throw new Error("already-exists");
    this.view.set({ lifecycle: "creating" });
    await this.d.seeds.store(mnemonic);
    try {
      await this.d.adapter.open(mnemonic, { create: true });
    } catch (e) {
      if (!(await this.d.adapter.exists().catch(() => true))) await this.d.seeds.delete();
      this.view.set({ lifecycle: "not-created" });
      throw e;
    }
    await this.afterOpen();
    this.d.backup.stateChanged("wallet-created");
  }

  /** Open a database that a restore just put in place. */
  async openRestored(mnemonic: string): Promise<void> {
    this.view.set({ lifecycle: "recovering" });
    await this.d.seeds.store(mnemonic);
    try {
      await this.d.adapter.open(mnemonic, { create: false });
    } catch (e) {
      await this.d.seeds.delete();
      this.view.set({ lifecycle: "not-created" });
      throw e;
    }
    await this.afterOpen();
  }

  /** Sync and re-read everything. Returns whether the sync itself succeeded. */
  /**
   * `background` marks a sync nobody asked for (the scheduler's). It behaves the same,
   * except that a failure is announced only when it is news: the first one after a success.
   */
  refresh(opts: { background?: boolean } = {}): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.doRefresh(opts.background === true).finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  private async doRefresh(background: boolean): Promise<boolean> {
    const { adapter, bus } = this.d;
    this.view.set({ syncing: true });
    bus.emit({ type: "WALLET_SYNC_STARTED", id: bus.nextId("sync") });
    let syncOk = true;
    try {
      await adapter.sync();
    } catch (e) {
      syncOk = false;
      const alreadyKnown = background && this.view.lastSyncError !== undefined;
      this.view.set({ lastSyncError: errorMessage(e) });
      if (!alreadyKnown) bus.emit({ type: "WALLET_SYNC_FAILED", id: bus.nextId("sync"), errorCode: "sync-failed" });
    }
    try {
      // Local reads still work offline; their age is carried by balance.lastSyncedAt.
      const [balance, movements, vtxos, maintenance] = await Promise.all([
        adapter.getBalance(), adapter.listHistory(), adapter.listVtxos(), adapter.maintenanceStatus(),
      ]);
      const previous = this.view.maintenance?.severity ?? "none";
      this.view.set({
        balance, movements, vtxos, maintenance, syncing: false,
        lifecycle: syncOk ? "ready" : "degraded",
        ...(syncOk ? { lastSyncError: undefined } : {}),
      });
      if (syncOk) bus.emit({ type: "WALLET_SYNC_SUCCEEDED", id: bus.nextId("sync"), timestamp: this.now().toISOString() });
      if (maintenance.severity !== "none" && maintenance.severity !== previous) {
        bus.emit({ type: "MAINTENANCE_REQUIRED", id: bus.nextId("maint"), severity: maintenance.severity });
      }
    } catch (e) {
      this.view.set({ syncing: false, lifecycle: "degraded", lastSyncError: errorMessage(e) });
      return false;
    }
    return syncOk;
  }

  private onChange(change: WalletChange): void {
    const m = change.movement;
    if (m.direction === "incoming" && m.status === "succeeded") {
      // The avatar de-duplicates on movementId, so created+updated celebrate once.
      this.d.bus.emit({ type: "PAYMENT_RECEIVED", id: this.d.bus.nextId("recv"), movementId: m.id });
    }
    this.d.backup.stateChanged(change.kind);
    void this.refresh();
  }

  newArkAddress(): Promise<string> {
    return this.d.adapter.newArkAddress();
  }
  private lightningAnnounced = new Set<string>();
  get lightningAvailable(): boolean {
    return this.d.adapter.lightning;
  }
  newLightningInvoice(amountSats: string): Promise<LightningInvoiceRequest> {
    return this.d.adapter.newLightningInvoice(amountSats);
  }
  /**
   * Look at one incoming Lightning payment. When it has arrived the wallet is refreshed, and the
   * usual PAYMENT_RECEIVED follows from the wallet's own record of it, not from this call.
   */
  async checkLightningReceive(paymentHash: string): Promise<LightningReceiveState> {
    const state = await this.d.adapter.lightningReceiveState(paymentHash).catch((): LightningReceiveState => "unknown");
    if (state !== "settled" || this.lightningAnnounced.has(paymentHash)) return state;
    this.lightningAnnounced.add(paymentHash);
    await this.refresh({ background: true });
    // The SDK normally reports the new movement itself; this covers the case where it did not.
    // The avatar ignores a movement it has already celebrated.
    const arrived = this.view.movements.find((m) => m.method === "lightning" && m.direction === "incoming" && m.status === "succeeded");
    if (arrived) this.d.bus.emit({ type: "PAYMENT_RECEIVED", id: this.d.bus.nextId("recv"), movementId: arrived.id });
    return state;
  }
  validateDestination(input: string): Promise<DestinationCheck> {
    return this.d.adapter.validateDestination(input);
  }
  async quoteSend(draft: SendDraft): Promise<SendQuote> {
    const quote = await this.d.adapter.quoteSend(draft);
    // The review can be shown: announced here, once a real quote exists, not by the screen.
    this.d.bus.emit({ type: "PAYMENT_REVIEW_READY", id: this.d.bus.nextId("review") });
    return quote;
  }
  quoteMaxSend(method: PaymentMethod): Promise<MaxSendResult> {
    return this.d.adapter.quoteMaxSend(method);
  }

  newOperationId(): string {
    this.opCounter += 1;
    return `op-${this.now().getTime().toString(36)}-${this.opCounter}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  /**
   * Execute a reviewed, user-authorised payment exactly once.
   *
   * The operation is written to durable storage before the SDK is called.
   * Calling this again with the same operationId, or while another send is
   * in flight, does not send again.
   */
  async confirmSend(operationId: string, quote: SendQuote): Promise<SubmitOutcome> {
    const { adapter, bus, ops } = this.d;
    const existing = await ops.get(operationId);
    if (existing) return { status: existing.status === "submitting" ? "unknown" : existing.status, movementId: existing.movementId };
    if (this.sending) return { status: "failed", errorMessage: "another-send-in-progress" };
    this.sending = true;
    try {
      const history = await adapter.listHistory().catch(() => []);
      const maxId = history.reduce<bigint | null>((max, m) => {
        try {
          const id = BigInt(m.id);
          return max === null || id > max ? id : max;
        } catch {
          return max;
        }
      }, null);
      let op: PendingOperation = {
        operationId, method: quote.method, destination: quote.destination, amountSats: quote.amountSats,
        feeSats: quote.feeSats, movementIdBefore: maxId === null ? null : maxId.toString(),
        status: "submitting", createdAt: this.now().toISOString(),
      };
      await ops.put(op);
      bus.emit({ type: "PAYMENT_SUBMITTED", id: bus.nextId("pay"), operationId });

      let outcome: SubmitOutcome;
      try {
        outcome = await adapter.sendReviewedPayment(quote);
      } catch (e) {
        outcome = { status: "unknown", errorMessage: errorMessage(e) };
      }
      op = { ...op, status: outcome.status, movementId: outcome.movementId };
      await ops.put(op);

      if (outcome.status === "unknown") {
        // One read-only look at the wallet's own records. Never a resend.
        const resolved = await this.reconcile(op);
        outcome = { ...outcome, status: resolved.status === "submitting" ? "unknown" : resolved.status, movementId: resolved.movementId };
      } else {
        await this.settle(op);
        void this.refresh();
      }
      this.d.backup.stateChanged("send");
      return outcome;
    } finally {
      this.sending = false;
    }
  }

  private async settle(op: PendingOperation): Promise<PendingOperation> {
    const { bus, ops } = this.d;
    const final = op.status === "succeeded" || op.status === "failed";
    const next: PendingOperation = final ? { ...op, resolvedAt: op.resolvedAt ?? this.now().toISOString(), announced: true } : op;
    await ops.put(next);
    if (op.announced) return next;
    if (op.status === "succeeded") bus.emit({ type: "PAYMENT_SUCCEEDED", id: bus.nextId("pay"), operationId: op.operationId });
    else if (op.status === "failed") bus.emit({ type: "PAYMENT_FAILED", id: bus.nextId("pay"), operationId: op.operationId });
    // Pending is announced like unknown ("still checking, do not send again") so the "sending" cue never outlives the call.
    else if (op.status === "unknown" || op.status === "pending") bus.emit({ type: "PAYMENT_OUTCOME_UNKNOWN", id: bus.nextId("pay"), operationId: op.operationId });
    return next;
  }

  /** Look up what happened to one operation. Read-only with respect to funds. */
  async reconcile(op: PendingOperation): Promise<PendingOperation> {
    const syncOk = await this.refresh();
    const v = this.view;
    const resolution = resolveOperation(op.status === "submitting" ? { ...op, status: "unknown" } : op, {
      syncOk, movements: v.movements, pendingSats: v.balance?.pendingSats ?? "unknown",
    });
    return this.settle({ ...op, status: resolution.status, movementId: resolution.movementId });
  }

  async reconcileById(operationId: string): Promise<PendingOperation | undefined> {
    const op = await this.d.ops.get(operationId);
    return op ? this.reconcile(op) : undefined;
  }

  /** On start and on return to the foreground: resolve anything left open, e.g. by a kill mid-send. */
  async reconcileAll(): Promise<PendingOperation[]> {
    const open = await this.d.ops.unresolved();
    const out: PendingOperation[] = [];
    for (const op of open) out.push(await this.reconcile(op));
    return out;
  }

  unresolvedOperations(): Promise<PendingOperation[]> {
    return this.d.ops.unresolved();
  }

  /**
   * The only way a screen can obtain the stored seed. Authentication happens
   * here, on every call, so reaching the seed route directly cannot skip it.
   * The words are returned to the caller and kept nowhere else.
   */
  async revealSeed(prompt: string): Promise<SeedReveal> {
    if (!this.d.authorize) return { ok: false, reason: "failed" };
    const auth = await this.d.authorize(prompt);
    if (!auth.ok) return auth;
    const mnemonic = await this.d.seeds.read();
    if (!mnemonic) return { ok: false, reason: "missing" };
    return { ok: true, words: mnemonic.split(" ") };
  }

  async shutdown(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.d.adapter.close();
  }
}
