// SDK → app view models (spec 6.2). Missing fields stay undefined: never 0.

import type { Balance, BalanceSummary, Movement, Vtxo, ArkInfo, VtxoState as SdkVtxoState, FeeEstimate, EmergencyExitFeeEstimate } from '@secondts/bark/web';
import { maybeSats, maybeSignedSats } from '../wallet/sats';
import type { BalanceView, ExitEstimateView, FeeEstimateView, MovementView, ServerInfoView, VtxoState, VtxoView } from '../wallet/types';

export interface VtxoContext {
  /** ids returned by wallet.getVtxosToRefresh() */
  toRefresh?: ReadonlySet<string>;
  /** ids that the SDK lists as inputs of pending rounds / boards / lightning sends */
  pending?: ReadonlySet<string>;
}

function mapState(state: SdkVtxoState | undefined): { state: VtxoState; raw?: string; detail?: string } {
  switch (state?.type) {
    case 'spendable':
      return { state: 'spendable', raw: 'spendable' };
    case 'locked': {
      const h = state.holder;
      const detail = h ? `${h.type}:${String(h.id)}` : undefined;
      return { state: 'locked', raw: 'locked', detail };
    }
    case 'spent':
      return { state: 'spent', raw: 'spent' };
    case 'exited':
      return { state: 'exited', raw: 'exited' };
    default:
      return { state: 'unknown', raw: state ? String((state as { type?: unknown }).type) : undefined };
  }
}

function int(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

export function normalizeVtxo(v: Partial<Vtxo> & { id: string }, ctx: VtxoContext = {}, sourceCall = 'wallet.allVtxos()'): VtxoView {
  const mapped = mapState(v.state);
  const evidence = [`${sourceCall}: id, amountSats, expiryHeight, kind, state, exitDepth, exitTxWeightWu, registered`];
  let state = mapped.state;
  if (state === 'spendable' && ctx.pending?.has(v.id)) {
    state = 'pending';
    evidence.push('wallet.pendingRoundInputVtxos() / pendingBoardVtxos() / pendingLightningSendVtxos(): listed as pending');
  }
  if ((state === 'spendable' || state === 'locked') && ctx.toRefresh?.has(v.id)) {
    state = 'needs-refresh';
    evidence.push('wallet.getVtxosToRefresh(): listed for refresh');
  }
  return {
    id: v.id,
    amountSats: maybeSats(v.amountSats),
    kind: typeof v.kind === 'string' && v.kind !== '' ? v.kind : undefined,
    state,
    rawState: mapped.raw,
    stateDetail: mapped.detail,
    expiryHeight: int(v.expiryHeight),
    exitDepth: int(v.exitDepth),
    exitTxWeightWu: int(v.exitTxWeightWu),
    registered: typeof v.registered === 'boolean' ? v.registered : undefined,
    source: 'sdk',
    evidence,
  };
}

export function normalizeBalance(b: Partial<Balance> | undefined, summary: Partial<BalanceSummary> | undefined, onchainTotal?: number): BalanceView {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(b ?? {})) {
    const s = maybeSats(v);
    if (s !== undefined) raw[k] = s;
  }
  return {
    // T04/T05: spendable is exactly the SDK's spendableSats. Pending and
    // needs-refresh are never added to it.
    spendableSats: maybeSats(b?.spendableSats ?? summary?.spendableSats),
    needsRefreshSats: maybeSats(b?.needsRefreshSats ?? summary?.needsRefreshSats),
    pendingSats: maybeSats(summary?.pendingSats),
    totalSats: maybeSats(summary?.totalSats),
    onchainSats: maybeSats(onchainTotal),
    rawCategories: raw,
  };
}

export function normalizeMovement(m: Partial<Movement> & { id: number }): MovementView {
  return {
    id: String(m.id),
    status: m.status ?? 'unknown',
    kind: [m.subsystemName, m.subsystemKind].filter(Boolean).join(' / ') || 'unknown',
    effectiveBalanceSats: maybeSignedSats(m.effectiveBalanceSats),
    feeSats: maybeSats(m.offchainFeeSats),
    inputVtxoIds: m.inputVtxoIds ?? [],
    outputVtxoIds: m.outputVtxoIds ?? [],
    exitedVtxoIds: m.exitedVtxoIds ?? [],
    sentTo: m.sentToAddresses ?? [],
    receivedOn: m.receivedOnAddresses ?? [],
    createdAt: m.createdAt,
    completedAt: m.completedAt,
    source: 'sdk',
  };
}

export function normalizeServerInfo(info: ArkInfo | undefined, refreshThreshold?: number): ServerInfoView | undefined {
  if (!info) return undefined;
  return {
    network: info.network,
    vtxoLifetimeBlocks: int(info.vtxoLifetime ?? info.vtxoExpiryDelta),
    vtxoExitDeltaBlocks: int(info.vtxoExitDelta),
    maxVtxoExitDepth: int(info.maxVtxoExitDepth),
    roundIntervalSecs: int(info.roundIntervalSecs),
    refreshThresholdBlocks: int(refreshThreshold),
  };
}

export function normalizeFeeEstimate(f: FeeEstimate): FeeEstimateView {
  return {
    grossSats: maybeSats(f.grossAmountSats) ?? 0,
    feeSats: maybeSats(f.feeSats) ?? 0,
    netSats: maybeSats(f.netAmountSats) ?? 0,
    vtxosSpent: f.vtxosSpent ?? [],
    source: 'sdk',
  };
}

export function normalizeExitEstimate(e: EmergencyExitFeeEstimate): ExitEstimateView {
  return {
    broadcastFeeSats: maybeSats(e.exitBroadcastFeeSats) ?? 0,
    claimFeeSats: maybeSats(e.claimFeeSats) ?? 0,
    totalFeeSats: maybeSats(e.totalFeeSats) ?? 0,
    feeRateSatPerVb: e.feeRateSatPerVb,
    txsToBroadcast: e.txsToBroadcast,
    source: 'sdk',
  };
}
