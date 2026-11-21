// DemoWallet: a completely local, deterministic simulation that implements the
// same WalletPort as the real adapter. It imports nothing from the SDK and has
// no network code. It can never make a payment (spec 2.1, CLAUDE.md #6).

import { DEMO_CAPABILITIES } from '../bark/capabilities';
import { SingleFlight } from '../wallet/reconcile';
import type {
  AddressCheck,
  Capabilities,
  ExitEstimateView,
  FeeEstimateView,
  MovementView,
  OperationResult,
  Sats,
  ServerInfoView,
  VtxoView,
  WalletPort,
  WalletSnapshot,
} from '../wallet/types';
import {
  DEMO_FRIEND_ADDRESS,
  DEMO_MAX_EXIT_DEPTH,
  DEMO_OWN_ADDRESS_PREFIX,
  DEMO_REFRESH_THRESHOLD,
  DEMO_VTXO_LIFETIME,
  DEMO_WALLET_ID,
  demoId,
  scenario,
  type DemoState,
  type DemoVtxo,
  type ScenarioName,
} from './fixtures';

/** Educational fee model for DEMO only. Real fees come from the server's fee schedule. */
export function demoSendFee(amount: Sats): Sats {
  return 10 + Math.floor(amount / 1_000);
}
export function demoRefreshFee(total: Sats): Sats {
  return Math.max(1, Math.floor(total / 1_000));
}

export class DemoWallet implements WalletPort {
  readonly mode = 'demo' as const;
  private state: DemoState;
  private readonly guard = new SingleFlight();
  private addressIndex = 0;

  constructor(
    initial: ScenarioName = 'empty',
    private readonly delayMs = 400,
  ) {
    this.state = scenario(initial);
  }

  private wait(): Promise<void> {
    return this.delayMs > 0 ? new Promise((r) => setTimeout(r, this.delayMs)) : Promise.resolve();
  }

  getCapabilities(): Capabilities {
    return DEMO_CAPABILITIES;
  }

  get tip(): number {
    return this.state.tip;
  }

  private nextId(): string {
    this.state.counter += 1;
    return demoId(this.state.counter);
  }

  private nextMovementId(): string {
    this.state.counter += 1;
    return `demo-m${this.state.counter}`;
  }

  private nowIso(): string {
    // Demo clock: one block ≈ 10 minutes from a fixed epoch, deterministic.
    return new Date(Date.UTC(2026, 0, 1, 9, 0) + (this.state.tip - 120_000) * 600_000 + this.state.counter * 1_000).toISOString();
  }

  /** Effective view state: spendable VTXOs within the refresh threshold show as needs-refresh. */
  private view(v: DemoVtxo): VtxoView {
    let state = v.state;
    const evidence = ['DEMO fixture (lib/demo/fixtures.ts)'];
    if ((state === 'spendable' || state === 'locked') && v.expiryHeight !== undefined && v.expiryHeight - this.state.tip <= DEMO_REFRESH_THRESHOLD) {
      state = 'needs-refresh';
      evidence.push(`DEMO rule: ≤ ${DEMO_REFRESH_THRESHOLD} blocks to expiry → needs-refresh`);
    }
    if (state === 'locked') state = 'pending';
    return { ...v, state, rawState: v.state, source: 'demo', evidence };
  }

  private snapshotNow(): WalletSnapshot {
    const views = this.state.vtxos.map((v) => this.view(v));
    const sum = (pred: (v: VtxoView) => boolean) => views.filter(pred).reduce((a, v) => a + (v.amountSats ?? 0), 0);
    const spendable = sum((v) => v.state === 'spendable');
    const needsRefresh = sum((v) => v.state === 'needs-refresh' && v.expiryHeight! > this.state.tip);
    const pending = sum((v) => v.state === 'pending');
    const exiting = sum((v) => v.state === 'exited');
    return {
      mode: 'demo',
      walletId: DEMO_WALLET_ID,
      capturedAt: this.nowIso(),
      chainTipHeight: this.state.tip,
      balance: {
        spendableSats: spendable,
        needsRefreshSats: needsRefresh,
        pendingSats: pending + exiting,
        totalSats: spendable + needsRefresh + pending + exiting,
        onchainSats: 0,
        rawCategories: { spendableSats: spendable, needsRefreshSats: needsRefresh, pendingInRoundSats: pending, pendingExitSats: exiting },
      },
      vtxos: views,
    };
  }

