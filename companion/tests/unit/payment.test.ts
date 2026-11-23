import { type SendAction, type SendState, canRetry, initialSendState, sendReducer } from "@/domain/payment";
import type { SendQuote } from "@/domain/wallet";

const quote: SendQuote = {
  method: "ark", network: "signet", destination: "tark1mockdest", amountSats: "500", feeSats: "0",
  totalDebitSats: "500", balanceAfterSats: "9500", feeIsEstimate: false, quotedAt: "2026-01-01T00:00:00.000Z",
};
const run = (actions: SendAction[], from: SendState = initialSendState) => actions.reduce(sendReducer, from);
const toReview: SendAction[] = [
  { type: "INPUT_CHANGED", input: "tark1mockdest" },
  { type: "AMOUNT_CHANGED", amountInput: "500" },
  { type: "VALIDATE_STARTED" },
  { type: "VALIDATED", check: { valid: true, method: "ark", destination: "tark1mockdest" } },
  { type: "QUOTE_STARTED" },
  { type: "QUOTED", quote },
];
const toSubmitting: SendAction[] = [...toReview, { type: "USER_CONFIRMED" }, { type: "AUTHORIZED", operationId: "op-1" }];

describe("send state machine", () => {
  it("walks the happy path", () => {
    expect(run(toReview).phase).toBe("review");
    expect(run(toSubmitting).phase).toBe("submitting");
    expect(run([...toSubmitting, { type: "OUTCOME", outcome: { status: "succeeded", movementId: "7" } }])).toMatchObject({ phase: "succeeded", movementId: "7" });
  });

  it("cannot reach submitting without review, confirmation and authorisation", () => {
    // Straight from editing:
    expect(run([{ type: "USER_CONFIRMED" }]).phase).toBe("editing");
    expect(run([{ type: "AUTHORIZED", operationId: "x" }]).phase).toBe("editing");
    // Authorised without the user confirming:
    expect(run([...toReview, { type: "AUTHORIZED", operationId: "x" }]).phase).toBe("review");
    // Confirmed but authentication failed:
    expect(run([...toReview, { type: "USER_CONFIRMED" }, { type: "AUTH_FAILED" }]).phase).toBe("review");
    // Quote without a valid destination:
    expect(run([{ type: "INPUT_CHANGED", input: "x" }, { type: "QUOTE_STARTED" }]).phase).toBe("editing");
  });

  it("ignores a double tap while submitting", () => {
    const s = run(toSubmitting);
    expect(sendReducer(s, { type: "USER_CONFIRMED" })).toBe(s);
    expect(sendReducer(s, { type: "AUTHORIZED", operationId: "op-2" })).toBe(s);
    expect(s.operationId).toBe("op-1");
  });

  it("cannot be reset or edited while a send is in flight", () => {
    const s = run(toSubmitting);
    expect(sendReducer(s, { type: "RESET" })).toBe(s);
    expect(sendReducer(s, { type: "INPUT_CHANGED", input: "other" })).toBe(s);
    expect(sendReducer(s, { type: "BACK_TO_EDIT" })).toBe(s);
  });

  it("offers a retry only after a definitive failure", () => {
    const failed = run([...toSubmitting, { type: "OUTCOME", outcome: { status: "failed", errorMessage: "rejected" } }]);
    expect(canRetry(failed)).toBe(true);
    expect(sendReducer(failed, { type: "BACK_TO_EDIT" }).phase).toBe("editing");

    for (const status of ["unknown", "pending"] as const) {
      const s = run([...toSubmitting, { type: "OUTCOME", outcome: { status } }]);
      expect(s.phase).toBe(status);
      expect(canRetry(s)).toBe(false);
      expect(sendReducer(s, { type: "BACK_TO_EDIT" })).toBe(s);
      expect(sendReducer(s, { type: "USER_CONFIRMED" })).toBe(s);
      expect(sendReducer(s, { type: "INPUT_CHANGED", input: "again" })).toBe(s);
    }
  });

  it("resolves unknown and pending only through reconciliation", () => {
    const unknown = run([...toSubmitting, { type: "OUTCOME", outcome: { status: "unknown" } }]);
    expect(sendReducer(unknown, { type: "RECONCILED", outcome: { status: "succeeded", movementId: "9" } })).toMatchObject({ phase: "succeeded", movementId: "9" });
    expect(sendReducer(unknown, { type: "RECONCILED", outcome: { status: "failed" } }).phase).toBe("failed");
    // A reconciliation result cannot overwrite a final state or a draft.
    const done = run([...toSubmitting, { type: "OUTCOME", outcome: { status: "succeeded" } }]);
    expect(sendReducer(done, { type: "RECONCILED", outcome: { status: "failed" } })).toBe(done);
    expect(sendReducer(initialSendState, { type: "RECONCILED", outcome: { status: "succeeded" } })).toBe(initialSendState);
  });

  it("drops the quote when the destination or amount changes", () => {
    const s = run([...toReview, { type: "AMOUNT_CHANGED", amountInput: "600" }]);
    expect(s.phase).toBe("editing");
    expect(s.quote).toBeUndefined();
    const s2 = run([...toReview, { type: "INPUT_CHANGED", input: "tark1mockother" }]);
    expect(s2.quote).toBeUndefined();
    expect(s2.check).toBeUndefined();
  });

  it("does not let the user overwrite an amount fixed by the request", () => {
    const s = run([
      { type: "INPUT_CHANGED", input: "bitcoin:?ark=tark1mock&amount=0.00001" },
      { type: "VALIDATE_STARTED" },
      { type: "VALIDATED", check: { valid: true, method: "ark", destination: "tark1mock", fixedAmountSats: "1000" } },
    ]);
    expect(s.amountInput).toBe("1000");
    expect(sendReducer(s, { type: "AMOUNT_CHANGED", amountInput: "1" })).toBe(s);
  });

  it("can cancel from review", () => {
    expect(run([...toReview, { type: "BACK_TO_EDIT" }])).toMatchObject({ phase: "editing", quote: undefined });
  });
});
