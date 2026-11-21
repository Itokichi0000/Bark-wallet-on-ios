import { compareSnapshots } from '../../src/lib/wallet/snapshots';
import type { VtxoView, WalletSnapshot } from '../../src/lib/wallet/types';

const v = (id: string, state: VtxoView['state'] = 'spendable', amountSats = 1000): VtxoView => ({ id, state, amountSats, source: 'sdk', evidence: [] });
const snap = (vtxos: VtxoView[], extra: Partial<WalletSnapshot> = {}): WalletSnapshot => ({
  mode: 'signet', walletId: 'w1', capturedAt: '2026-01-01T00:00:00Z', chainTipHeight: 100, balance: { spendableSats: vtxos.filter((x) => x.state === 'spendable').reduce((a, x) => a + (x.amountSats ?? 0), 0), rawCategories: {} }, vtxos, ...extra,
});

describe('compareSnapshots (T12)', () => {
  it('finds consumed, created and state changes by id', () => {
    const before = snap([v('a'), v('b'), v('c')]);
    const after = snap([v('a', 'spent'), v('c', 'locked'), v('d', 'spendable', 400)], { chainTipHeight: 103 });
    const d = compareSnapshots(before, after);
    if (!d.comparable) throw new Error('should compare');
    expect(d.consumed.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(d.created.map((x) => x.id)).toEqual(['d']);
    expect(d.stateChanged).toEqual([expect.objectContaining({ id: 'c', from: 'spendable', to: 'locked' })]);
    expect(d.spendableDeltaSats).toBe(400 - 3000);
    expect(d.tipAdvancedBlocks).toBe(3);
  });

  it('refuses to compare different wallets, modes or missing lists', () => {
    expect(compareSnapshots(snap([]), snap([], { walletId: 'w2' }))).toEqual({ comparable: false, reason: 'different-wallet' });
    expect(compareSnapshots(snap([]), snap([], { mode: 'demo' }))).toEqual({ comparable: false, reason: 'different-mode' });
    expect(compareSnapshots(snap([]), snap([], { vtxosUnavailable: true }))).toEqual({ comparable: false, reason: 'vtxos-unavailable' });
  });

  it('does not invent a delta when a balance is unknown', () => {
    const d = compareSnapshots(snap([], { balance: { rawCategories: {} } }), snap([]));
    expect(d.comparable && d.spendableDeltaSats).toBeUndefined();
  });
});
