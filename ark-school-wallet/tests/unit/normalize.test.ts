import { normalizeBalance, normalizeMovement, normalizeServerInfo, normalizeVtxo } from '../../src/lib/bark/normalize';

describe('normalize SDK data', () => {
  const sdkVtxo = { id: 'abc:0', amountSats: 5000, expiryHeight: 331_900, kind: 'arkoor', state: { type: 'spendable' as const }, exitDepth: 3, exitTxWeightWu: 1234, registered: true };

  it('T10: maps fields with evidence; missing fields stay undefined (never 0)', () => {
    const v = normalizeVtxo(sdkVtxo);
    expect(v).toMatchObject({ id: 'abc:0', amountSats: 5000, expiryHeight: 331_900, kind: 'arkoor', state: 'spendable', exitDepth: 3, source: 'sdk' });
    expect(v.evidence[0]).toMatch(/wallet\.allVtxos/);
    const sparse = normalizeVtxo({ id: 'x:1' });
    expect(sparse.amountSats).toBeUndefined();
    expect(sparse.expiryHeight).toBeUndefined();
    expect(sparse.exitDepth).toBeUndefined();
    expect(sparse.state).toBe('unknown');
  });

  it('maps SDK states and lock holders', () => {
    expect(normalizeVtxo({ ...sdkVtxo, state: { type: 'spent' } }).state).toBe('spent');
    expect(normalizeVtxo({ ...sdkVtxo, state: { type: 'exited' } }).state).toBe('exited');
    const locked = normalizeVtxo({ ...sdkVtxo, state: { type: 'locked', holder: { type: 'movement', id: 7 } } });
    expect(locked).toMatchObject({ state: 'locked', stateDetail: 'movement:7' });
  });

  it('marks needs-refresh / pending only from SDK lists', () => {
    expect(normalizeVtxo(sdkVtxo, { toRefresh: new Set(['abc:0']) }).state).toBe('needs-refresh');
    expect(normalizeVtxo(sdkVtxo, { pending: new Set(['abc:0']) }).state).toBe('pending');
    expect(normalizeVtxo({ ...sdkVtxo, state: { type: 'spent' } }, { toRefresh: new Set(['abc:0']) }).state).toBe('spent');
  });

  it('T04/T05: spendable is exactly SDK spendableSats; pending/needs-refresh are never added', () => {
    const b = normalizeBalance(
      { spendableSats: 12_400, needsRefreshSats: 3_000, pendingInRoundSats: 200, pendingExitSats: 0, pendingLightningSendSats: 0, claimableLightningReceiveSats: 0, pendingBoardSats: 0, pendingArkoorSendSats: 0, pendingOffboardSats: 0 },
      { spendableSats: 12_400, needsRefreshSats: 3_000, pendingSats: 200, totalSats: 15_600 },
      777,
    );
    expect(b.spendableSats).toBe(12_400);
    expect(b.needsRefreshSats).toBe(3_000);
    expect(b.pendingSats).toBe(200);
    expect(b.totalSats).toBe(15_600);
    expect(b.onchainSats).toBe(777);
    expect(b.rawCategories.pendingInRoundSats).toBe(200);
  });

  it('balance with missing data stays unknown', () => {
    const b = normalizeBalance(undefined, undefined);
    expect(b.spendableSats).toBeUndefined();
    expect(b.totalSats).toBeUndefined();
  });

  it('movements keep input/output VTXO ids', () => {
    const m = normalizeMovement({ id: 9, status: 'successful', subsystemName: 'bark.arkoor', subsystemKind: 'send', effectiveBalanceSats: -1012, offchainFeeSats: 12, inputVtxoIds: ['a'], outputVtxoIds: ['b'], sentToAddresses: ['tark1x'], createdAt: '2026-01-01T00:00:00Z' });
    expect(m).toMatchObject({ id: '9', kind: 'bark.arkoor / send', effectiveBalanceSats: -1012, feeSats: 12, inputVtxoIds: ['a'], outputVtxoIds: ['b'], sentTo: ['tark1x'] });
  });

  it('server info uses vtxoLifetime and Bark threshold', () => {
    const info = normalizeServerInfo({ network: 'Signet', vtxoLifetime: 144, vtxoExpiryDelta: 144, vtxoExitDelta: 12, maxVtxoExitDepth: 100, roundIntervalSecs: 300 } as never, 12);
    expect(info).toMatchObject({ network: 'Signet', vtxoLifetimeBlocks: 144, refreshThresholdBlocks: 12, maxVtxoExitDepth: 100 });
  });
});
