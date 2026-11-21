// App-defined wallet interface (spec 6.1). This is NOT the Bark SDK API: the
// real SDK surface is documented in docs/SDK_CAPABILITIES.md and adapted in
// src/lib/bark/adapter.ts.

export type Mode = 'demo' | 'signet';

export type Capability =
  | 'receiveArk'
  | 'sendArk'
  | 'sync'
  | 'listVtxos'
  | 'history'
  | 'refresh'
  | 'offboard'
  | 'exitStatus'
  | 'exitEstimate'
  | 'exitTransactions'
  | 'feeEstimate'
  | 'exportWalletBackup';

/**
 * supported   — available in the SDK and wired up in this app
 * disabled    — the SDK has it, but this app deliberately does not execute it yet
 *               (not verified on Signet, or out of MVP scope)
 * unsupported — the SDK does not provide it
 * unknown     — capability could not be determined
 */
export type CapabilityStatus = 'supported' | 'disabled' | 'unsupported' | 'unknown';

export type Capabilities = Record<Capability, CapabilityStatus>;

/** Integer number of satoshis. Always a safe integer; see lib/wallet/sats.ts. */
export type Sats = number;

export type VtxoState =
  | 'spendable'
  | 'locked'
  | 'spent'
  | 'exited'
  | 'needs-refresh'
  | 'pending'
  | 'unknown';

export type DataSource = 'sdk' | 'demo';

export interface VtxoView {
  id: string;
  amountSats?: Sats;
  kind?: string;
  state: VtxoState;
  /** Raw SDK state tag, kept for transparency ("spendable", "locked", ...). */
  rawState?: string;
  /** Extra detail about the state, e.g. who holds a lock. */
  stateDetail?: string;
  expiryHeight?: number;
  exitDepth?: number;
  exitTxWeightWu?: number;
  registered?: boolean;
  source: DataSource;
  /** Where each value came from, e.g. "wallet.vtxos()". */
  evidence: string[];
}

export interface BalanceView {
  spendableSats?: Sats;
  needsRefreshSats?: Sats;
  pendingSats?: Sats;
  totalSats?: Sats;
  onchainSats?: Sats;
  /** Every raw category the SDK returned, untouched. */
  rawCategories: Record<string, Sats>;
}

export interface MovementView {
  id: string;
  status: string;
  kind: string;
  /** Net effect on the wallet balance, signed. */
  effectiveBalanceSats?: Sats;
  feeSats?: Sats;
  inputVtxoIds: string[];
  outputVtxoIds: string[];
  exitedVtxoIds: string[];
  sentTo: string[];
  receivedOn: string[];
  createdAt?: string;
  completedAt?: string;
  source: DataSource;
}

export interface ServerInfoView {
  network: string;
  vtxoLifetimeBlocks?: number;
  vtxoExitDeltaBlocks?: number;
  maxVtxoExitDepth?: number;
  roundIntervalSecs?: number;
  /** Bark config: how many blocks before expiry a VTXO counts as needing refresh. */
  refreshThresholdBlocks?: number;
}

export interface WalletSnapshot {
  mode: Mode;
  /** Identifies the wallet so snapshots of different wallets are never compared. */
  walletId: string;
  capturedAt: string;
  chainTipHeight?: number;
  balance: BalanceView;
  vtxos: VtxoView[];
  /** VTXO list could not be read; the UI must fall back to the concept view. */
  vtxosUnavailable?: boolean;
}

export type OperationStatus = 'succeeded' | 'pending' | 'failed' | 'unknown';

export interface OperationResult {
  status: OperationStatus;
  referenceId?: string;
  message?: string;
}

export interface FeeEstimateView {
  grossSats: Sats;
  feeSats: Sats;
  netSats: Sats;
  vtxosSpent: string[];
  source: DataSource;
}

export interface ExitEstimateView {
  broadcastFeeSats: Sats;
  claimFeeSats: Sats;
  totalFeeSats: Sats;
  feeRateSatPerVb: number;
  txsToBroadcast: number;
  source: DataSource;
}

export interface ExitTransactionsView {
  vtxoId: string;
  /** Txids still to be confirmed, in broadcast order. Empty if already confirmed. */
  txids: string[];
  source: DataSource;
}

export interface WalletPort {
  readonly mode: Mode;
  getCapabilities(): Capabilities;
  getSnapshot(): Promise<WalletSnapshot>;
  sync(): Promise<WalletSnapshot>;
  getReceiveAddress(): Promise<string>;
  validateArkAddress(address: string): Promise<AddressCheck>;
  estimateSendFee?(amountSats: Sats): Promise<FeeEstimateView>;
  sendArk(params: { address: string; amountSats: Sats }): Promise<OperationResult>;
  getHistory(): Promise<MovementView[]>;
  getServerInfo(): Promise<ServerInfoView | undefined>;
  estimateExit?(vtxoIds: string[]): Promise<ExitEstimateView>;
  getExitTransactions?(vtxoIds: string[]): Promise<ExitTransactionsView[]>;
  estimateRefreshFee?(vtxoIds: string[]): Promise<FeeEstimateView>;
  close(): Promise<void>;
}

export type AddressCheck =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'invalid' | 'wrong-network' | 'wrong-server' | 'unknown'; detail?: string };
