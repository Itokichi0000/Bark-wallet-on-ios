import type { AvatarAction, AvatarEmotion } from "@/domain/avatar";
import type { SendState } from "@/domain/payment";

/**
 * The wallet as a conversation with Noa. These pure functions say what she asks
 * next and which answers the user is offered; the screen renders them as a
 * dialogue box with choices. They decide nothing about money: every answer maps
 * to an existing action of the send reducer or the wallet service, and the
 * review step still shows the full PaymentReview with its deliberate send control.
 */
export interface Turn<Step extends string, Choice extends string> {
  step: Step;
  /** i18n key of her line. */
  lineKey: string;
  action: AvatarAction;
  emotion: AvatarEmotion;
  /** Answers to offer, in order. The first is the suggested one. */
  choices: readonly Choice[];
}

/** What the user can ask for from the stage. */
export const STAGE_CHOICES = ["receive", "send", "activity", "coins", "story", "guide", "settings"] as const;
export type StageChoice = (typeof STAGE_CHOICES)[number];

export type SendStep =
  | "destination" | "checking" | "bad-destination" | "amount" | "quoting"
  | "review" | "auth" | "sending" | "pending" | "sent" | "failed" | "unknown";
export type SendChoice =
  | "scan" | "paste" | "type" | "clear" | "confirm-amount" | "max" | "change-destination"
  | "send" | "back" | "retry" | "activity" | "done";

export type SendTurn = Turn<SendStep, SendChoice>;

const turn = (step: SendStep, action: AvatarAction, emotion: AvatarEmotion, choices: readonly SendChoice[]): SendTurn =>
  ({ step, lineKey: `talk.send.${step}`, action, emotion, choices });

export function sendTurn(state: SendState): SendTurn {
  switch (state.phase) {
    case "validating": return turn("checking", "search", "curious", []);
    case "quoting": return turn("quoting", "think", "thinking", []);
    case "review": return turn("review", "prepare-send", "focused", ["send", "back"]);
    case "authorizing": return turn("auth", "hush", "focused", []);
    case "submitting": return turn("sending", "sending", "focused", []);
    // Not final: no retry is ever offered here.
    case "pending": return turn("pending", "think", "neutral", ["activity", "done"]);
    case "unknown": return turn("unknown", "think", "concerned", ["activity", "done"]);
    case "succeeded": return turn("sent", "celebrate", "happy", ["done", "activity"]);
    case "failed": return turn("failed", "warn", "concerned", ["retry", "done"]);
    case "editing": break;
  }
  if (!state.check) return turn("destination", "point-down", "happy", ["scan", "paste", "type"]);
  if (!state.check.valid) return turn("bad-destination", "warn", "concerned", ["scan", "paste", "type", "clear"]);
  const fixed = state.check.fixedAmountSats !== undefined;
  return turn("amount", "think", "thinking", fixed ? ["confirm-amount", "change-destination"] : ["confirm-amount", "max", "change-destination"]);
}

export type ReceiveStep =
  | "preparing" | "showing" | "received" | "error"
  | "ln-amount" | "ln-preparing" | "ln-showing" | "ln-claiming" | "ln-expired" | "ln-error";
export type ReceiveChoice = "copy" | "share" | "faucet" | "retry" | "done" | "lightning" | "ark" | "confirm-amount" | "new-invoice";
export type ReceiveTurn = Turn<ReceiveStep, ReceiveChoice>;

/**
 * Where a Lightning request stands. `claiming` means the payer has paid and the wallet is
 * collecting it: that is not yet "received", which only the wallet's own record can say.
 */
export type LightningReceiveStage = "amount" | "preparing" | "showing" | "claiming" | "expired" | "error";

export function receiveTurn(s: {
  address?: string; error?: boolean; received?: boolean; hasFaucet: boolean;
  /** Offer Lightning as another way to be paid. */
  lightningAvailable?: boolean;
  /** Set while the user is being paid over Lightning instead of to the Ark address. */
  lightning?: LightningReceiveStage;
}): ReceiveTurn {
  const mk = (step: ReceiveStep, action: AvatarAction, emotion: AvatarEmotion, choices: readonly ReceiveChoice[]): ReceiveTurn =>
    ({ step, lineKey: `talk.receive.${step}`, action, emotion, choices });
  // `received` must come from PAYMENT_RECEIVED; she keeps the board up so another payment can be taken.
  if (s.received) return mk("received", "catch", "happy", s.lightning ? ["done", "new-invoice"] : ["done", "copy"]);
  switch (s.lightning) {
    case "amount": return mk("ln-amount", "think", "curious", ["confirm-amount", "ark"]);
    case "preparing": return mk("ln-preparing", "search", "curious", []);
    case "showing": return mk("ln-showing", "present", "happy", ["copy", "share", "ark", "done"]);
    case "claiming": return mk("ln-claiming", "think", "focused", []);
    case "expired": return mk("ln-expired", "warn", "concerned", ["new-invoice", "ark", "done"]);
    case "error": return mk("ln-error", "warn", "concerned", ["retry", "ark", "done"]);
    case undefined: break;
  }
  if (s.error) return mk("error", "warn", "concerned", ["retry", "done"]);
  if (!s.address) return mk("preparing", "search", "curious", []);
  const more: ReceiveChoice[] = [...(s.lightningAvailable ? ["lightning" as const] : []), ...(s.hasFaucet ? ["faucet" as const] : [])];
  return mk("showing", "present", "happy", ["copy", "share", ...more, "done"]);
}
