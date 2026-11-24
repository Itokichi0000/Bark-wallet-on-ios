import { initialSendState, type SendPhase, type SendState } from "@/domain/payment";
import { receiveTurn, sendTurn } from "@/game/dialogue";
import { en } from "@/i18n/en";
import { ja } from "@/i18n/ja";

const at = (phase: SendPhase, over: Partial<SendState> = {}): SendState => ({ ...initialSendState, phase, ...over });
const valid = { valid: true as const, method: "ark" as const, destination: "tark1x" };

describe("conversation with the companion", () => {
  it("asks for the destination, then the amount, then the review", () => {
    expect(sendTurn(initialSendState).step).toBe("destination");
    expect(sendTurn(at("editing", { check: { valid: false, reason: "unrecognised" } })).step).toBe("bad-destination");
    expect(sendTurn(at("editing", { check: valid })).choices).toContain("max");
    expect(sendTurn(at("editing", { check: { ...valid, fixedAmountSats: "500" } })).choices).not.toContain("max");
    expect(sendTurn(at("review")).choices).toEqual(["send", "back"]);
  });

  it("never offers to send again while a result is not final, and offers no choice in flight", () => {
    for (const phase of ["pending", "unknown"] as const) {
      const t = sendTurn(at(phase));
      expect(t.choices).not.toContain("retry");
      expect(t.choices).not.toContain("send");
      expect(t.action).not.toBe("celebrate");
    }
    for (const phase of ["authorizing", "submitting", "validating", "quoting"] as const) expect(sendTurn(at(phase)).choices).toEqual([]);
    expect(sendTurn(at("failed")).choices).toContain("retry");
  });

  it("celebrates only a confirmed result", () => {
    const phases: SendPhase[] = ["editing", "validating", "quoting", "review", "authorizing", "submitting", "pending", "failed", "unknown"];
    for (const p of phases) expect(sendTurn(at(p)).action).not.toBe("celebrate");
    expect(sendTurn(at("succeeded")).action).toBe("celebrate");
    expect(receiveTurn({ address: "a", hasFaucet: false }).action).toBe("present");
    expect(receiveTurn({ address: "a", received: true, hasFaucet: false }).action).toBe("catch");
  });

  it("offers Lightning only when available, and never calls a payment received while it is still being collected", () => {
    expect(receiveTurn({ address: "a", hasFaucet: false }).choices).not.toContain("lightning");
    expect(receiveTurn({ address: "a", hasFaucet: false, lightningAvailable: true }).choices).toContain("lightning");
    const claiming = receiveTurn({ address: "a", hasFaucet: false, lightning: "claiming" });
    expect(claiming.step).toBe("ln-claiming");
    expect(claiming.action).not.toBe("catch");
    expect(receiveTurn({ address: "a", hasFaucet: false, lightning: "claiming", received: true }).action).toBe("catch");
  });

  it("has every line and choice label in both languages", () => {
    const keys = new Set<string>();
    const phases: SendPhase[] = ["editing", "validating", "quoting", "review", "authorizing", "submitting", "pending", "succeeded", "failed", "unknown"];
    for (const t of [...phases.map((p) => sendTurn(at(p))), sendTurn(at("editing", { check: valid })), sendTurn(at("editing", { check: { valid: false, reason: "empty" } }))]) {
      keys.add(t.lineKey);
      t.choices.forEach((c) => keys.add(`talk.send.choice.${c}`));
    }
    for (const t of [receiveTurn({ hasFaucet: true }), receiveTurn({ address: "a", hasFaucet: true }), receiveTurn({ address: "a", received: true, hasFaucet: true }), receiveTurn({ error: true, hasFaucet: true }),
      receiveTurn({ address: "a", hasFaucet: true, lightningAvailable: true }), receiveTurn({ address: "a", received: true, hasFaucet: true, lightning: "showing" }),
      ...(["amount", "preparing", "showing", "claiming", "expired", "error"] as const).map((lightning) => receiveTurn({ address: "a", hasFaucet: false, lightning }))]) {
      keys.add(t.lineKey);
      t.choices.forEach((c) => keys.add(`talk.receive.choice.${c}`));
    }
    for (const k of keys) {
      expect(ja[k as keyof typeof ja]).toBeTruthy();
      expect(en[k as keyof typeof en]).toBeTruthy();
    }
  });
});
