import { useEffect, useState } from "react";
import type { AvatarCue } from "@/domain/avatar";
import { IdleDirector } from "@/game/IdleDirector";
import { CLIP_DURATION_MS } from "@/game/avatarMotion";

/** Local, silent acting only. Never feeds idle gestures back into the orchestrator. */
export function useLivingAvatar(cue: AvatarCue, reduceMotion: boolean): AvatarCue {
  const [director] = useState(() => new IdleDirector());
  const [beat, setBeat] = useState<AvatarCue>();
  const [restingId, setRestingId] = useState<string>();
  const eligible = cue.action === "idle" || (cue.holdMs === 0 && /^avatar\.screen\./.test(cue.lineKey ?? ""));
  useEffect(() => {
    setBeat(undefined);
    setRestingId(undefined);
    if (reduceMotion || !eligible) return;
    let timer: ReturnType<typeof setTimeout>;
    let sequence = 0;
    const schedule = () => { timer = setTimeout(play, director.nextDelayMs()); };
    const play = () => {
      const next = director.next();
      if (next.action === "blink") { schedule(); return; }
      setBeat({ ...cue, id: `idle-beat:${cue.id}:${++sequence}`, action: next.action, emotion: next.emotion });
      timer = setTimeout(() => { setBeat(undefined); schedule(); }, Math.max(next.durationMs, CLIP_DURATION_MS + 160));
    };
    if (cue.action === "idle") schedule();
    else timer = setTimeout(() => { setRestingId(cue.id); schedule(); }, CLIP_DURATION_MS + 160);
    return () => clearTimeout(timer);
  }, [cue, director, eligible, reduceMotion]);
  if (reduceMotion || !eligible) return cue;
  if (beat?.id.startsWith(`idle-beat:${cue.id}:`)) return beat;
  // Returning from a local beat must not replay the original screen gesture.
  return restingId === cue.id ? { ...cue, id: `${cue.id}:rest`, action: "idle", emotion: "neutral" } : cue;
}
