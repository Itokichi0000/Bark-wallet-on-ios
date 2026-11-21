import type { VtxoState, VtxoView, WalletSnapshot } from './types';

export interface StateChange {
  id: string;
  from: VtxoState;
  to: VtxoState;
  vtxo: VtxoView;
}

export interface SnapshotDiff {
  comparable: true;
  /** In `after` but not in `before`. */
  created: VtxoView[];
  /** In `before` but gone from `after`, or now in state "spent". */
  consumed: VtxoView[];
  stateChanged: StateChange[];
  unchanged: VtxoView[];
  /** after.spendable − before.spendable, only if both are known. */
  spendableDeltaSats?: number;
  tipAdvancedBlocks?: number;
}

export type SnapshotComparison = SnapshotDiff | { comparable: false; reason: 'different-mode' | 'different-wallet' | 'vtxos-unavailable' };

/**
 * Compares two snapshots by VTXO id (spec 6.2/6.3, T12). Never guesses: if
 * the snapshots come from different wallets/modes or a VTXO list is missing,
 * it refuses to produce a diff.
 */
export function compareSnapshots(before: WalletSnapshot, after: WalletSnapshot): SnapshotComparison {
  if (before.mode !== after.mode) return { comparable: false, reason: 'different-mode' };
  if (before.walletId !== after.walletId) return { comparable: false, reason: 'different-wallet' };
  if (before.vtxosUnavailable || after.vtxosUnavailable) return { comparable: false, reason: 'vtxos-unavailable' };

  const beforeById = new Map(before.vtxos.map((v) => [v.id, v]));
  const afterById = new Map(after.vtxos.map((v) => [v.id, v]));

  const created: VtxoView[] = [];
  const consumed: VtxoView[] = [];
  const stateChanged: StateChange[] = [];
  const unchanged: VtxoView[] = [];

  for (const v of after.vtxos) {
    const prev = beforeById.get(v.id);
    if (!prev) {
      created.push(v);
    } else if (prev.state !== v.state) {
      if (v.state === 'spent') consumed.push(v);
      else stateChanged.push({ id: v.id, from: prev.state, to: v.state, vtxo: v });
    } else {
      unchanged.push(v);
    }
  }
  for (const v of before.vtxos) {
    if (!afterById.has(v.id)) consumed.push(v);
  }

  const a = before.balance.spendableSats;
  const b = after.balance.spendableSats;
  const ta = before.chainTipHeight;
  const tb = after.chainTipHeight;
  return {
    comparable: true,
    created,
    consumed,
    stateChanged,
    unchanged,
    spendableDeltaSats: a !== undefined && b !== undefined ? b - a : undefined,
    tipAdvancedBlocks: ta !== undefined && tb !== undefined ? tb - ta : undefined,
  };
}
