import { DEFAULT_REVIEW_THRESHOLD_BLOCKS, approxHours, assessRisk, blocksRemaining, reviewThreshold } from '../../src/lib/wallet/expiry';

describe('expiry', () => {
  it('T11: no blocks-remaining without both heights', () => {
    expect(blocksRemaining(1000, undefined)).toBeUndefined();
    expect(blocksRemaining(undefined, 900)).toBeUndefined();
    expect(blocksRemaining(1000, 900)).toBe(100);
    expect(blocksRemaining(900, 1000)).toBe(-100); // negative is kept
  });

  it('time estimate is a 10-minute reference', () => {
    expect(approxHours(6)).toBe(1);
    expect(approxHours(undefined)).toBeUndefined();
  });

  it('review threshold comes from server/Bark data', () => {
    expect(reviewThreshold({ vtxoLifetimeBlocks: 144, refreshThresholdBlocks: 12 })).toBe(36); // Second Signet, 2026-11-21
    expect(reviewThreshold({ vtxoLifetimeBlocks: 4032, refreshThresholdBlocks: 288 })).toBe(1008);
    expect(reviewThreshold({ refreshThresholdBlocks: 50 })).toBe(50);
    expect(reviewThreshold(undefined)).toBe(DEFAULT_REVIEW_THRESHOLD_BLOCKS);
  });

  describe('risk ladder (spec 7.2)', () => {
    const base = { state: 'spendable' as const, expiryHeight: 1_000, exitDepth: 2 };
    it('no data when tip or expiry unknown', () => {
      expect(assessRisk({ vtxo: base }).level).toBe('no-data');
      expect(assessRisk({ vtxo: { ...base, expiryHeight: undefined }, tipHeight: 10 }).level).toBe('no-data');
      expect(assessRisk({ vtxo: { ...base, state: 'unknown' }, tipHeight: 10 }).level).toBe('no-data');
    });
    it('healthy / review by threshold', () => {
      expect(assessRisk({ vtxo: base, tipHeight: 500, reviewThresholdBlocks: 100 }).level).toBe('healthy');
      const r = assessRisk({ vtxo: base, tipHeight: 950, reviewThresholdBlocks: 100 });
      expect(r.level).toBe('review');
      expect(r.reasons).toContain('near-expiry');
    });
    it('SDK needs-refresh → action needed', () => {
      expect(assessRisk({ vtxo: { ...base, state: 'needs-refresh' }, tipHeight: 100 }).level).toBe('action-needed');
    });
    it('expired / spent / exited', () => {
      expect(assessRisk({ vtxo: base, tipHeight: 1_000 }).level).toBe('expired-or-exited');
      expect(assessRisk({ vtxo: { ...base, state: 'spent' }, tipHeight: 1 }).level).toBe('expired-or-exited');
      expect(assessRisk({ vtxo: { ...base, state: 'exited' } }).level).toBe('expired-or-exited');
    });
    it('exit depth near server max → review', () => {
      const r = assessRisk({ vtxo: { ...base, exitDepth: 99 }, tipHeight: 10, reviewThresholdBlocks: 10, maxExitDepth: 100 });
      expect(r.level).toBe('review');
      expect(r.reasons).toContain('near-max-exit-depth');
    });
  });
});
