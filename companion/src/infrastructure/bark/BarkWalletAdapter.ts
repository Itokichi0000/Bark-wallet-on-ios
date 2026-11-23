import {
  Config,
  type Movement,
  Network,
  PaymentMethod_Tags,
  PaymentMethodParsingError_Tags,
  VtxoState_Tags,
  Wallet,
  type WalletLike,
  WalletNotification_Tags,
  WalletNotifications,
  WalletOpenArgs,
  decodeBolt11Invoice,
  readDatadirInfo,
  walletExists,
} from "@secondts/bark-react-native";
import { Directory, Paths } from "expo-file-system";
import { WalletError, errorMessage } from "@/domain/errors";
import { fromMoney, toMoney } from "@/domain/money";
import {
  type DestinationCheck,
  ENABLED_SEND_METHODS,
  type MaintenanceStatus,
  type MaxSendResult,
  type PaymentMethod,
  type SendDraft,
  type SendQuote,
  type SubmitOutcome,
  type WalletAdapter,
  type WalletBalance,
  type WalletChange,
  type WalletInfo,
  type WalletMovement,
  type WalletVtxo,
} from "@/domain/wallet";
import { BARK_SDK_VERSION, SIGNET } from "./barkConfig";
import { maintenanceSeverity, mapMovement, mapMovementStatus, vtxoHealth } from "./mapping";

/**
 * The only file that talks to the Bark SDK. Every method used here was
 * checked against the installed 0.28.0 type definitions; see
 * docs/SDK_COMPATIBILITY.md for what has and has not been exercised on a
 * device.
 */
export class BarkWalletAdapter implements WalletAdapter {
  readonly isMock = false;
  private wallet: WalletLike | undefined;
  private lastSyncedAt: string | undefined;
  private tipHeight: number | undefined;
  /** Serialises sends and database snapshots so a copy never races a write. */
  private exclusive: Promise<unknown> = Promise.resolve();

  private datadir(): string {
    return new Directory(Paths.document, SIGNET.datadirName).uri;
  }

  private config(): Config {
    return Config.create({ serverAddress: SIGNET.serverAddress, esploraAddress: SIGNET.esploraAddress });
  }

  private require(): WalletLike {
    if (!this.wallet) throw new WalletError("not-open");
    return this.wallet;
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.exclusive.then(fn, fn);
    this.exclusive = next.catch(() => undefined);
    return next;
  }

  async exists(): Promise<boolean> {
    return walletExists(this.datadir());
  }

  async open(mnemonic: string, opts: { create: boolean }): Promise<void> {
    if (this.wallet) return;
    const present = walletExists(this.datadir());
    if (opts.create && present) throw new WalletError("already-exists");
    if (!opts.create && !present) throw new WalletError("no-wallet");
    const dir = new Directory(Paths.document, SIGNET.datadirName);
    if (!dir.exists) dir.create({ intermediates: true });
    this.wallet = await Wallet.open(
      Network.Signet,
      mnemonic,
      this.config(),
      WalletOpenArgs.create({
        datadir: this.datadir(),
        runDaemon: true,
        createIfNotExists: opts.create,
        createWithoutServer: false,
        skipRecovery: false,
      }),
    );
    const network = await this.wallet.network();
    if (network !== Network.Signet) {
      // Never operate a wallet on a network this build was not made for.
      const w = this.wallet;
      this.wallet = undefined;
      await w.stopDaemonWait().catch(() => undefined);
      throw new WalletError("sdk", "The wallet database is not a Signet wallet.");
    }
  }

  async close(): Promise<void> {
    const w = this.wallet;
    this.wallet = undefined;
    if (w) await w.stopDaemonWait();
  }

  async info(): Promise<WalletInfo> {
    const props = await this.require().properties();
    return {
      network: "signet",
      fingerprint: props.fingerprint,
      serverAddress: SIGNET.serverAddress,
      sdkVersion: BARK_SDK_VERSION,
      isMock: false,
    };
  }

  async sync(): Promise<void> {
    await this.require().sync();
    this.lastSyncedAt = new Date().toISOString();
    this.tipHeight = await this.fetchTipHeight().catch(() => this.tipHeight);
  }

  private async fetchTipHeight(): Promise<number> {
    const res = await fetch(`${SIGNET.esploraAddress}/blocks/tip/height`);
    if (!res.ok) throw new Error(`esplora ${res.status}`);
    const height = Number.parseInt((await res.text()).trim(), 10);
    if (!Number.isSafeInteger(height) || height <= 0) throw new Error("bad tip height");
    return height;
  }

