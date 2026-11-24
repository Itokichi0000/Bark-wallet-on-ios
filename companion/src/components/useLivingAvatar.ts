import { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarCue } from "@/domain/avatar";
import { IdleDirector } from "@/game/IdleDirector";
import { CLIP_DURATION_MS, isHolding } from "@/game/avatarMotion";

/** Local, silent acting only. Never feeds idle gestures back into the orchestrator. */
export function useLivingAvatar(cue: AvatarCue, reduceMotion: boolean, paused = false): AvatarCue {
  const [director] = useState(() => new IdleDirector());
  const [beat, setBeat] = useState<AvatarCue>();
  const [restingId, setRestingId] = useState<string>();
  const entered = useRef({ id: cue.id, at: Date.now() });
  const eligible = !isHolding(cue) && (cue.action === "idle" || (cue.holdMs === 0 && /^(avatar\.screen\.|story\.|talk\.send\.(destination|amount)$)/.test(cue.lineKey ?? "")));
  useEffect(() => {
    if (entered.current.id !== cue.id) {
      entered.current = { id: cue.id, at: Date.now() };
      setRestingId(undefined);
    }
    setBeat(undefined);
    if (reduceMotion || paused || !eligible) return;
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
    else {
      // Typing may have already outlasted the entry gesture; do not wait another full clip.
      const remaining = Math.max(0, CLIP_DURATION_MS + 160 - (Date.now() - entered.current.at));
      timer = setTimeout(() => { setRestingId(cue.id); schedule(); }, remaining);
    }
    return () => clearTimeout(timer);
  }, [cue, director, eligible, paused, reduceMotion]);
  return useMemo(() => {
    if (reduceMotion || !eligible) return cue;
    if (!paused && beat?.id.startsWith(`idle-beat:${cue.id}:`)) return beat;
    // Stable between letters: the memoised stage must not redraw its avatar for every glyph.
    return restingId === cue.id ? { ...cue, id: `${cue.id}:rest`, action: "idle", emotion: "neutral" } : cue;
  }, [reduceMotion, eligible, cue, paused, beat, restingId]);
}
