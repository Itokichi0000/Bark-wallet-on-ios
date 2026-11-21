import { DemoWallet, demoSendFee } from '../../src/lib/demo/DemoWallet';
import { DEMO_FRIEND_ADDRESS, SCENARIOS, scenario } from '../../src/lib/demo/fixtures';

describe('DemoWallet', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never touches the network and never imports the SDK', async () => {
    const d = new DemoWallet('empty', 0);
    await d.receive(10_000);
    await d.sync();
    await d.sendArk({ address: DEMO_FRIEND_ADDRESS, amountSats: 1_000 });
    await d.refreshAll();
    expect(fetchSpy).not.toHaveBeenCalled();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/lib/demo/DemoWallet.ts', 'utf8')).not.toMatch(/@secondts\/bark|bark\/adapter|bark\/client/);
  });

  it('fixtures are marked demo and ids cannot look like real outpoints', () => {
    for (const name of SCENARIOS) {
      const s = scenario(name);
      expect(s.demo).toBe(true);
      for (const v of s.vtxos) expect(v.id.startsWith('demo-')).toBe(true);
    }
  });

  it('only accepts DEMO- addresses (a real address can never be "paid")', async () => {
    const d = new DemoWallet('received', 0);
    expect(await d.validateArkAddress('tark1preal')).toMatchObject({ ok: false });
    expect((await d.sendArk({ address: 'tark1preal', amountSats: 10 })).status).toBe('failed');
  });

  it('send consumes the input and creates change; diffable snapshots', async () => {
    const d = new DemoWallet('received', 0);
    const before = await d.getSnapshot();
    const r = await d.sendArk({ address: DEMO_FRIEND_ADDRESS, amountSats: 1_000 });
    expect(r.status).toBe('succeeded');
    const after = await d.getSnapshot();
    expect(after.balance.spendableSats).toBe(before.balance.spendableSats! - 1_000 - demoSendFee(1_000));
    expect(after.vtxos.filter((v) => v.state === 'spent')).toHaveLength(1);
    const hist = await d.getHistory();
    expect(hist[0]!.sentTo).toEqual([DEMO_FRIEND_ADDRESS]);
    expect(hist[0]!.inputVtxoIds).toHaveLength(1);
  });

  it('T21: double press sends once', async () => {
    const d = new DemoWallet('received', 5);
    const results = await Promise.allSettled([d.sendArk({ address: DEMO_FRIEND_ADDRESS, amountSats: 100 }), d.sendArk({ address: DEMO_FRIEND_ADDRESS, amountSats: 100 })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await d.getHistory()).filter((m) => m.sentTo.length > 0)).toHaveLength(1);
  });

  it('time passing turns VTXOs into needs-refresh; refresh makes a fresh round VTXO', async () => {
    const d = new DemoWallet('received', 0);
    d.advanceBlocks(1_400);
    const s = await d.getSnapshot();
    expect(s.vtxos[0]!.state).toBe('needs-refresh');
    expect(s.balance.spendableSats).toBe(0);
    expect((await d.refreshAll()).status).toBe('succeeded');
    const s2 = await d.getSnapshot();
    const fresh = s2.vtxos.find((v) => v.state === 'spendable')!;
    expect(fresh.kind).toBe('round');
    expect(fresh.expiryHeight! - s2.chainTipHeight!).toBeGreaterThan(1_000);
  });
});
