import { EventBus } from "@/domain/events";
import { MockWalletAdapter } from "@/infrastructure/mock/MockWalletAdapter";

async function opened(sats = 50_000n) {
  const adapter = new MockWalletAdapter({ initialSats: sats });
  await adapter.open("seed", { create: true });
  return adapter;
}

describe("lightning (mock adapter contract)", () => {
  it("recognises an invoice, with or without a fixed amount", async () => {
    const a = await opened();
    const open = await a.validateDestination("lntbsmockopen");
    expect(open).toMatchObject({ valid: true, method: "lightning" });
    expect(open.valid && open.fixedAmountSats).toBeUndefined();
    const fixed = await a.validateDestination("lntbsmockfixed");
    expect(fixed.valid && fixed.fixedAmountSats).toBe("2100");
    expect((await a.validateDestination("lnbc1realinvoice")).valid).toBe(false);
  });

  it("pays an invoice once and records it as a lightning movement", async () => {
    const a = await opened();
    const quote = await a.quoteSend({ method: "lightning", destination: "lntbsmockfixed", amountSats: "2100" });
    const out = await a.sendReviewedPayment(quote);
    expect(out.status).toBe("succeeded");
    expect(a.sendCalls).toBe(1);
    expect((await a.listHistory())[0]).toMatchObject({ method: "lightning", direction: "outgoing", amountSats: "2100" });
  });

  it("an invoice is only settled once it has been paid", async () => {
    const a = await opened(0n);
    const inv = await a.newLightningInvoice("3000");
    expect(inv.amountSats).toBe("3000");
    expect(await a.lightningReceiveState(inv.paymentHash)).toBe("awaiting");
    expect(await a.lightningReceiveState("nope")).toBe("unknown");
    a.simulateIncoming(1n);
    expect(await a.lightningReceiveState(inv.paymentHash)).toBe("settled");
    expect((await a.getBalance()).spendableSats).toBe("3000");
    await expect(a.newLightningInvoice("0")).rejects.toThrow();
    expect(new EventBus()).toBeDefined();
  });
});
