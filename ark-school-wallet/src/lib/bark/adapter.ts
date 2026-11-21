// BarkWebAdapter: the only place that talks to the real @secondts/bark SDK.
// Implements the app's WalletPort. Everything it returns is normalized and
// carries evidence of which SDK call produced it.

import type { Wallet, OnchainWallet } from '@secondts/bark/web';
import { log } from '../security/log';
import { errorMessage } from '../security/redact';
import { SingleFlight, clearPendingSend, writePendingSend } from '../wallet/reconcile';
import { toSats } from '../wallet/sats';
import type {
  AddressCheck,
  Capabilities,
  ExitEstimateView,
  ExitTransactionsView,
  FeeEstimateView,
  MovementView,
  OperationResult,
  Sats,
  ServerInfoView,
  WalletPort,
  WalletSnapshot,
} from '../wallet/types';
import { SIGNET_CAPABILITIES } from './capabilities';
import { NETWORK, assertSignet, getSignetConfig } from './config';
import { loadBark } from './client';
import {
  normalizeBalance,
  normalizeExitEstimate,
  normalizeFeeEstimate,
  normalizeMovement,
  normalizeServerInfo,
  normalizeVtxo,
} from './normalize';

/** The subset of the SDK Wallet this adapter uses; lets tests inject a fake. */
export type WalletLike = Pick<
  Wallet,
  | 'allVtxos'
  | 'vtxos'
  | 'balance'
  | 'balanceSummary'
  | 'sync'
  | 'newAddress'
  | 'validateArkoorAddress'
  | 'parsePaymentRequest'
  | 'sendArkoorPayment'
  | 'estimateArkoorPaymentFee'
  | 'history'
  | 'arkInfo'
  | 'network'
  | 'config'
  | 'getVtxosToRefresh'
  | 'pendingRoundInputVtxos'
  | 'pendingBoardVtxos'
  | 'pendingLightningSendVtxos'
  | 'estimateEmergencyExitFee'
  | 'remainingExitTransactions'
  | 'estimateRefreshFee'
  | 'free'
>;

export type OnchainLike = Pick<OnchainWallet, 'tipHeight' | 'balance' | 'sync' | 'free'>;

export interface SdkStatics {
  validateArkAddress(address: string): boolean;
}

export class BarkWebAdapter implements WalletPort {
  readonly mode = 'signet' as const;
  private readonly sendGuard = new SingleFlight();
  private lastSnapshot: WalletSnapshot | undefined;

  constructor(
    private readonly wallet: WalletLike,
    private readonly onchain: OnchainLike | undefined,
    private readonly statics: SdkStatics,
    readonly walletId: string,
  ) {}

  getCapabilities(): Capabilities {
    return SIGNET_CAPABILITIES;
  }

  get sendInFlight(): boolean {
    return this.sendGuard.busy;
  }

  async getServerInfo(): Promise<ServerInfoView | undefined> {
    const info = await this.wallet.arkInfo();
    let threshold: number | undefined;
    try {
      threshold = this.wallet.config().vtxoRefreshExpiryThreshold;
    } catch {
      threshold = undefined;
    }
    return normalizeServerInfo(info, threshold);
  }

  private async idSet(fn: () => Promise<Array<{ id: string }>>): Promise<Set<string> | undefined> {
    try {
      return new Set((await fn()).map((v) => v.id));
    } catch (err) {
      log('warn', `optional VTXO list failed: ${errorMessage(err)}`);
      return undefined;
    }
  }

