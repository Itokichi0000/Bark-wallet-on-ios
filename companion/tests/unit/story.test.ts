import type { WalletMovement } from "@/domain/wallet";
import { STORY_CHAPTERS, StoryTracker, confirmedSentSats, storyProgress } from "@/game/story";
import { en } from "@/i18n/en";
import { ja } from "@/i18n/ja";

const mv = (id: string, amountSats: string, over: Partial<WalletMovement> = {}): WalletMovement => ({
  id, method: "ark", kind: "arkoor.send", direction: "outgoing", amountSats, feeSats: "100",
  status: "succeeded", rawStatus: "successful", createdAt: "2026-11-24T00:00:00Z", ...over,
});

describe("story progress", () => {
  it("counts only confirmed outgoing payments, without fees", () => {
    expect(confirmedSentSats([
      mv("a", "3000"),
      mv("b", "9999", { status: "pending" }),
      mv("c", "9999", { status: "unknown" }),
      mv("d", "9999", { status: "failed" }),
      mv("e", "9999", { direction: "incoming" }),
      mv("f", "9999", { direction: "internal" }),
      mv("a", "3000"),
    ])).toBe(3000n);
  });

  it("opens chapters at their thresholds and reports the distance to the next", () => {
    expect(storyProgress(0n).unlocked.map((c) => c.id)).toEqual(["c0"]);
    const p = storyProgress(3000n);
    expect(p.unlocked.map((c) => c.id)).toEqual(["c0", "c1"]);
    expect(p.next?.chapter.id).toBe("c2");
    expect(p.next?.remainingSats).toBe(2000n);
    expect(p.next?.fraction).toBeGreaterThan(0.5);
    expect(storyProgress(10_000_000n).next).toBeUndefined();
  });

  it("announces a chapter once and never closes one when history shrinks", () => {
    let saved = "0";
    const opened: string[] = [];
    const t = new StoryTracker({ getSentSats: () => saved, setSentSats: (v) => { saved = v; } }, (c) => opened.push(c.id));
    t.observe([mv("a", "1000", { status: "pending" })]);
    expect(opened).toEqual([]);
    t.observe([mv("a", "1000")]);
    t.observe([mv("a", "1000")]);
    expect(opened).toEqual(["c1"]);
    t.observe([mv("a", "1000"), mv("b", "30000")]);
    expect(opened).toEqual(["c1", "c3"]);
    t.observe([]);
    expect(saved).toBe("31000");
    expect(opened).toHaveLength(2);
  });

  it("has a title and every line in both languages", () => {
    for (const c of STORY_CHAPTERS) {
      for (const key of [`story.${c.id}.title`, ...c.lines.map((_, i) => `story.${c.id}.${i + 1}`)]) {
        expect(ja[key as keyof typeof ja]).toBeTruthy();
        expect(en[key as keyof typeof en]).toBeTruthy();
      }
    }
  });
});
