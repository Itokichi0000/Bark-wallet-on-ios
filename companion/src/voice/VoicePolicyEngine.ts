import type { VoiceIntent } from "./VoiceIntentParser";

/**
 * Everything voice (or, later, a model) is allowed to cause.
 *
 * There is intentionally no action that submits a payment, reads a secret,
 * or touches a backup key. Adding one here is the only way voice could gain
 * that power, which makes this union the thing to review.
 */
export type VoiceAction =
  | { kind: "SAY"; lineKey: string; params?: Record<string, string> }
  | { kind: "NAVIGATE"; to: "send" | "receive" | "archive" | "assets"; lineKey: string }
  | { kind: "OPEN_SEND_DRAFT"; amountSats?: string; requestMax?: boolean; lineKey: string };

export interface VoiceContext {
  spendableSats?: string;
  lastSyncedAt?: string;
  balanceHidden: boolean;
}

export function decideVoiceAction(intent: VoiceIntent, ctx: VoiceContext): VoiceAction {
  switch (intent.kind) {
    case "ASK_SECRET":
      return { kind: "SAY", lineKey: "voice.secretRefused" };
    case "SHOW_BALANCE":
      if (ctx.balanceHidden) return { kind: "SAY", lineKey: "voice.balanceHidden" };
      if (ctx.spendableSats === undefined || ctx.lastSyncedAt === undefined) return { kind: "SAY", lineKey: "voice.balanceUnknown" };
      return { kind: "SAY", lineKey: "voice.balance", params: { sats: ctx.spendableSats } };
    case "OPEN_RECEIVE":
      return { kind: "NAVIGATE", to: "receive", lineKey: "voice.openReceive" };
    case "OPEN_ARCHIVE":
      return { kind: "NAVIGATE", to: "archive", lineKey: "voice.openArchive" };
    case "OPEN_ASSETS":
      return { kind: "NAVIGATE", to: "assets", lineKey: "voice.openAssets" };
    case "PREPARE_SEND":
      // Always a draft. The send screen still validates, quotes, reviews and authenticates.
      return {
        kind: "OPEN_SEND_DRAFT",
        amountSats: intent.max ? undefined : intent.amountSats,
        requestMax: intent.max === true,
        lineKey: intent.max ? "voice.sendMax" : "voice.sendDraft",
      };
    case "HELP":
      return { kind: "SAY", lineKey: "voice.help" };
    case "UNKNOWN":
      return { kind: "SAY", lineKey: "voice.unknown" };
  }
}