  async getSnapshot(): Promise<WalletSnapshot> {
    const [balance, summary] = await Promise.all([this.wallet.balance(), this.wallet.balanceSummary()]);

    let tip: number | undefined;
    let onchainTotal: number | undefined;
    if (this.onchain) {
      try {
        tip = await this.onchain.tipHeight();
      } catch (err) {
        log('warn', `tipHeight failed: ${errorMessage(err)}`);
      }
      try {
        onchainTotal = (await this.onchain.balance()).totalSats;
      } catch (err) {
        log('warn', `onchain balance failed: ${errorMessage(err)}`);
      }
    }

    let vtxos: WalletSnapshot['vtxos'] = [];
    let vtxosUnavailable = false;
    try {
      const [all, toRefresh, pr, pb, pl] = await Promise.all([
        this.wallet.allVtxos(),
        this.idSet(() => this.wallet.getVtxosToRefresh()),
        this.idSet(() => this.wallet.pendingRoundInputVtxos()),
        this.idSet(() => this.wallet.pendingBoardVtxos()),
        this.idSet(() => this.wallet.pendingLightningSendVtxos()),
      ]);
      const pending = new Set([...(pr ?? []), ...(pb ?? []), ...(pl ?? [])]);
      vtxos = all.map((v) => normalizeVtxo(v, { toRefresh, pending }));
    } catch (err) {
      log('warn', `allVtxos failed: ${errorMessage(err)}`);
      vtxosUnavailable = true;
    }

    const snap: WalletSnapshot = {
      mode: 'signet',
      walletId: this.walletId,
      capturedAt: new Date().toISOString(),
      chainTipHeight: typeof tip === 'number' && Number.isSafeInteger(tip) ? tip : undefined,
      balance: normalizeBalance(balance, summary, onchainTotal),
      vtxos,
      vtxosUnavailable,
    };
    this.lastSnapshot = snap;
    return snap;
  }

  async sync(): Promise<WalletSnapshot> {
    await this.wallet.sync();
    if (this.onchain) {
      try {
        await this.onchain.sync();
      } catch (err) {
        log('warn', `onchain sync failed: ${errorMessage(err)}`);
      }
    }
    return this.getSnapshot();
  }

  getReceiveAddress(): Promise<string> {
    return this.wallet.newAddress();
  }

  async validateArkAddress(address: string): Promise<AddressCheck> {
    const a = address.trim();
    if (a === '') return { ok: false, reason: 'empty' };
    let parses: boolean;
    try {
      parses = this.statics.validateArkAddress(a);
    } catch {
      parses = false;
    }
    if (!parses) return { ok: false, reason: 'invalid' };
    try {
      // Same network AND same Ark server, per SDK docs. This is what rejects
      // a mainnet Ark address on this Signet wallet (T07).
      const ok = await this.wallet.validateArkoorAddress(a);
      if (ok) return { ok: true };
      return { ok: false, reason: (await this.isNetworkMismatch(a)) ? 'wrong-network' : 'wrong-server' };
    } catch (err) {
      return { ok: false, reason: 'invalid', detail: errorMessage(err) };
    }
  }

  /** Uses the SDK's own parser to tell "other network" apart from "other server". */
  private async isNetworkMismatch(address: string): Promise<boolean> {
    try {
      const req = await this.wallet.parsePaymentRequest(address);
      return req.options.some((o) => o.errors.some((e) => e.type === 'network-mismatch'));
    } catch (err) {
      return /network/i.test(errorMessage(err));
    }
  }

  async estimateSendFee(amountSats: Sats): Promise<FeeEstimateView> {
    return normalizeFeeEstimate(await this.wallet.estimateArkoorPaymentFee(toSats(amountSats)));
  }

  /**
   * Sends exactly once. If the SDK throws, the outcome is UNKNOWN: the
   * payment may or may not have gone through. We never retry; the UI asks the
   * user to sync and check history first.
   */
  async sendArk({ address, amountSats }: { address: string; amountSats: Sats }): Promise<OperationResult> {
    return this.sendGuard.run(async () => {
      const check = await this.validateArkAddress(address);
      if (!check.ok) return { status: 'failed', message: `address:${check.reason}` };
      const amount = toSats(amountSats);
      if (amount <= 0) return { status: 'failed', message: 'amount:zero' };
      const spendable = this.lastSnapshot?.balance.spendableSats;
      if (spendable !== undefined && amount > spendable) return { status: 'failed', message: 'amount:insufficient' };

      const pending = { walletId: this.walletId, address: address.trim(), amountSats: amount, startedAt: new Date().toISOString() };
      writePendingSend({ ...pending, phase: 'in-flight' });
      try {
        const movementId = await this.wallet.sendArkoorPayment(address.trim(), amount);
        clearPendingSend();
        return { status: 'succeeded', referenceId: String(movementId) };
      } catch (err) {
        const message = errorMessage(err);
        log('error', `sendArkoorPayment threw: ${message}`);
        writePendingSend({ ...pending, phase: 'unknown', message });
        return { status: 'unknown', message };
      }
    });
  }

