import { BarkWebAdapter } from '../../src/lib/bark/adapter';
import { readPendingSend, clearPendingSend } from '../../src/lib/wallet/reconcile';
import { fakeOnchain, fakeWallet, statics } from './fakeSdk';

describe('BarkWebAdapter (SDK mocked)', () => {
  beforeEach(() => clearPendingSend());

  it('T04/T05/T10: snapshot uses SDK values with evidence; never adds pending to spendable', async () => {
    const a = new BarkWebAdapter(fakeWallet(), fakeOnchain(1_000), statics, 'w1');
    const s = await a.getSnapshot();
    expect(s.mode).toBe('signet');
    expect(s.chainTipHeight).toBe(1_000);
    expect(s.balance.spendableSats).toBe(8_000);
    expect(s.balance.needsRefreshSats).toBe(3_000);
    expect(s.balance.pendingSats).toBe(200);
    expect(s.vtxos).toHaveLength(3);
    expect(s.vtxos.find((v) => v.id === 'v2:0')!.state).toBe('needs-refresh');
    expect(s.vtxos.find((v) => v.id === 'v3:0')!.state).toBe('spent');
    expect(s.vtxos[0]!.evidence.join()).toMatch(/allVtxos/);
  });

  it('T11: without an on-chain wallet there is no tip, so no blocks-remaining', async () => {
    const s = await new BarkWebAdapter(fakeWallet(), undefined, statics, 'w1').getSnapshot();
    expect(s.chainTipHeight).toBeUndefined();
  });

  it('T13: VTXO list failure is reported, not faked', async () => {
    const w = fakeWallet({ allVtxos: async () => { throw new Error('not supported'); } });
    const s = await new BarkWebAdapter(w, fakeOnchain(), statics, 'w1').getSnapshot();
    expect(s.vtxosUnavailable).toBe(true);
    expect(s.vtxos).toEqual([]);
  });

  it('T07: rejects mainnet / foreign-server addresses', async () => {
    const a = new BarkWebAdapter(fakeWallet(), fakeOnchain(), statics, 'w1');
    expect(await a.validateArkAddress('')).toEqual({ ok: false, reason: 'empty' });
    expect(await a.validateArkAddress('bc1qnotark')).toEqual({ ok: false, reason: 'invalid' });
    expect(await a.validateArkAddress('ark1pmainnet')).toEqual({ ok: false, reason: 'wrong-network' });
    expect(await a.validateArkAddress('tark1pgood')).toEqual({ ok: true });
  });

  it('T07: a send to a mainnet address never reaches the SDK send call', async () => {
    const w = fakeWallet();
    const a = new BarkWebAdapter(w, fakeOnchain(), statics, 'w1');
    const r = await a.sendArk({ address: 'ark1pmainnet', amountSats: 100 });
    expect(r.status).toBe('failed');
    expect(w.sendArkoorPayment).not.toHaveBeenCalled();
  });

  it('T08: successful send returns the movement id and clears the pending marker', async () => {
    const w = fakeWallet();
    const a = new BarkWebAdapter(w, fakeOnchain(), statics, 'w1');
    await a.getSnapshot();
    const r = await a.sendArk({ address: 'tark1pgood', amountSats: 1_000 });
    expect(r).toEqual({ status: 'succeeded', referenceId: '42' });
    expect(w.sendArkoorPayment).toHaveBeenCalledWith('tark1pgood', 1_000);
    expect(readPendingSend('w1')).toBeUndefined();
  });

  it('refuses amounts above spendable before calling the SDK', async () => {
    const w = fakeWallet();
    const a = new BarkWebAdapter(w, fakeOnchain(), statics, 'w1');
    await a.getSnapshot();
    expect((await a.sendArk({ address: 'tark1pgood', amountSats: 9_000 })).status).toBe('failed');
    expect(w.sendArkoorPayment).not.toHaveBeenCalled();
  });

  it('T09: an SDK error makes the outcome UNKNOWN, is remembered, and is never retried', async () => {
    const w = fakeWallet({ sendArkoorPayment: vi.fn(async () => { throw new Error('connection reset'); }) });
    const a = new BarkWebAdapter(w, fakeOnchain(), statics, 'w1');
    await a.getSnapshot();
    const r = await a.sendArk({ address: 'tark1pgood', amountSats: 1_000 });
    expect(r.status).toBe('unknown');
    expect(w.sendArkoorPayment).toHaveBeenCalledTimes(1);
    expect(readPendingSend('w1')).toMatchObject({ phase: 'unknown', amountSats: 1_000, address: 'tark1pgood' });
  });

  it('T21: concurrent presses start exactly one payment', async () => {
    let release!: () => void;
    const w = fakeWallet({ sendArkoorPayment: vi.fn(() => new Promise<number>((res) => { release = () => res(7); })) });
    const a = new BarkWebAdapter(w, fakeOnchain(), statics, 'w1');
    await a.getSnapshot();
    const first = a.sendArk({ address: 'tark1pgood', amountSats: 100 });
    const others = Promise.allSettled([a.sendArk({ address: 'tark1pgood', amountSats: 100 }), a.sendArk({ address: 'tark1pgood', amountSats: 100 })]);
    expect((await others).every((p) => p.status === 'rejected')).toBe(true);
    await vi.waitFor(() => expect(w.sendArkoorPayment).toHaveBeenCalledTimes(1));
    release();
    expect((await first).status).toBe('succeeded');
    expect(w.sendArkoorPayment).toHaveBeenCalledTimes(1);
  });

  it('read-only exit/refresh helpers map SDK estimates', async () => {
    const a = new BarkWebAdapter(fakeWallet(), fakeOnchain(), statics, 'w1');
    expect(await a.estimateExit(['v1:0'])).toMatchObject({ totalFeeSats: 1500, txsToBroadcast: 3, source: 'sdk' });
    expect(await a.getExitTransactions(['v1:0'])).toEqual([{ vtxoId: 'v1:0', txids: ['t1', 't2'], source: 'sdk' }]);
    expect(await a.getExitTransactions([])).toEqual([]);
    expect(await a.estimateRefreshFee(['v2:0'])).toMatchObject({ feeSats: 6, source: 'sdk' });
    expect(await a.getServerInfo()).toMatchObject({ network: 'Signet', vtxoLifetimeBlocks: 144, refreshThresholdBlocks: 12 });
  });

  it('declares refresh/offboard/exit execution as disabled and DB export as unsupported', () => {
    const caps = new BarkWebAdapter(fakeWallet(), undefined, statics, 'w1').getCapabilities();
    expect(caps.refresh).toBe('disabled');
    expect(caps.offboard).toBe('disabled');
    expect(caps.exitStatus).toBe('disabled');
    expect(caps.exportWalletBackup).toBe('unsupported');
    expect(caps.sendArk).toBe('supported');
  });
});
