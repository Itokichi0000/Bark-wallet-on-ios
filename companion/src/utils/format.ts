import { formatBtc, formatSats, fromMoney } from "@/domain/money";
import type { Unit } from "@/state/settingsStore";

export function formatAmount(money: string, unit: Unit): string {
  const sats = fromMoney(money);
  return unit === "btc" ? `${formatBtc(sats)} BTC` : `${formatSats(sats)} sats`;
}

/** First and last characters of a long address, for lists. Review screens show the whole thing. */
export function shorten(text: string, head = 10, tail = 8): string {
  return text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
}

/** Split into groups of 4 so a full address can be compared by eye. */
export function chunkAddress(text: string): string {
  return text.replace(/(.{4})/g, "$1 ").trim();
}

export function formatTime(iso: string | undefined, language: "ja" | "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function minutesSince(iso: string | undefined, now: number = Date.now()): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? undefined : Math.max(0, Math.floor((now - t) / 60000));
}