  async getBalance(): Promise<WalletBalance> {
    const s = await this.require().balanceSummary();
    return {
      spendableSats: toMoney(s.spendableSats),
      pendingSats: toMoney(s.pendingSats),
      needsRefreshSats: toMoney(s.needsRefreshSats),
      totalSats: toMoney(s.totalSats),
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  async newArkAddress(): Promise<string> {
    return this.require().newAddress();
  }

  async validateDestination(input: string): Promise<DestinationCheck> {
    const text = input.trim();
    if (text === "") return { valid: false, reason: "empty" };
    const wallet = this.require();
    let request: Awaited<ReturnType<WalletLike["parsePaymentRequest"]>>;
    try {
      request = await wallet.parsePaymentRequest(text);
    } catch (e) {
      return { valid: false, reason: "unrecognised", detail: errorMessage(e) };
    }
    const ark = request.options.find((o) => o.method.tag === PaymentMethod_Tags.Ark);
    const invoice = request.options.find((o) => o.method.tag === PaymentMethod_Tags.Invoice);
    const option = ark ?? invoice;
    if (!option) return { valid: false, reason: "method-not-enabled" };

    const firstError = option.errors[0];
    if (firstError) {
      switch (firstError.tag) {
        case PaymentMethodParsingError_Tags.NetworkMismatch:
          return { valid: false, reason: "wrong-network" };
        case PaymentMethodParsingError_Tags.InvalidArkAddress:
          return { valid: false, reason: "other-server" };
        case PaymentMethodParsingError_Tags.AmountMismatch:
        case PaymentMethodParsingError_Tags.InvalidAmount:
          return { valid: false, reason: "amount-mismatch" };
        default:
          return { valid: false, reason: "method-not-enabled" };
      }
    }

    const method: PaymentMethod = option === ark ? "ark" : "lightning";
    if (!ENABLED_SEND_METHODS.includes(method)) return { valid: false, reason: "method-not-enabled" };
    const destination = option.method.inner.value;

    if (method === "ark") {
      let deliverable: boolean;
      try {
        deliverable = await wallet.validateArkoorAddress(destination);
      } catch (e) {
        return { valid: false, reason: "unrecognised", detail: errorMessage(e) };
      }
      if (!deliverable) return { valid: false, reason: "other-server" };
    } else {
      const details = decodeBolt11Invoice(destination);
      if (details.expiresAt * 1000n <= BigInt(Date.now())) return { valid: false, reason: "expired" };
    }

    return {
      valid: true,
      method,
      destination,
      fixedAmountSats: request.amountSats !== undefined ? toMoney(request.amountSats) : undefined,
      description: request.message ?? request.label,
    };
  }

  private async estimateFee(method: PaymentMethod, amount: bigint): Promise<{ fee: bigint; consistent: boolean }> {
    const wallet = this.require();
    const est = method === "ark" ? await wallet.estimateArkoorPaymentFee(amount) : await wallet.estimateLightningSendFee(amount);
    // gross = net + fee is the documented shape; if it does not hold, say so instead of hiding it.
    const consistent = est.grossAmountSats - est.feeSats === est.netAmountSats && (est.netAmountSats === amount || est.grossAmountSats === amount);
    return { fee: est.feeSats, consistent };
  }

  async quoteSend(draft: SendDraft): Promise<SendQuote> {
    if (!ENABLED_SEND_METHODS.includes(draft.method)) throw new WalletError("quote-unavailable");
    const amount = fromMoney(draft.amountSats);
    if (amount <= 0n) throw new WalletError("quote-unavailable", "amount must be positive");
    const { fee, consistent } = await this.estimateFee(draft.method, amount);
    const spendable = (await this.require().balanceSummary()).spendableSats;
    const total = amount + fee;
    if (total > spendable) throw new WalletError("insufficient-funds", toMoney(total - spendable));
    return {
      method: draft.method,
      network: "signet",
      destination: draft.destination,
      amountSats: toMoney(amount),
      feeSats: toMoney(fee),
      totalDebitSats: toMoney(total),
      balanceAfterSats: toMoney(spendable - total),
      feeIsEstimate: !consistent,
      quotedAt: new Date().toISOString(),
    };
  }

  async quoteMaxSend(method: PaymentMethod): Promise<MaxSendResult> {
    const spendable = (await this.require().balanceSummary()).spendableSats;
    if (spendable <= 0n) return { ok: false, reason: "nothing-spendable" };
    let amount = spendable;
    for (let i = 0; i < 4; i++) {
      const { fee } = await this.estimateFee(method, amount);
      if (amount + fee <= spendable) return { ok: true, amountSats: toMoney(amount), feeSats: toMoney(fee) };
      amount = spendable - fee;
      if (amount <= 0n) return { ok: false, reason: "fee-exceeds-balance" };
    }
    return { ok: false, reason: "fee-exceeds-balance" };
  }

  sendReviewedPayment(quote: SendQuote): Promise<SubmitOutcome> {
    return this.runExclusive(async () => {
      const wallet = this.require();
      if (quote.method !== "ark" || !ENABLED_SEND_METHODS.includes("ark")) {
        return { status: "failed", errorMessage: "This payment method is not enabled in this build." };
      }
      let movementId: number;
      try {
        movementId = await wallet.sendArkoorPayment(quote.destination, fromMoney(quote.amountSats));
      } catch (e) {
        // An exception does not prove the payment was not made (timeout,
        // dropped connection after the server cosigned). The caller
        // reconciles against history; nothing here retries.
        return { status: "unknown", errorMessage: errorMessage(e) };
      }
      try {
        const movement = (await wallet.history()).find((m) => m.id === movementId);
        if (!movement) return { status: "unknown", movementId: String(movementId) };
        const status = mapMovementStatus(movement.status);
        return { status, movementId: String(movementId) };
      } catch {
        return { status: "unknown", movementId: String(movementId) };
      }
    });
  }

  async listHistory(): Promise<WalletMovement[]> {
    const history: Movement[] = await this.require().history();
    return history.map(mapMovement).sort((a, b) => Number(b.id) - Number(a.id));
  }

  async listVtxos(): Promise<WalletVtxo[]> {
    const wallet = this.require();
    const [vtxos, toRefresh] = await Promise.all([wallet.vtxos(), wallet.getVtxosToRefresh()]);
    const refreshIds = new Set(toRefresh.map((v) => v.id));
    return vtxos.map((v) => {
      const blocksToExpiry = this.tipHeight === undefined ? undefined : v.expiryHeight - this.tipHeight;
      const state =
        v.state.tag === VtxoState_Tags.Spendable ? "spendable"
        : v.state.tag === VtxoState_Tags.Locked ? "locked"
        : v.state.tag === VtxoState_Tags.Spent ? "spent"
        : "exited";
      return {
        id: v.id,
        amountSats: toMoney(v.amountSats),
        expiryHeight: v.expiryHeight,
        blocksToExpiry,
        state,
        health: vtxoHealth({ locked: state === "locked", sdkSaysRefresh: refreshIds.has(v.id), blocksToExpiry }),
        kind: v.kind,
      };
    });
  }

  async maintenanceStatus(): Promise<MaintenanceStatus> {
    const wallet = this.require();
    const [toRefresh, nextRequired, firstExpiry] = await Promise.all([
      wallet.getVtxosToRefresh(),
      wallet.getNextRequiredRefreshBlockheight(),
      wallet.getFirstExpiringVtxoBlockheight(),
    ]);
    const base = {
      tipHeight: this.tipHeight,
      vtxosToRefresh: toRefresh.length,
      nextRequiredRefreshHeight: nextRequired,
      firstExpiryHeight: firstExpiry,
    };
    return { ...base, severity: maintenanceSeverity(base) };
  }

  subscribe(listener: (change: WalletChange) => void): () => void {
    const notifications = new WalletNotifications(this.require());
    return notifications.subscribe((event) => {
      if (event.tag === WalletNotification_Tags.MovementCreated) {
        listener({ kind: "movement-created", movement: mapMovement(event.inner.movement) });
      } else if (event.tag === WalletNotification_Tags.MovementUpdated) {
        listener({ kind: "movement-updated", movement: mapMovement(event.inner.movement) });
      }
    });
  }

  quiesce<T>(whileStopped: (dbFile: string) => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const wallet = this.require();
      await wallet.stopDaemonWait();
      try {
        const info = readDatadirInfo(this.datadir());
        if (!info) throw new WalletError("no-wallet");
        return await whileStopped(info.dbFile);
      } finally {
        await wallet.runDaemon();
      }
    });
  }
}
