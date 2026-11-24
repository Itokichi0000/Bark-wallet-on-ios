import { type AvatarAction, type AvatarCue, type AvatarEmotion, CuePriority } from "@/domain/avatar";
import type { WalletMovement } from "@/domain/wallet";

/**
 * Noa's story. A chapter opens when the wallet's total of *confirmed* outgoing
 * payments reaches its threshold (owner's decision, 2026-11-24: it replaces the
 * design doc's "never reward amounts sent" rule for story chapters only).
 *
 * What keeps it honest:
 *  - only movements the SDK reports as succeeded count; pending, unknown and failed never do;
 *  - fees are not counted, and nothing is counted twice;
 *  - progress is per network, so every chapter can be read on Signet with coins that cost nothing;
 *  - the companion never asks the user to send in order to unlock something.
 */
export interface StoryLine {
  action: AvatarAction;
  emotion: AvatarEmotion;
}
export interface StoryChapter {
  id: string;
  /** Total confirmed sats sent at which the chapter opens. */
  unlockAtSats: bigint;
  /** Text lives in i18n: `story.<id>.title` and `story.<id>.<n>` (1-based). */
  lines: readonly StoryLine[];
}

const l = (action: AvatarAction, emotion: AvatarEmotion): StoryLine => ({ action, emotion });

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  { id: "c0", unlockAtSats: 0n, lines: [l("wave", "happy"), l("talk", "happy"), l("search", "curious"), l("nod", "happy")] },
  { id: "c1", unlockAtSats: 1n, lines: [l("startle", "surprised"), l("talk", "happy"), l("think", "thinking"), l("nod", "happy")] },
  { id: "c2", unlockAtSats: 5_000n, lines: [l("search", "curious"), l("talk", "happy"), l("point-down", "happy"), l("nod", "happy")] },
  { id: "c3", unlockAtSats: 21_000n, lines: [l("think", "thinking"), l("talk", "happy"), l("talk", "neutral"), l("nod", "happy")] },
  { id: "c4", unlockAtSats: 100_000n, lines: [l("hush", "focused"), l("talk", "neutral"), l("think", "thinking"), l("nod", "happy")] },
  { id: "c5", unlockAtSats: 500_000n, lines: [l("yawn", "sleepy"), l("search", "curious"), l("talk", "neutral"), l("nod", "happy")] },
  { id: "c6", unlockAtSats: 1_000_000n, lines: [l("think", "thinking"), l("talk", "happy"), l("talk", "happy"), l("wave", "happy")] },
];

/** Sum of confirmed outgoing payments, without fees. */
export function confirmedSentSats(movements: readonly WalletMovement[]): bigint {
  let total = 0n;
  const seen = new Set<string>();
  for (const m of movements) {
    if (m.direction !== "outgoing" || m.status !== "succeeded" || seen.has(m.id)) continue;
    seen.add(m.id);
    total += BigInt(m.amountSats);
  }
  return total;
}

export interface StoryProgress {
  sentSats: bigint;
  unlocked: StoryChapter[];
  /** The next chapter still closed, and how far away it is. Absent when everything is open. */
  next?: { chapter: StoryChapter; remainingSats: bigint; fraction: number };
}

export function storyProgress(sentSats: bigint): StoryProgress {
  const unlocked = STORY_CHAPTERS.filter((c) => sentSats >= c.unlockAtSats);
  const chapter = STORY_CHAPTERS.find((c) => sentSats < c.unlockAtSats);
  if (!chapter) return { sentSats, unlocked };
  const from = unlocked[unlocked.length - 1]?.unlockAtSats ?? 0n;
  const span = chapter.unlockAtSats - from;
  const fraction = span > 0n ? Number(((sentSats - from) * 1000n) / span) / 1000 : 0;
  return { sentSats, unlocked, next: { chapter, remainingSats: chapter.unlockAtSats - sentSats, fraction } };
}

/** The cue for one line of a chapter, for the story screen to play as the reader advances. */
export function storyLineCue(chapter: StoryChapter, index: number, id: string): AvatarCue {
  const line = chapter.lines[index] ?? { action: "talk" as const, emotion: "happy" as const };
  return { id, ...line, lineKey: `story.${chapter.id}.${index + 1}`, priority: CuePriority.story, interruptible: true, holdMs: 0 };
}

export interface StoryStore {
  /** Highest total seen so far, as a decimal string. */
  getSentSats(): string;
  setSentSats(v: string): void;
}

/**
 * Keeps the high-water mark of confirmed sats sent and announces chapters as they open.
 * The mark never goes down, so a restore that loses old history does not close a chapter.
 * It reads history only: it cannot cause, retry or confirm a payment.
 */
export class StoryTracker {
  constructor(
    private readonly store: StoryStore,
    private readonly onUnlock: (chapter: StoryChapter) => void,
  ) {}

  /** Call with the wallet's current history whenever it changes. Returns the chapters that just opened. */
  observe(movements: readonly WalletMovement[]): StoryChapter[] {
    const before = BigInt(this.store.getSentSats() || "0");
    const now = confirmedSentSats(movements);
    if (now <= before) return [];
    this.store.setSentSats(now.toString());
    const opened = STORY_CHAPTERS.filter((c) => c.unlockAtSats > before && c.unlockAtSats <= now);
    // One announcement, for the furthest chapter, even when a single payment opens several.
    const last = opened[opened.length - 1];
    if (last) this.onUnlock(last);
    return opened;
  }
}