  async getHistory(): Promise<MovementView[]> {
    return (await this.wallet.history()).map(normalizeMovement);
  }

  async estimateExit(vtxoIds: string[]): Promise<ExitEstimateView> {
    return normalizeExitEstimate(await this.wallet.estimateEmergencyExitFee(vtxoIds));
  }

  async getExitTransactions(vtxoIds: string[]): Promise<ExitTransactionsView[]> {
    if (vtxoIds.length === 0) return [];
    const res = await this.wallet.remainingExitTransactions({ vtxoIds });
    return res.exits.map((e) => ({ vtxoId: e.vtxoId, txids: e.txids, source: 'sdk' as const }));
  }

  async estimateRefreshFee(vtxoIds: string[]): Promise<FeeEstimateView> {
    return normalizeFeeEstimate(await this.wallet.estimateRefreshFee(vtxoIds));
  }

  async close(): Promise<void> {
    try {
      this.wallet.free();
    } catch {
      /* already freed */
    }
    try {
      this.onchain?.free();
    } catch {
      /* already freed */
    }
  }
}

export interface OpenArgs {
  walletId: string;
  barkDbName: string;
  mnemonic: string;
  /** true when creating or restoring; false to only reopen an existing DB */
  create: boolean;
}

export interface OpenResult {
  adapter: BarkWebAdapter;
  recovery?: { status: string; complete?: boolean };
  onchainAvailable: boolean;
}

/**
 * Opens a real Signet wallet. The background daemon is OFF: this app syncs
 * explicitly (manual button + periodic sync only), so Bark's maintenance never
 * refreshes or exits anything behind the user's back.
 */
export async function openSignetWallet(args: OpenArgs): Promise<OpenResult> {
  const sdk = await loadBark();
  const cfg = getSignetConfig();
  const config = { serverAddress: cfg.serverAddress, esploraAddress: cfg.esploraAddress, userAgent: 'ark-school-wallet/0.1.0' };
  const openArgs = { indexedDbName: args.barkDbName, runDaemon: false, createIfNotExists: args.create };

  let onchain: OnchainWallet | undefined;
  try {
    onchain = await sdk.OnchainWallet.default({ network: NETWORK, mnemonic: args.mnemonic, config, dbName: `${args.barkDbName}-onchain` });
  } catch (err) {
    log('warn', `onchain wallet unavailable: ${errorMessage(err)}`);
  }

  const wallet = onchain
    ? await sdk.Wallet.openWithOnchain(NETWORK, args.mnemonic, config, onchain, openArgs)
    : await sdk.Wallet.open(NETWORK, args.mnemonic, config, undefined, openArgs);

  try {
    assertSignet(await wallet.network());
    const info = await wallet.arkInfo();
    if (info) assertSignet(info.network);
  } catch (err) {
    wallet.free();
    onchain?.free();
    throw err;
  }

  let recovery: OpenResult['recovery'];
  try {
    const r = wallet.recoveryStatus();
    recovery = { status: r.type, complete: 'report' in r ? r.report.isComplete : undefined };
  } catch {
    recovery = undefined;
  }

  return {
    adapter: new BarkWebAdapter(wallet, onchain, { validateArkAddress: sdk.validateArkAddress }, args.walletId),
    recovery,
    onchainAvailable: onchain !== undefined,
  };
}

export async function generateMnemonic(): Promise<string> {
  return (await loadBark()).generateMnemonic();
}

export async function validateMnemonic(m: string): Promise<boolean> {
  return (await loadBark()).validateMnemonic(m);
}
