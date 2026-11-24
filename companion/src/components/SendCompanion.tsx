import { useMemo } from "react";
import { CuePriority, type AvatarCue } from "@/domain/avatar";
import type { SendPhase } from "@/domain/payment";
import { Companion } from "./Companion";

/** Presentation of the service/reducer state, never a payment event or a success pose. */
export function useSendPresentation(phase: SendPhase): AvatarCue | undefined {
  return useMemo(() => {
    const base = { id: `send-stage:${phase}`, priority: CuePriority.scene + 1, holdMs: 0, interruptible: true };
    // Local presentation fallback while the service has no review-ready cue API.
    if (phase === "review") return { ...base, priority: CuePriority.sendInput + 1, action: "prepare-send", emotion: "focused", lineKey: "avatar.review" };
    if (phase === "authorizing") return { ...base, priority: CuePriority.sendInput + 1, action: "hush", emotion: "focused", lineKey: "avatar.act.auth-asked" };
    if (phase === "submitting") return { ...base, action: "sending", emotion: "focused", lineKey: "avatar.sending" };
    if (phase === "pending" || phase === "unknown") return { ...base, action: "idle", emotion: "neutral", lineKey: "avatar.unknown" };
    if (phase === "failed") return { ...base, action: "warn", emotion: "concerned", lineKey: "avatar.failed" };
    if (phase === "succeeded") return { ...base, action: "idle", emotion: "neutral", lineKey: "avatar.sent" };
    return undefined;
  }, [phase]);
}

export function SendResultCompanion({ phase, operationId }: { phase: SendPhase; operationId?: string }) {
  const fallback = useSendPresentation(phase);
  return <Companion scene="send" sendResult={{ phase, operationId }} large fallbackCue={fallback} unresolved={phase === "pending" || phase === "unknown"} />;
}
