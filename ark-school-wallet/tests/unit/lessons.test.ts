import { readFileSync } from 'node:fs';
import { emergencyExitRoute, expiryModel, offboardRoute, restoreOutcome, simulateSpend } from '../../src/lib/education/lessons';

describe('lesson engine', () => {
  it('T14: lessons import nothing that can touch a wallet', () => {
    for (const f of ['src/lib/education/lessons.ts', 'src/components/lab/Lessons.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/@secondts\/bark|lib\/bark|state\/store|DemoWallet|fetch\(/);
    }
  });

  it('spend: whole input consumed, recipient + change', () => {
    const steps = simulateSpend(10_000, 1_000, 20);
    const last = steps.at(-1)!.coins;
    expect(last.find((c) => c.id === 'A')!.status).toBe('spent');
    expect(last.filter((c) => c.status === 'unspent').reduce((a, c) => a + c.amount, 0)).toBe(10_000 - 20);
    expect(() => simulateSpend(1_000, 2_000, 0)).toThrow();
  });

  it('expiry: refresh keeps a VTXO alive, doing nothing expires it', () => {
    expect(expiryModel({ start: 0, lifetime: 100, threshold: 10, tip: 50 })).toMatchObject({ remainingNoRefresh: 50, remainingWithRefresh: 50, refreshed: false });
    const late = expiryModel({ start: 0, lifetime: 100, threshold: 10, tip: 120 });
    expect(late.remainingNoRefresh).toBe(-20);
    expect(late.refreshed).toBe(true);
    expect(late.remainingWithRefresh).toBeGreaterThan(0);
    expect(() => expiryModel({ start: 0, lifetime: 10, threshold: 10, tip: 0 })).toThrow();
  });

  it('T15: offboard and emergency exit are different routes', () => {
    expect(offboardRoute().reduce((a, s) => a + s.onchainTxs, 0)).toBe(1);
    const ex = emergencyExitRoute(3);
    expect(ex.filter((s) => s.onchainTxs > 0)).toHaveLength(4); // 3 tree txs + claim
    expect(ex.every((s) => s.waitsForConfirmation)).toBe(true);
  });

  it('T16: seed-only restore depends on the server and loses history/exits', () => {
    expect(restoreOutcome('seed-only', 'cooperative')).toEqual({ balance: 'restored', history: 'lost', inProgressExits: 'lost' });
    expect(restoreOutcome('seed-only', 'unavailable').balance).toBe('not-restored');
    expect(restoreOutcome('seed-plus-db', 'unavailable')).toEqual({ balance: 'restored', history: 'restored', inProgressExits: 'restored' });
  });
});
