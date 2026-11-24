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
  LightningSendStatus_Tags,
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
  type LightningInvoiceRequest,
  type LightningReceiveState,
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
import { ACTIVE_NETWORK, LIGHTNING_ENABLED, NET } from "@/config/network";
import { BARK_SDK_VERSION } from "./barkConfig";
import { maintenanceSeverity, mapMovement, mapMovementStatus, vtxoHealth } from "./mapping";

/**
 * The only file that talks to the Bark SDK. Every method used here was
 * checked against the installed 0.28.0 type definitions; see
 * docs/SDK_COMPATIBILITY.md for what has and has not been exercised on a
 * device.
 */
/** How long a Lightning payment is watched before it is handed to reconciliation as pending. */
const LIGHTNING_POLLS = 10;
const LIGHTNING_POLL_MS = 2000;

export class BarkWalletAdapter implements WalletAdapter {
  readonly isMock = false;
  private wallet: WalletLike | undefined;
  private lastSyncedAt: string | undefined;
  private tipHeight: number | undefined;
  /** Serialises sends and database snapshots so a copy never races a write. */
  private exclusive: Promise<unknown> = Promise.resolve();

  private datadir(): string {
    return new Directory(Paths.document, NET.datadirName).uri;
  }

  /** The one place the app's network choice becomes an SDK network. */
  private sdkNetwork(): Network {
    return ACTIVE_NETWORK === "mainnet" ? Network.Bitcoin : Network.Signet;
  }

