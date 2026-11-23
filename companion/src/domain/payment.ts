import type { DestinationCheck, SendQuote, SubmitOutcome } from "./wallet";

/**
 * The send flow as a pure state machine (design doc 8.1).
 *
 * Rules this encodes, so the UI cannot break them by accident:
 *  - `submitting` is only reachable from `review`, and only via USER_CONFIRMED.
 *  - A second USER_CONFIRMED while submitting is ignored (double tap).
 *  - `unknown` and `pending` are not failures and offer no retry.
 *  - Only `failed` (definitive) can go back to editing for another attempt.
 */
export type SendPhase =
  | "editing"
  | "validating"
  | "quoting"
  | "review"
  | "authorizing"
  | "submitting"
  | "pending"
  | "succeeded"
  | "failed"
  | "unknown";

export interface SendState {
  phase: SendPhase;
  input: string;
  amountInput: string;
  check?: DestinationCheck;
  quote?: SendQuote;
  operationId?: string;
  movementId?: string;
  /** A problem with the form, shown inline. Not a payment result. */
  formError?: string;
  /** Why a submitted payment failed. */
  failure?: string;
}

export type SendAction =
  | { type: "INPUT_CHANGED"; input: string }
  | { type: "AMOUNT_CHANGED"; amountInput: string }
  | { type: "VALIDATE_STARTED" }
  | { type: "VALIDATED"; check: DestinationCheck }
  | { type: "QUOTE_STARTED" }
  | { type: "QUOTED"; quote: SendQuote }
  | { type: "FORM_ERROR"; message: string }
  | { type: "BACK_TO_EDIT" }
  | { type: "USER_CONFIRMED" }
  | { type: "AUTH_FAILED" }
  | { type: "AUTHORIZED"; operationId: string }
  | { type: "OUTCOME"; outcome: SubmitOutcome }
  | { type: "RECONCILED"; outcome: SubmitOutcome }
  | { type: "RESET" };

export const initialSendState: SendState = { phase: "editing", input: "", amountInput: "" };

const EDITABLE: readonly SendPhase[] = ["editing", "validating", "quoting", "review"];

function applyOutcome(state: SendState, outcome: SubmitOutcome): SendState {
  return {
    ...state,
    phase: outcome.status,
    movementId: outcome.movementId ?? state.movementId,
    failure: outcome.status === "failed" ? (outcome.errorMessage ?? "") : undefined,
  };
}

export function sendReducer(state: SendState, action: SendAction): SendState {
  switch (action.type) {
    case "INPUT_CHANGED":
      if (!EDITABLE.includes(state.phase)) return state;
      return { ...state, phase: "editing", input: action.input, check: undefined, quote: undefined, formError: undefined };
    case "AMOUNT_CHANGED":
      if (!EDITABLE.includes(state.phase)) return state;
      // A request that fixes its own amount cannot be overwritten by the user.
      if (state.check?.valid && state.check.fixedAmountSats !== undefined) return state;
      return { ...state, phase: "editing", amountInput: action.amountInput, quote: undefined, formError: undefined };
    case "VALIDATE_STARTED":
      return state.phase === "editing" ? { ...state, phase: "validating", formError: undefined } : state;
    case "VALIDATED": {
      if (state.phase !== "validating") return state;
      const fixed = action.check.valid ? action.check.fixedAmountSats : undefined;
      return {
        ...state,
        phase: "editing",
        check: action.check,
        amountInput: fixed ?? state.amountInput,
      };
    }
    case "QUOTE_STARTED":
      return state.phase === "editing" && state.check?.valid ? { ...state, phase: "quoting", formError: undefined } : state;
    case "QUOTED":
      return state.phase === "quoting" ? { ...state, phase: "review", quote: action.quote } : state;
    case "FORM_ERROR":
      return EDITABLE.includes(state.phase)
        ? { ...state, phase: "editing", quote: undefined, formError: action.message }
        : state;
    case "BACK_TO_EDIT":
      // From review (cancel) or from a definitive failure (try again). Never from unknown/pending.
      if (state.phase === "review" || state.phase === "failed") {
        return { ...state, phase: "editing", quote: undefined, operationId: undefined, movementId: undefined, failure: undefined };
      }
      return state;
    case "USER_CONFIRMED":
      return state.phase === "review" && state.quote ? { ...state, phase: "authorizing" } : state;
    case "AUTH_FAILED":
      return state.phase === "authorizing" ? { ...state, phase: "review" } : state;
    case "AUTHORIZED":
      return state.phase === "authorizing" ? { ...state, phase: "submitting", operationId: action.operationId } : state;
    case "OUTCOME":
      return state.phase === "submitting" ? applyOutcome(state, action.outcome) : state;
    case "RECONCILED":
      // Reconciliation may only resolve the two non-final states.
      return state.phase === "pending" || state.phase === "unknown" ? applyOutcome(state, action.outcome) : state;
    case "RESET":
      // Leaving while the SDK call is in flight would orphan it; the caller must wait.
      return state.phase === "submitting" || state.phase === "authorizing" ? state : initialSendState;
  }
}

export function canRetry(state: SendState): boolean {
  return state.phase === "failed";
}

/** A send the app must remember across restarts until its result is known. */
export interface PendingOperation {
  operationId: string;
  method: SendQuote["method"];
  destination: string;
  amountSats: string;
  feeSats: string;
  /** Highest movement id that existed before the SDK call. */
  movementIdBefore: string | null;
  status: "submitting" | "pending" | "unknown" | "succeeded" | "failed";
  movementId?: string;
  createdAt: string;
  resolvedAt?: string;
  /** Guards the success animation: set once the avatar has celebrated this op. */
  announced?: boolean;
}
