import { ACTIVE_NETWORK } from "@/config/network";
import { WalletError } from "@/domain/errors";
import { fromMoney, toMoney } from "@/domain/money";
import type {
  DestinationCheck, MaintenanceStatus, MaxSendResult, PaymentMethod, SendDraft, SendQuote,
  SubmitOutcome, WalletAdapter, WalletBalance, WalletChange, WalletInfo, WalletMovement, WalletVtxo,
} from "@/domain/wallet";

const MOCK_PREFIX = "tark1mock";
const MOCK_TIP = 250_000;

export interface MockOptions {
  initialSats?: bigint;
  /** Start as an already-created wallet (demo builds), so a stored seed opens it. */
  created?: boolean;
  feeSats?: bigint;
  now?: () => Date;
}

/**
 * An in-memory wallet for building and testing screens without the native
 * SDK. It moves no money and the app labels every screen MOCK while it is
 * active. Destinations script the outcome:
 *   tark1mock…fail…     -> definitive failure
 *   tark1mock…unknown…  -> the call "times out"; history later shows it paid
 *   tark1mock…lost…     -> the call "times out"; nothing was sent
 *   tark1mock…pending…  -> accepted, settles on the next sync
 */
export class MockWalletAdapter implements WalletAdapter {
  readonly isMock = true;
  private opened = false;
  private created = false;
  private spendable: bigint;
  private readonly fee: bigint;
  private readonly now: () => Date;
  private movements: WalletMovement[] = [];
  private vtxos: WalletVtxo[] = [];
  private nextId = 1;
  private addressIndex = 0;
  private lastSyncedAt: string | undefined;
  private listeners = new Set<(c: WalletChange) => void>();
  /** Counts SDK-level send calls, so tests can prove nothing was sent twice. */
  sendCalls = 0;
  failNextSync = false;

  constructor(opts: MockOptions = {}) {
    this.spendable = opts.initialSats ?? 0n;
    this.created = opts.created ?? false;
    this.fee = opts.feeSats ?? 0n;
    this.now = opts.now ?? (() => new Date());
    if (this.spendable > 0n) this.addVtxo(this.spendable, MOCK_TIP + 4000);
  }

  private addVtxo(amount: bigint, expiryHeight: number): void {
    const blocksToExpiry = expiryHeight - MOCK_TIP;
    this.vtxos.push({
      id: `mockvtxo${this.vtxos.length + 1}:0`,
      amountSats: toMoney(amount),
      expiryHeight,
      blocksToExpiry,
      state: "spendable",
      health: blocksToExpiry <= 432 ? "refresh-soon" : "ok",
      kind: "mock",
    });
  }

  private record(m: Omit<WalletMovement, "id" | "createdAt" | "rawStatus" | "feeSats"> & { feeSats?: string }): WalletMovement {
    const movement: WalletMovement = {
      ...m,
      id: String(this.nextId++),
      feeSats: m.feeSats ?? "0",
      rawStatus: m.status === "succeeded" ? "successful" : m.status,
      createdAt: this.now().toISOString(),
    };
    this.movements.unshift(movement);
    for (const l of [...this.listeners]) l({ kind: "movement-created", movement });
    return movement;
  }

  private requireOpen(): void {
    if (!this.opened) throw new WalletError("not-open");
  }

  /** Demo/test helper: pretend sats arrived. */
  simulateIncoming(sats: bigint): WalletMovement {
    this.requireOpen();
    this.spendable += sats;
    this.addVtxo(sats, MOCK_TIP + 4320);
    return this.record({ method: "ark", kind: "mock.receive", direction: "incoming", amountSats: toMoney(sats), status: "succeeded", counterparty: `${MOCK_PREFIX}self` });
  }