  private config(): Config {
    return Config.create({ serverAddress: NET.serverAddress, esploraAddress: NET.esploraAddress });
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
    const dir = new Directory(Paths.document, NET.datadirName);
    if (!dir.exists) dir.create({ intermediates: true });
    this.wallet = await Wallet.open(
      this.sdkNetwork(),
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
    if (network !== this.sdkNetwork()) {
      // Never operate a wallet on a network this build was not made for.
      const w = this.wallet;
      this.wallet = undefined;
      await w.stopDaemonWait().catch(() => undefined);
      throw new WalletError("sdk", `The wallet database is not a ${ACTIVE_NETWORK} wallet.`);
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
      network: ACTIVE_NETWORK,
      fingerprint: props.fingerprint,
      serverAddress: NET.serverAddress,
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
    const res = await fetch(`${NET.esploraAddress}/blocks/tip/height`);
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
    if (!this.canUse(method)) return { valid: false, reason: "method-not-enabled" };
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
      let details: ReturnType<typeof decodeBolt11Invoice>;
      try {
        details = decodeBolt11Invoice(destination);
      } catch (e) {
        return { valid: false, reason: "unrecognised", detail: errorMessage(e) };
      }
      if (details.expiresAt * 1000n <= BigInt(Date.now())) return { valid: false, reason: "expired" };
      // Sub-satoshi amounts cannot be shown or reviewed exactly, so they are not paid.
      if (details.amountMsat !== undefined && details.amountMsat % 1000n !== 0n) return { valid: false, reason: "amount-mismatch" };
      return {
        valid: true,
        method,
        destination,
        fixedAmountSats: details.amountSats !== undefined ? toMoney(details.amountSats) : undefined,
        description: details.description ?? request.message ?? request.label,
      };
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
    if (!this.canUse(draft.method)) throw new WalletError("quote-unavailable");
    const amount = fromMoney(draft.amountSats);
    if (amount <= 0n) throw new WalletError("quote-unavailable", "amount must be positive");
    const { fee, consistent } = await this.estimateFee(draft.method, amount);
    const spendable = (await this.require().balanceSummary()).spendableSats;
    const total = amount + fee;
    if (total > spendable) throw new WalletError("insufficient-funds", toMoney(total - spendable));
    return {
      method: draft.method,
      network: ACTIVE_NETWORK,
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

  readonly lightning = LIGHTNING_ENABLED && ENABLED_SEND_METHODS.includes("lightning");

  private canUse(method: PaymentMethod): boolean {
    return ENABLED_SEND_METHODS.includes(method) && (method !== "lightning" || this.lightning);
  }

  async newLightningInvoice(amountSats: string): Promise<LightningInvoiceRequest> {
    if (!this.lightning) throw new WalletError("quote-unavailable", "lightning is not enabled");
    const wallet = this.require();
    const amount = fromMoney(amountSats);
    if (amount <= 0n) throw new WalletError("quote-unavailable", "amount must be positive");
    const fee = await wallet.estimateLightningReceiveFee(amount).then((e) => e.feeSats, () => undefined);
    const created = await wallet.bolt11Invoice(amount, undefined, undefined, undefined);
    let expiresAt: string | undefined;
    try {
      expiresAt = new Date(Number(decodeBolt11Invoice(created.invoice).expiresAt) * 1000).toISOString();
    } catch {
      expiresAt = undefined;
    }
    return {
      invoice: created.invoice,
      paymentHash: created.paymentHash,
      amountSats: toMoney(created.amountSats),
      feeSats: fee === undefined ? undefined : toMoney(fee),
      expiresAt,
    };
  }

  async lightningReceiveState(paymentHash: string): Promise<LightningReceiveState> {
    const wallet = this.require();
    // Claiming collects money already paid to this wallet; a failure here just means "not yet".
    await wallet.tryClaimLightningReceive(paymentHash, false).catch(() => undefined);
    try {
      const receive = await wallet.lightningReceiveState(paymentHash);
      if (receive.state === "settled") return "settled";
      return receive.state === "awaiting-payment" ? "awaiting" : "claiming";
    } catch {
      return "unknown";
    }
  }

  sendReviewedPayment(quote: SendQuote): Promise<SubmitOutcome> {
    return this.runExclusive(async () => {
      if (!this.canUse(quote.method)) {
        return { status: "failed", errorMessage: "This payment method is not enabled in this build." };
      }
      return quote.method === "ark" ? this.sendArk(quote) : this.sendLightning(quote);
    });
  }

  private async sendArk(quote: SendQuote): Promise<SubmitOutcome> {
    const wallet = this.require();
    let movementId: number;
    try {
      movementId = await wallet.sendArkoorPayment(quote.destination, fromMoney(quote.amountSats));
    } catch (e) {
      // An exception does not prove the payment was not made (timeout,
      // dropped connection after the server cosigned). The caller
      // reconciles against history; nothing here retries.
      return { status: "unknown", errorMessage: errorMessage(e) };
    }
    return this.movementOutcome(movementId);
  }

  private async movementOutcome(movementId: number): Promise<SubmitOutcome> {
    try {
      const movement = (await this.require().history()).find((m) => m.id === movementId);
      if (!movement) return { status: "unknown", movementId: String(movementId) };
      return { status: mapMovementStatus(movement.status), movementId: String(movementId) };
    } catch {
      return { status: "unknown", movementId: String(movementId) };
    }
  }

  /**
   * Pay a BOLT11 invoice. The payment is started exactly once (`wait = false`) and then only
   * observed: polling reads and advances the same payment, it never starts another. Anything
   * short of the server's "paid" is reported as pending or unknown, never as failure.
   */
  private async sendLightning(quote: SendQuote): Promise<SubmitOutcome> {
    const wallet = this.require();
    const amount = fromMoney(quote.amountSats);
    let details: ReturnType<typeof decodeBolt11Invoice>;
    try {
      details = decodeBolt11Invoice(quote.destination);
    } catch (e) {
      return { status: "failed", errorMessage: errorMessage(e) };
    }
    // Nothing has been sent yet, so these are definitive.
    if (details.expiresAt * 1000n <= BigInt(Date.now())) return { status: "failed", errorMessage: "invoice-expired" };
    if (details.amountSats !== undefined && details.amountSats !== amount) return { status: "failed", errorMessage: "amount-mismatch" };

    let status: Awaited<ReturnType<WalletLike["payLightningInvoice"]>>;
    try {
      status = await wallet.payLightningInvoice(quote.destination, details.amountSats === undefined ? amount : undefined, false, undefined);
    } catch (e) {
      return { status: "unknown", errorMessage: errorMessage(e) };
    }
    let movementId: number | undefined;
    for (let attempt = 0; ; attempt++) {
      if (status.tag === LightningSendStatus_Tags.Paid) {
        return { status: "succeeded", movementId: movementId === undefined ? undefined : String(movementId) };
      }
      if (status.tag === LightningSendStatus_Tags.InProgress) movementId = status.inner.send.movementId ?? movementId;
      if (attempt >= LIGHTNING_POLLS) break;
      await new Promise((resolve) => setTimeout(resolve, LIGHTNING_POLL_MS));
      try {
        status = await wallet.checkLightningPayment(details.paymentHash, false);
      } catch {
        break;
      }
    }
    // Not confirmed in the time we watched. The wallet's own record decides; history reconciles the rest.
    if (movementId === undefined) return { status: "unknown" };
    const outcome = await this.movementOutcome(movementId);
    return outcome.status === "succeeded" || outcome.status === "failed" ? outcome : { ...outcome, status: "pending" };
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
