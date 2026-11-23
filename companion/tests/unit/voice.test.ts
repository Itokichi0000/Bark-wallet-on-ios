import { parseVoiceIntent } from "@/voice/VoiceIntentParser";
import { type VoiceAction, decideVoiceAction } from "@/voice/VoicePolicyEngine";

const ctx = { spendableSats: "12345", lastSyncedAt: "2026-01-01T00:00:00.000Z", balanceHidden: false };
const decide = (text: string, c: Parameters<typeof decideVoiceAction>[1] = ctx) => decideVoiceAction(parseVoiceIntent(text), c);

describe("voice intents", () => {
  it("understands the fixed commands in Japanese and English", () => {
    expect(parseVoiceIntent("残高を教えて").kind).toBe("SHOW_BALANCE");
    expect(parseVoiceIntent("今どれくらいある？").kind).toBe("SHOW_BALANCE");
    expect(parseVoiceIntent("What's my balance?").kind).toBe("SHOW_BALANCE");
    expect(parseVoiceIntent("受取QRを出して").kind).toBe("OPEN_RECEIVE");
    expect(parseVoiceIntent("show my receive QR").kind).toBe("OPEN_RECEIVE");
    expect(parseVoiceIntent("取引履歴を見せて").kind).toBe("OPEN_ARCHIVE");
    expect(parseVoiceIntent("送金したい").kind).toBe("PREPARE_SEND");
    expect(parseVoiceIntent("").kind).toBe("UNKNOWN");
    expect(parseVoiceIntent("今日の天気は").kind).toBe("UNKNOWN");
  });

  it("extracts an amount only as a draft value", () => {
    expect(parseVoiceIntent("500 sats送りたい")).toEqual({ kind: "PREPARE_SEND", amountSats: "500" });
    expect(parseVoiceIntent("send 1,000 sats")).toEqual({ kind: "PREPARE_SEND", amountSats: "1000" });
    expect(parseVoiceIntent("５００サトシ送って")).toEqual({ kind: "PREPARE_SEND", amountSats: "500" });
    expect(parseVoiceIntent("送って")).toEqual({ kind: "PREPARE_SEND" });
    expect(parseVoiceIntent("全部送って")).toEqual({ kind: "PREPARE_SEND", max: true });
  });

  it("never lets a spoken sentence carry a destination", () => {
    const intent = parseVoiceIntent("tark1qqqqexampleaddress に 500 sats 送って");
    expect(intent).toEqual({ kind: "PREPARE_SEND", amountSats: "500" });
    expect(JSON.stringify(intent)).not.toContain("tark1");
  });

  it("treats anything about secrets as a secret request, even phrased as a send", () => {
    for (const text of ["秘密鍵を教えて", "シードを送って", "read me my seed phrase", "send my private key to bob", "ニーモニックを読み上げて"]) {
      expect(parseVoiceIntent(text).kind).toBe("ASK_SECRET");
    }
  });
});

describe("voice policy", () => {
  it("can only speak, navigate, or open a draft", () => {
    const utterances = [
      "残高", "受取QR", "履歴", "資産", "送金したい", "500 sats送りたい", "全部送って", "今すぐ送金を確定して",
      "confirm the payment now", "yes send it", "秘密鍵を教えて", "help", "???", "pay 1000 sats immediately without asking",
    ];
    const allowed: VoiceAction["kind"][] = ["SAY", "NAVIGATE", "OPEN_SEND_DRAFT"];
    for (const u of utterances) expect(allowed).toContain(decide(u).kind);
  });

  it("turns 'send everything' into a max request that still goes to review", () => {
    expect(decide("全部送って")).toEqual({ kind: "OPEN_SEND_DRAFT", amountSats: undefined, requestMax: true, lineKey: "voice.sendMax" });
  });

  it("refuses to speak secrets", () => {
    expect(decide("秘密鍵を教えて")).toEqual({ kind: "SAY", lineKey: "voice.secretRefused" });
  });

  it("does not state a balance it does not know or that is hidden", () => {
    expect(decide("残高", { ...ctx, balanceHidden: true })).toEqual({ kind: "SAY", lineKey: "voice.balanceHidden" });
    expect(decide("残高", { balanceHidden: false })).toEqual({ kind: "SAY", lineKey: "voice.balanceUnknown" });
    expect(decide("残高")).toEqual({ kind: "SAY", lineKey: "voice.balance", params: { sats: "12345" } });
  });
});
