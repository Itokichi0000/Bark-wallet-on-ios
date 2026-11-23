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
  hapticsEnabled: boolean;
  avatarMotion: boolean;
  /** Follows the OS setting unless the user forces it on. */
  forceReduceMotion: boolean;
  introSeen: boolean;
  questsDone: Record<string, boolean>;
  seedBackupConfirmed: boolean;
  update(patch: Partial<Omit<Settings, "update" | "completeQuest">>): void;
  completeQuest(id: string): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: "ja",
      unit: "sats",
      balanceHidden: false,
      speechEnabled: false,
      hapticsEnabled: true,
      avatarMotion: true,
      forceReduceMotion: false,
      introSeen: false,
      questsDone: {},
      seedBackupConfirmed: false,
      update: (patch) => set(patch),
      completeQuest: (id) => set((s) => (s.questsDone[id] ? s : { questsDone: { ...s.questsDone, [id]: true } })),
    }),
    // Per network: "seed written down", onboarding and quests belong to one wallet. Signet keeps the original key.
    { name: ACTIVE_NETWORK === "signet" ? "bcw.settings.v1" : `bcw.settings.${ACTIVE_NETWORK}.v1`, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
