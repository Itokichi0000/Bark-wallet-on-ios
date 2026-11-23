import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import type { AvatarCue } from "@/domain/avatar";
import { avatar } from "@/container";
import { useSettings } from "@/state/settingsStore";

export function useAvatarCue(): AvatarCue {
  const [cue, setCue] = useState<AvatarCue>(avatar.cue);
  useEffect(() => {
    setCue(avatar.cue);
    return avatar.subscribe(setCue);
  }, []);
  return cue;
}

export function useReduceMotion(): boolean {
  const forced = useSettings((s) => s.forceReduceMotion);
  const avatarMotion = useSettings((s) => s.avatarMotion);
  const [os, setOs] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setOs(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOs);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return os || forced || !avatarMotion;
}
