import { GESTURE_FORBIDDEN, gestureAction } from "@/conversation/gesturePolicy";
import { VOICE_FORBIDDEN, matchSpokenChoice, spokenAmountSats } from "@/conversation/utterance";

describe("hand gestures", () => {
  const ctx = { choices: ["receive", "send"], sensitive: false };

  it("greets, listens, pages and says yes to her suggestion", () => {
    expect(gestureAction("wave", ctx)).toEqual({ kind: "wave-back" });
    expect(gestureAction("palm", ctx)).toEqual({ kind: "listen" });
    expect(gestureAction("thumbsUp", ctx)).toEqual({ kind: "choose", choice: "receive" });
    expect(gestureAction("swipeLeft", { ...ctx, pages: true })).toEqual({ kind: "page", direction: "next" });
    expect(gestureAction("swipeRight", { ...ctx, pages: true })).toEqual({ kind: "page", direction: "previous" });
    expect(gestureAction("swipeLeft", ctx)).toEqual({ kind: "none" });
  });

  it("does nothing on review, authorisation, sending or secret screens", () => {
    for (const g of ["palm", "thumbsUp", "swipeLeft", "swipeRight"] as const) {
      expect(gestureAction(g, { choices: ["send", "back"], sensitive: true, pages: true })).toEqual({ kind: "none" });
    }
  });

  it("never picks a reply that sends, retries or reveals, even when it is suggested", () => {
    for (const choice of GESTURE_FORBIDDEN) {
      expect(gestureAction("thumbsUp", { choices: [choice, "back"], sensitive: false })).toEqual({ kind: "none" });
    }
    expect(gestureAction("thumbsUp", { choices: [], sensitive: false })).toEqual({ kind: "none" });
  });
});

describe("spoken answers", () => {
  const choices = [
    { id: "scan", label: "QRを読む", aliases: ["スキャン", "カメラ"] },
    { id: "paste", label: "貼りつける", aliases: ["貼り付け", "ペースト"] },
    { id: "send", label: "この内容で送金する", aliases: ["送金"] },
    { id: "done", label: "おわる", aliases: ["終わる", "閉じる"] },
  ];

  it("matches the reply she offered, in natural phrasing", () => {
    expect(matchSpokenChoice("スキャンして", choices)).toBe("scan");
    expect(matchSpokenChoice("貼り付けで", choices)).toBe("paste");
    expect(matchSpokenChoice("もう終わる", choices)).toBe("done");
    expect(matchSpokenChoice("えーと", choices)).toBeUndefined();
    expect(matchSpokenChoice("", choices)).toBeUndefined();
  });

  it("can never send or retry by voice", () => {
    expect(matchSpokenChoice("送金", choices)).toBeUndefined();
    expect(matchSpokenChoice("この内容で送金する", choices)).toBeUndefined();
    for (const id of VOICE_FORBIDDEN) expect(matchSpokenChoice(id, [{ id, label: id }])).toBeUndefined();
  });

  it("reads amounts said in digits or kanji", () => {
    expect(spokenAmountSats("3000")).toBe("3000");
    expect(spokenAmountSats("3,000 サッツ")).toBe("3000");
    expect(spokenAmountSats("三千")).toBe("3000");
    expect(spokenAmountSats("二万五千サトシ")).toBe("25000");
    expect(spokenAmountSats("1万")).toBe("10000");
    expect(spokenAmountSats("百二十")).toBe("120");
    expect(spokenAmountSats("ゼロ")).toBeUndefined();
    expect(spokenAmountSats("0")).toBeUndefined();
    expect(spokenAmountSats("送って")).toBeUndefined();
  });
});
