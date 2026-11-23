/**
 * Sats are kept as canonical decimal integer strings (`MoneySats`) at every
 * boundary and as `bigint` inside arithmetic. They never pass through a JS
 * `number`, so nothing here can lose precision.
 */
export type MoneySats = string;

export const SATS_PER_BTC = 100_000_000n;
/** 21 million BTC. Anything above this is not an amount of bitcoin. */
export const MAX_SATS = 21_000_000n * SATS_PER_BTC;

export type ParseResult =
  | { ok: true; sats: bigint }
  | { ok: false; reason: "empty" | "not-a-number" | "negative" | "fractional" | "too-large" };

const FULL_WIDTH_DIGIT = /[０-９]/g;
const GROUPING = /[,_\s　]/g;

/**
 * Parse what a person typed into a whole number of sats.
 *
 * Accepts ASCII or full-width digits with optional thousands separators.
 * Rejects signs, decimals, exponents and anything else rather than guessing.
 */
export function parseSatsInput(input: string): ParseResult {
  const normalised = input
    .replace(FULL_WIDTH_DIGIT, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(GROUPING, "");
  if (normalised === "") return { ok: false, reason: "empty" };
  if (normalised.startsWith("-") || normalised.startsWith("−")) return { ok: false, reason: "negative" };
  if (/^\d+[.．]\d*$/.test(normalised)) return { ok: false, reason: "fractional" };
  if (!/^\d+$/.test(normalised)) return { ok: false, reason: "not-a-number" };
  // Bound the length before BigInt so absurd input cannot allocate a huge value.
  if (normalised.replace(/^0+/, "").length > 16) return { ok: false, reason: "too-large" };
  const sats = BigInt(normalised);
  if (sats > MAX_SATS) return { ok: false, reason: "too-large" };
  return { ok: true, sats };
}

export function toMoney(sats: bigint): MoneySats {
  if (sats < 0n) throw new RangeError("sats cannot be negative");
  return sats.toString(10);
}

/** Strict: only a canonical non-negative decimal integer string is money. */
export function fromMoney(money: MoneySats): bigint {
  if (!/^(0|[1-9]\d*)$/.test(money)) throw new RangeError(`not a canonical sats string: ${money}`);
  return BigInt(money);
}

export function formatSats(sats: bigint): string {
  const negative = sats < 0n;
  const digits = (negative ? -sats : sats).toString(10);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/** Exact BTC rendering, always 8 decimals: 1234 sats -> "0.00001234". */
export function formatBtc(sats: bigint): string {
  const negative = sats < 0n;
  const abs = negative ? -sats : sats;
  const whole = abs / SATS_PER_BTC;
  const frac = (abs % SATS_PER_BTC).toString(10).padStart(8, "0");
  return `${negative ? "-" : ""}${formatSats(whole)}.${frac}`;
}

/**
 * BIP 321 amounts are decimal BTC. Convert without floating point.
 * Returns undefined for anything that is not a plain decimal with at most
 * 8 fractional digits.
 */
export function btcDecimalToSats(amount: string): bigint | undefined {
  const m = /^(\d+)(?:\.(\d{1,8}))?$/.exec(amount.trim());
  if (!m) return undefined;
  const whole = BigInt(m[1] ?? "0");
  const frac = BigInt((m[2] ?? "").padEnd(8, "0") || "0");
  const sats = whole * SATS_PER_BTC + frac;
  return sats > MAX_SATS ? undefined : sats;
}
