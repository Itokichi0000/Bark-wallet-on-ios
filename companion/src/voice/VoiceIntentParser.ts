import { parseSatsInput } from "@/domain/money";

export type VoiceIntent =
  | { kind: "SHOW_BALANCE" }
  | { kind: "OPEN_RECEIVE" }
  | { kind: "OPEN_ARCHIVE" }
  | { kind: "OPEN_ASSETS" }
  | { kind: "PREPARE_SEND"; amountSats?: string; max?: boolean }
  | { kind: "ASK_SECRET" }
  | { kind: "HELP"; topic?: string }
  | { kind: "UNKNOWN" };

const SECRET = /(秘密鍵|ひみつかぎ|シード|復元フレーズ|ニーモニック|seed|mnemonic|private key|recovery phrase)/i;
const SEND = /(送金|送って|送りたい|おくって|おくりたい|送る|支払|払って|send|pay)/i;
const ALL = /(全部|ぜんぶ|全額|すべて|全て|everything|all of it|\ball\b|max)/i;
const RECEIVE = /(受取|受け取|うけと|もらう|もらいたい|qr|receive|address|アドレス)/i;
const ARCHIVE = /(履歴|りれき|記録|きろく|取引|history|archive|transactions?)/i;
const ASSETS = /(資産|しさん|vtxo|assets?)/i;
const BALANCE = /(残高|ざんだか|いくら|どれくらい|どのくらい|balance|how much)/i;
const HELP = /(ヘルプ|使い方|つかいかた|教えて|なに|何|help|what is|how do)/i;
const AMOUNT = /([0-9０-９][0-9０-９,，_]*)\s*(sats?|サトシ|さとし|サッツ)/i;

/**
 * Deterministic command parser. No model is involved.
 *
 * It returns intents only. The most it can ever say about money is "the
 * user would like a draft of N sats"; it never carries a destination, since
 * a misheard address must not reach a payment.
 */
export function parseVoiceIntent(utterance: string): VoiceIntent {
  const text = utterance.trim();
  if (text === "") return { kind: "UNKNOWN" };
  // Secrets first: "シードを送って" must not be read as a send.
  if (SECRET.test(text)) return { kind: "ASK_SECRET" };
  if (SEND.test(text)) {
    if (ALL.test(text)) return { kind: "PREPARE_SEND", max: true };
    const m = AMOUNT.exec(text);
    if (m?.[1]) {
      const parsed = parseSatsInput(m[1].replace(/，/g, ","));
      if (parsed.ok && parsed.sats > 0n) return { kind: "PREPARE_SEND", amountSats: parsed.sats.toString() };
    }
    return { kind: "PREPARE_SEND" };
  }
  if (RECEIVE.test(text)) return { kind: "OPEN_RECEIVE" };
  if (ARCHIVE.test(text)) return { kind: "OPEN_ARCHIVE" };
  if (ASSETS.test(text)) return { kind: "OPEN_ASSETS" };
  if (BALANCE.test(text)) return { kind: "SHOW_BALANCE" };
  if (HELP.test(text)) return { kind: "HELP" };
  return { kind: "UNKNOWN" };
}
