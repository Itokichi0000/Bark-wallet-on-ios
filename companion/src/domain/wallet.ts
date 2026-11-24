import type { MoneySats } from "./money";

/**
 * The app's own wallet contract. This is NOT the Bark API: screens and use
 * cases depend on this, and `BarkWalletAdapter` is the only file that
 * translates it to the SDK.
 */
export type NetworkName = "signet" | "mainnet";
export type PaymentMethod = "ark" | "lightning";

export interface WalletBalance {
  /** What can be paid with right now. */
  spendableSats: MoneySats;
  /** Held by operations in progress. */
  pendingSats: MoneySats;
  /** Owned, but must be refreshed before it can be sent again. */
  needsRefreshSats: MoneySats;
  /** Everything the wallet owns: spendable + needsRefresh + pending. */
  totalSats: MoneySats;
  /** ISO time of the sync these numbers come from. Absent = never synced. */
  lastSyncedAt?: string;
}

export type DestinationRejection =
  | "empty"
  | "unrecognised"
  | "wrong-network"
  | "other-server"
  | "expired"
  | "method-not-enabled"
  | "amount-mismatch"
  | "needs-connection";

export type DestinationCheck =
  | {
      valid: true;
      method: PaymentMethod;
      /** The exact string that will be paid. */
      destination: string;
      /** Set when the request itself fixes the amount; the user cannot change it. */
      fixedAmountSats?: MoneySats;
      description?: string;
    }
  | { valid: false; reason: DestinationRejection; detail?: string };

export interface SendDraft {
  method: PaymentMethod;
  destination: string;
  amountSats: MoneySats;
}

export interface SendQuote {
  method: PaymentMethod;
  network: NetworkName;
  destination: string;
  amountSats: MoneySats;
  feeSats: MoneySats;
  totalDebitSats: MoneySats;
  balanceAfterSats: MoneySats;
  /** True when the SDK's numbers did not add up the way we expect; shown to the user. */
  feeIsEstimate: boolean;
  quotedAt: string;
}

export type MaxSendResult =
  | { ok: true; amountSats: MoneySats; feeSats: MoneySats }
  | { ok: false; reason: "nothing-spendable" | "fee-exceeds-balance" };

export type MovementStatus = "pending" | "succeeded" | "failed" | "unknown";

export interface WalletMovement {
  id: string;
  method: PaymentMethod | "other";
  /** Human-readable subsystem as the SDK reports it, e.g. "arkoor.send". */
  kind: string;
  direction: "incoming" | "outgoing" | "internal";
  amountSats: MoneySats;
  feeSats: MoneySats;
  status: MovementStatus;
  /** The SDK's own status word, kept so nothing is flattened away. */
  rawStatus: string;
  counterparty?: string;
  createdAt: string;
  completedAt?: string;
}

export type VtxoHealth = "ok" | "refresh-soon" | "refresh-required" | "locked";

export interface WalletVtxo {
  id: string;
  amountSats: MoneySats;
  expiryHeight: number;
  /** Blocks until expiry at the tip we last saw; undefined if the tip is unknown. */
  blocksToExpiry?: number;
  state: "spendable" | "locked" | "spent" | "exited";
  health: VtxoHealth;
  kind: string;
}

export interface MaintenanceStatus {
  tipHeight?: number;
  /** VTXOs the SDK itself says should be refreshed now. */
  vtxosToRefresh: number;
  nextRequiredRefreshHeight?: number;
  firstExpiryHeight?: number;
  severity: "none" | "notice" | "urgent";
}

export interface SubmitOutcome {
  /** Definitive only for `succeeded` and `failed`. */
  status: "succeeded" | "pending" | "failed" | "unknown";
  movementId?: string;
  errorMessage?: string;
}

export interface WalletInfo {
  network: NetworkName;
  fingerprint: string;
  serverAddress: string;
  sdkVersion: string;
  isMock: boolean;
}

/** A request to be paid over Lightning. It is for one fixed amount and stops working at `expiresAt`. */
export interface LightningInvoiceRequest {
  invoice: string;
  paymentHash: string;
  amountSats: MoneySats;
  /** What the Ark server keeps from the incoming amount, when it could be estimated. */
  feeSats?: MoneySats;
  expiresAt?: string;
}

/** `claiming`: the payer has paid and the wallet is collecting it. Only `settled` means the money arrived. */
export type LightningReceiveState = "awaiting" | "claiming" | "settled" | "unknown";

export type WalletChange =
  | { kind: "movement-created"; movement: WalletMovement }
  | { kind: "movement-updated"; movement: WalletMovement };

export interface WalletAdapter {
  readonly isMock: boolean;
  exists(): Promise<boolean>;
  /** Open an existing wallet, or create one for this mnemonic when `create` is set. */
  open(mnemonic: string, opts: { create: boolean }): Promise<void>;
  close(): Promise<void>;
  info(): Promise<WalletInfo>;
  sync(): Promise<void>;
  getBalance(): Promise<WalletBalance>;
  newArkAddress(): Promise<string>;
  /** Whether this build and network can pay and be paid over Lightning. */
  readonly lightning: boolean;
  newLightningInvoice(amountSats: MoneySats): Promise<LightningInvoiceRequest>;
  /** Advance and read one incoming Lightning payment. Never moves the user's existing funds. */
  lightningReceiveState(paymentHash: string): Promise<LightningReceiveState>;
  validateDestination(input: string): Promise<DestinationCheck>;
  quoteSend(draft: SendDraft): Promise<SendQuote>;
  quoteMaxSend(method: PaymentMethod): Promise<MaxSendResult>;
  /**
   * Execute a payment the user has reviewed. Never retries. Resolves with
   * `unknown` when the SDK call failed in a way that does not prove the
   * payment was not made.
   */
  sendReviewedPayment(quote: SendQuote): Promise<SubmitOutcome>;
  listHistory(): Promise<WalletMovement[]>;
  listVtxos(): Promise<WalletVtxo[]>;
  maintenanceStatus(): Promise<MaintenanceStatus>;
  subscribe(listener: (change: WalletChange) => void): () => void;
  /** Stop background work so the database file can be copied consistently. */
  quiesce<T>(whileStopped: (dbFile: string) => Promise<T>): Promise<T>;
}

/** Which rails this build lets the user pay over. See docs/SDK_COMPATIBILITY.md. */
export const ENABLED_SEND_METHODS: readonly PaymentMethod[] = ["ark", "lightning"];
