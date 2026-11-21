import type { Sats } from './types';

/** Total bitcoin supply in sats. Anything above is certainly invalid. */
export const MAX_SATS = 2_100_000_000_000_000;

export class SatsError extends Error {}

/** Accepts a number from the SDK and asserts it is a safe, non-negative integer. */
export function toSats(value: unknown, field = 'amount'): Sats {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_SATS) {
    throw new SatsError(`${field} is not a valid sat amount: ${String(value)}`);
  }
  return value;
}

/** Like toSats but returns undefined instead of throwing (missing / malformed field). */
export function maybeSats(value: unknown): Sats | undefined {
  try {
    return toSats(value);
  } catch {
    return undefined;
  }
}

/** Signed variant for balance deltas. */
export function maybeSignedSats(value: unknown): Sats | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > MAX_SATS) return undefined;
  return value;
}

/**
 * Parses user input. Only plain digits (an optional thousands separator is
 * tolerated). Goes through BigInt so "9007199254740993" can't silently round.
 */
export function parseSatsInput(input: string): { ok: true; sats: Sats } | { ok: false; reason: 'empty' | 'format' | 'zero' | 'too-large' } {
  const cleaned = input.trim().replace(/[,_\s]/g, '');
  if (cleaned === '') return { ok: false, reason: 'empty' };
  if (!/^\d+$/.test(cleaned)) return { ok: false, reason: 'format' };
  const big = BigInt(cleaned);
  if (big === 0n) return { ok: false, reason: 'zero' };
  if (big > BigInt(MAX_SATS)) return { ok: false, reason: 'too-large' };
  return { ok: true, sats: Number(big) };
}

export function formatSats(value: Sats | undefined, locale: string): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function sumSats(values: Array<Sats | undefined>): Sats | undefined {
  let total = 0;
  for (const v of values) {
    if (v === undefined) return undefined;
    total += v;
  }
  return toSats(total, 'sum');
}