  async getSnapshot(): Promise<WalletSnapshot> {
    return this.snapshotNow();
  }

  async sync(): Promise<WalletSnapshot> {
    await this.wait();
    return this.snapshotNow();
  }

  async getReceiveAddress(): Promise<string> {
    this.addressIndex += 1;
    return `${DEMO_OWN_ADDRESS_PREFIX}${String(this.addressIndex).padStart(4, '0')}`;
  }

  async validateArkAddress(address: string): Promise<AddressCheck> {
    const a = address.trim();
    if (a === '') return { ok: false, reason: 'empty' };
    // Demo accepts only demo addresses, so a real address can never be "paid" here.
    if (!a.startsWith('DEMO-')) return { ok: false, reason: 'invalid', detail: 'demo-only' };
    return { ok: true };
  }

  private select(amount: Sats): DemoVtxo[] | undefined {
    const candidates = this.state.vtxos
      .filter((v) => this.view(v).state === 'spendable')
      .sort((a, b) => (a.expiryHeight ?? 0) - (b.expiryHeight ?? 0));
    const picked: DemoVtxo[] = [];
    let total = 0;
    for (const v of candidates) {
      if (total >= amount) break;
      picked.push(v);
      total += v.amountSats ?? 0;
    }
    return total >= amount ? picked : undefined;
  }

  async estimateSendFee(amountSats: Sats): Promise<FeeEstimateView> {
    const fee = demoSendFee(amountSats);
    const picked = this.select(amountSats + fee) ?? [];
    return { grossSats: amountSats + fee, feeSats: fee, netSats: amountSats, vtxosSpent: picked.map((v) => v.id), source: 'demo' };
  }

  async sendArk({ address, amountSats }: { address: string; amountSats: Sats }): Promise<OperationResult> {
    return this.guard.run(async () => {
      const check = await this.validateArkAddress(address);
      if (!check.ok) return { status: 'failed', message: `address:${check.reason}` };
      const fee = demoSendFee(amountSats);
      const picked = this.select(amountSats + fee);
      if (!picked) return { status: 'failed', message: 'amount:insufficient' };
      await this.wait();
      const total = picked.reduce((a, v) => a + (v.amountSats ?? 0), 0);
      const changeAmount = total - amountSats - fee;
      for (const v of picked) v.state = 'spent';
      const outputs: string[] = [];
      if (changeAmount > 0) {
        const maxDepth = Math.max(...picked.map((v) => v.exitDepth ?? 1));
        const minExpiry = Math.min(...picked.map((v) => v.expiryHeight ?? this.state.tip + DEMO_VTXO_LIFETIME));
        const change: DemoVtxo = { demo: true, id: this.nextId(), amountSats: changeAmount, kind: 'arkoor', state: 'spendable', expiryHeight: minExpiry, exitDepth: maxDepth + 1, exitTxWeightWu: 700 + (maxDepth + 1) * 500, registered: true };
        this.state.vtxos.push(change);
        outputs.push(change.id);
      }
      const id = this.nextMovementId();
      this.state.movements.push({
        demo: true, id, status: 'successful', kind: 'arkoor / send', effectiveBalanceSats: -(amountSats + fee), feeSats: fee,
        inputVtxoIds: picked.map((v) => v.id), outputVtxoIds: outputs, exitedVtxoIds: [], sentTo: [address.trim()], receivedOn: [], createdAt: this.nowIso(), completedAt: this.nowIso(),
      });
      return { status: 'succeeded', referenceId: id };
    });
  }

  async getHistory(): Promise<MovementView[]> {
    return [...this.state.movements].reverse().map((m) => ({ ...m, source: 'demo' as const }));
  }

