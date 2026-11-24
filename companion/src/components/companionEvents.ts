import { createContext, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { avatar, bus } from "@/container";
import { CuePriority } from "@/domain/avatar";
import type { SceneId, UserAction } from "@/domain/events";

export const SceneContext = createContext<SceneId>("home");

/** Interaction names only: never include wallet values or secrets. */
export function userAction(action: UserAction) {
  bus.emit({ type: "USER_ACTION", id: bus.nextId("action"), action });
}

export function useSceneFocus(scene?: SceneId) {
  useFocusEffect(useCallback(() => {
    if (!scene) return;
    // Retire an old greeting/reaction on entry, without touching payment/safety cues.
    avatar.cancel(CuePriority.reaction);
    bus.emit({ type: "SCREEN_ENTERED", id: bus.nextId("screen"), screen: scene });
  }, [scene]));
}
