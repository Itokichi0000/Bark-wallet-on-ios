import type { DomainEvent } from "@/domain/events";

export const QUEST_IDS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;
export type QuestId = (typeof QUEST_IDS)[number];

/**
 * Quests are completed by understanding or trying something once. Nothing
 * here looks at amounts, balances or how often money moved, so there is no
 * way to "level up" by spending.
 */
export function questForEvent(e: DomainEvent): QuestId | undefined {
  switch (e.type) {
    case "APP_READY": return "q1";
    case "RECEIVE_SHOWN": return "q2";
    case "PAYMENT_RECEIVED": return "q3";
    case "PAYMENT_SUCCEEDED": return "q4";
    default: return undefined;
  }
}