  async getServerInfo(): Promise<ServerInfoView> {
    return { network: 'Signet (DEMO)', vtxoLifetimeBlocks: DEMO_VTXO_LIFETIME, maxVtxoExitDepth: DEMO_MAX_EXIT_DEPTH, roundIntervalSecs: 60, refreshThresholdBlocks: DEMO_REFRESH_THRESHOLD, vtxoExitDeltaBlocks: 12 };
  }

  async estimateExit(vtxoIds: string[]): Promise<ExitEstimateView> {
    const vs = this.state.vtxos.filter((v) => vtxoIds.includes(v.id));
    const txs = vs.reduce((a, v) => a + (v.exitDepth ?? 1), 0);
    const weight = vs.reduce((a, v) => a + (v.exitTxWeightWu ?? 0), 0);
    const rate = 2;
    const broadcast = Math.ceil((weight / 4) * rate * 1.2) + txs * 150;
    const claim = 200;
    return { broadcastFeeSats: broadcast, claimFeeSats: claim, totalFeeSats: broadcast + claim, feeRateSatPerVb: rate, txsToBroadcast: txs, source: 'demo' };
  }

  async estimateRefreshFee(vtxoIds: string[]): Promise<FeeEstimateView> {
    const total = this.state.vtxos.filter((v) => vtxoIds.includes(v.id)).reduce((a, v) => a + (v.amountSats ?? 0), 0);
    const fee = demoRefreshFee(total);
    return { grossSats: total, feeSats: fee, netSats: total - fee, vtxosSpent: vtxoIds, source: 'demo' };
  }

  async close(): Promise<void> {}

  // ---- Demo-only controls (Lab / guided tour). None of these exist on the real adapter.

  async receive(amountSats: Sats): Promise<void> {
    await this.wait();
    const v: DemoVtxo = { demo: true, id: this.nextId(), amountSats, kind: 'arkoor', state: 'spendable', expiryHeight: this.state.tip + 1_500, exitDepth: 2, exitTxWeightWu: 1_400, registered: true };
    this.state.vtxos.push(v);
    this.state.movements.push({
      demo: true, id: this.nextMovementId(), status: 'successful', kind: 'arkoor / receive', effectiveBalanceSats: amountSats, feeSats: 0,
      inputVtxoIds: [], outputVtxoIds: [v.id], exitedVtxoIds: [], sentTo: [], receivedOn: [`${DEMO_OWN_ADDRESS_PREFIX}${this.addressIndex}`], createdAt: this.nowIso(), completedAt: this.nowIso(),
    });
  }

  advanceBlocks(n: number): void {
    this.state.tip += Math.max(0, Math.floor(n));
  }

  /** Simulated round refresh: old VTXOs are consumed, a new one with a fresh expiry is created. */
  async refreshAll(): Promise<OperationResult> {
    const inputs = this.state.vtxos.filter((v) => {
      const s = this.view(v).state;
      return (s === 'spendable' || s === 'needs-refresh') && (v.expiryHeight ?? 0) > this.state.tip;
    });
    if (inputs.length === 0) return { status: 'failed', message: 'nothing-to-refresh' };
    await this.wait();
    const total = inputs.reduce((a, v) => a + (v.amountSats ?? 0), 0);
    const fee = demoRefreshFee(total);
    for (const v of inputs) v.state = 'spent';
    const fresh: DemoVtxo = { demo: true, id: this.nextId(), amountSats: total - fee, kind: 'round', state: 'spendable', expiryHeight: this.state.tip + DEMO_VTXO_LIFETIME, exitDepth: 1, exitTxWeightWu: 700, registered: true };
    this.state.vtxos.push(fresh);
    const id = this.nextMovementId();
    this.state.movements.push({
      demo: true, id, status: 'successful', kind: 'round / refresh', effectiveBalanceSats: -fee, feeSats: fee,
      inputVtxoIds: inputs.map((v) => v.id), outputVtxoIds: [fresh.id], exitedVtxoIds: [], sentTo: [], receivedOn: [], createdAt: this.nowIso(), completedAt: this.nowIso(),
    });
    return { status: 'succeeded', referenceId: id };
  }

  loadScenario(name: ScenarioName): void {
    this.state = scenario(name);
    this.addressIndex = 0;
  }

  friendAddress(): string {
    return DEMO_FRIEND_ADDRESS;
  }
}