  async exists(): Promise<boolean> {
    return this.created;
  }
  async open(_mnemonic: string, opts: { create: boolean }): Promise<void> {
    if (opts.create && this.created) throw new WalletError("already-exists");
    if (!opts.create && !this.created) throw new WalletError("no-wallet");
    this.created = true;
    this.opened = true;
  }
  async close(): Promise<void> {
    this.opened = false;
  }
  async info(): Promise<WalletInfo> {
    this.requireOpen();
    return { network: ACTIVE_NETWORK, fingerprint: "mock0000", serverAddress: "mock://no-server", sdkVersion: "mock", isMock: true };
  }
  async sync(): Promise<void> {
    this.requireOpen();
    if (this.failNextSync) {
      this.failNextSync = false;
      throw new Error("mock: network unreachable");
    }
    for (const m of this.movements) {
      if (m.status === "pending") {
        m.status = "succeeded";
        m.rawStatus = "successful";
        m.completedAt = this.now().toISOString();
        for (const l of [...this.listeners]) l({ kind: "movement-updated", movement: m });
      }
    }
    this.lastSyncedAt = this.now().toISOString();
  }
  async getBalance(): Promise<WalletBalance> {
    this.requireOpen();
    return { spendableSats: toMoney(this.spendable), pendingSats: "0", needsRefreshSats: "0", totalSats: toMoney(this.spendable), lastSyncedAt: this.lastSyncedAt };
  }
  async newArkAddress(): Promise<string> {
    this.requireOpen();
    this.addressIndex += 1;
    return `${MOCK_PREFIX}receive${String(this.addressIndex).padStart(4, "0")}notarealaddress`;
  }
  async validateDestination(input: string): Promise<DestinationCheck> {
    this.requireOpen();
    const text = input.trim().toLowerCase();
    if (text === "") return { valid: false, reason: "empty" };
    if (text.startsWith("ark1")) return { valid: false, reason: "wrong-network" };
    if (text.startsWith("lntbs") || text.startsWith("lnbc")) return { valid: false, reason: "method-not-enabled" };
    if (!text.startsWith(MOCK_PREFIX)) return { valid: false, reason: "unrecognised" };
    return { valid: true, method: "ark", destination: text };
  }
  async quoteSend(draft: SendDraft): Promise<SendQuote> {
    this.requireOpen();
    const amount = fromMoney(draft.amountSats);
    if (amount <= 0n) throw new WalletError("quote-unavailable");
    const total = amount + this.fee;
    if (total > this.spendable) throw new WalletError("insufficient-funds", toMoney(total - this.spendable));
    return {
      method: draft.method, network: ACTIVE_NETWORK, destination: draft.destination,
      amountSats: toMoney(amount), feeSats: toMoney(this.fee), totalDebitSats: toMoney(total),
      balanceAfterSats: toMoney(this.spendable - total), feeIsEstimate: false, quotedAt: this.now().toISOString(),
    };
  }
  async quoteMaxSend(_method: PaymentMethod): Promise<MaxSendResult> {
    this.requireOpen();
    if (this.spendable <= 0n) return { ok: false, reason: "nothing-spendable" };
    if (this.spendable <= this.fee) return { ok: false, reason: "fee-exceeds-balance" };
    return { ok: true, amountSats: toMoney(this.spendable - this.fee), feeSats: toMoney(this.fee) };
  }
  async sendReviewedPayment(quote: SendQuote): Promise<SubmitOutcome> {
    this.requireOpen();
    this.sendCalls += 1;
    const dest = quote.destination;
    if (dest.includes("fail")) return { status: "failed", errorMessage: "mock: the server rejected this payment" };
    if (dest.includes("lost")) return { status: "unknown", errorMessage: "mock: request timed out" };
    const total = fromMoney(quote.totalDebitSats);
    if (total > this.spendable) return { status: "failed", errorMessage: "mock: insufficient funds" };
    this.spendable -= total;
    const pending = dest.includes("pending");
    const movement = this.record({
      method: "ark", kind: "mock.send", direction: "outgoing", amountSats: quote.amountSats, feeSats: quote.feeSats,
      status: pending ? "pending" : "succeeded", counterparty: dest,
    });
    if (dest.includes("unknown")) return { status: "unknown", errorMessage: "mock: request timed out" };
    return { status: pending ? "pending" : "succeeded", movementId: movement.id };
  }
  async listHistory(): Promise<WalletMovement[]> {
    this.requireOpen();
    return this.movements.map((m) => ({ ...m }));
  }
  async listVtxos(): Promise<WalletVtxo[]> {
    this.requireOpen();
    return this.vtxos.map((v) => ({ ...v }));
  }
  async maintenanceStatus(): Promise<MaintenanceStatus> {
    this.requireOpen();
    const soon = this.vtxos.some((v) => v.health !== "ok");
    return { tipHeight: MOCK_TIP, vtxosToRefresh: 0, severity: soon ? "notice" : "none" };
  }
  subscribe(listener: (change: WalletChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async quiesce<T>(_whileStopped: (dbFile: string) => Promise<T>): Promise<T> {
    throw new WalletError("sdk", "The mock wallet has no database to back up.");
  }
}
