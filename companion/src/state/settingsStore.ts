import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { ACTIVE_NETWORK } from "@/config/network";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "ja" | "en";
export type Unit = "sats" | "btc";

/** Non-secret preferences only. Nothing about keys or funds is stored here. */
export interface Settings {
  language: Language;
  unit: Unit;
  balanceHidden: boolean;
  speechEnabled: boolean;
  /** Noa's recorded voice, or off. Japanese only; other languages stay silent unless read-aloud is on. */
  noaVoice: "off" | "a" | "b" | "c";
  hapticsEnabled: boolean;
  avatarMotion: boolean;
  /** Follows the OS setting unless the user forces it on. */
  forceReduceMotion: boolean;
  introSeen: boolean;
  questsDone: Record<string, boolean>;
  seedBackupConfirmed: boolean;
  /** Highest total of confirmed outgoing sats ever seen in this wallet's history (decimal string). Story progress only. */
  storySentSats: string;
  /** Chapters the user has read. */
  storyRead: Record<string, boolean>;
  markStoryRead(id: string): void;
  update(patch: Partial<Omit<Settings, "update" | "completeQuest" | "markStoryRead">>): void;
  completeQuest(id: string): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: "ja",
      unit: "sats",
      balanceHidden: false,
      speechEnabled: false,
      noaVoice: "a",
      hapticsEnabled: true,
      avatarMotion: true,
      forceReduceMotion: false,
      introSeen: false,
      questsDone: {},
      seedBackupConfirmed: false,
      storySentSats: "0",
      storyRead: {},
      markStoryRead: (id) => set((s) => (s.storyRead[id] ? s : { storyRead: { ...s.storyRead, [id]: true } })),
      update: (patch) => set(patch),
      completeQuest: (id) => set((s) => (s.questsDone[id] ? s : { questsDone: { ...s.questsDone, [id]: true } })),
    }),
    // Per network: "seed written down", onboarding and quests belong to one wallet. Signet keeps the original key.
    { name: ACTIVE_NETWORK === "signet" ? "bcw.settings.v1" : `bcw.settings.${ACTIVE_NETWORK}.v1`, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
