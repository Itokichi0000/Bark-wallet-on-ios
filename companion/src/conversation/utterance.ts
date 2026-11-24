import { parseSatsInput } from "@/domain/money";

/**
 * Reading what the owner said on a conversation screen. Pure and deterministic: no model.
 *
 * Spoken words can pick one of the replies on screen or give an amount for a draft. They are
 * never a destination (a misheard address must not reach a payment) and never confirm a send.
 */
export interface SpokenChoice { id: string; label: string; aliases?: readonly string[] }

const normalise = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[\s、。,.!！?？「」『』・ー〜~]/g, "");

/** Replies a spoken answer may never pick: these move money or repeat a send. */
export const VOICE_FORBIDDEN: readonly string[] = ["send", "retry", "confirm-send"];

export function matchSpokenChoice(text: string, choices: readonly SpokenChoice[]): string | undefined {
  const said = normalise(text);
  if (said === "") return undefined;
  let best: { id: string; score: number } | undefined;
  for (const c of choices) {
    if (VOICE_FORBIDDEN.includes(c.id)) continue;
    for (const raw of [c.label, ...(c.aliases ?? [])]) {
      const word = normalise(raw);
      if (word.length < 2) continue;
      if (said.includes(word) || (word.includes(said) && said.length >= 2)) {
        const score = word.length;
        if (!best || score > best.score) best = { id: c.id, score };
      }
    }
  }
  return best?.id;
}

const KANJI_DIGITS: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

function kanjiNumber(s: string): number | undefined {
  // Handles up to 9999万9999 (e.g. 三千, 二万五千, 1万).
  const m = /^([0-9〇零一二三四五六七八九十百千]*)(?:万([0-9〇零一二三四五六七八九十百千]*))?$/.exec(s);
  if (!m || s === "") return undefined;
  const small = (t: string): number | undefined => {
    if (t === "") return 0;
    if (/^[0-9]+$/.test(t)) return Number(t);
    let total = 0, digit = 0;
    for (const ch of t) {
      if (ch in KANJI_DIGITS) digit = KANJI_DIGITS[ch]!;
      else if (ch in KANJI_UNITS) { total += (digit || 1) * KANJI_UNITS[ch]!; digit = 0; }
      else if (/[0-9]/.test(ch)) digit = digit * 10 + Number(ch);
      else return undefined;
    }
    return total + digit;
  };
  if (s.includes("万")) {
    const hi = small(m[1] ?? ""), lo = small(m[2] ?? "");
    if (hi === undefined || lo === undefined) return undefined;
    return (hi || 1) * 10_000 + lo;
  }
  return small(m[1] ?? "");
}

/** "3000", "3,000サッツ", "三千", "2万5千 sats" → sats as a decimal string. */
export function spokenAmountSats(text: string): string | undefined {
  const t = text.normalize("NFKC").replace(/[,，\s]/g, "").replace(/(sats?|サッツ|サトシ|さとし)$/i, "");
  const m = /([0-9〇零一二三四五六七八九十百千万]+)/.exec(t);
  if (!m) return undefined;
  const n = /^[0-9]+$/.test(m[1]!) ? Number(m[1]) : kanjiNumber(m[1]!);
  if (n === undefined || !Number.isSafeInteger(n) || n <= 0) return undefined;
  const parsed = parseSatsInput(String(n));
  return parsed.ok && parsed.sats > 0n ? parsed.sats.toString() : undefined;
}
