import { MAX_SATS, formatSats, maybeSats, parseSatsInput, sumSats, toSats } from '../../src/lib/wallet/sats';

describe('sats (integer safety)', () => {
  it('accepts safe non-negative integers only', () => {
    expect(toSats(0)).toBe(0);
    expect(toSats(2_100)).toBe(2_100);
    expect(() => toSats(1.5)).toThrow();
    expect(() => toSats(-1)).toThrow();
    expect(() => toSats(MAX_SATS + 1)).toThrow();
    expect(() => toSats('100')).toThrow();
    expect(maybeSats(undefined)).toBeUndefined();
    expect(maybeSats(Number.NaN)).toBeUndefined();
  });

  it('parses user input without float rounding', () => {
    expect(parseSatsInput('1,000')).toEqual({ ok: true, sats: 1000 });
    expect(parseSatsInput(' 42 ')).toEqual({ ok: true, sats: 42 });
    expect(parseSatsInput('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseSatsInput('0')).toEqual({ ok: false, reason: 'zero' });
    expect(parseSatsInput('1.5')).toEqual({ ok: false, reason: 'format' });
    expect(parseSatsInput('1e3')).toEqual({ ok: false, reason: 'format' });
    expect(parseSatsInput('-5')).toEqual({ ok: false, reason: 'format' });
    expect(parseSatsInput('9007199254740993')).toEqual({ ok: false, reason: 'too-large' });
  });

  it('sums and formats', () => {
    expect(sumSats([1, 2, 3])).toBe(6);
    expect(sumSats([1, undefined])).toBeUndefined();
    expect(formatSats(12400, 'ja-JP')).toBe('12,400');
    expect(formatSats(undefined, 'en-US')).toBe('—');
  });
});
