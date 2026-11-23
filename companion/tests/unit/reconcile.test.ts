import type { PendingOperation } from "@/domain/payment";
import type { WalletMovement } from "@/domain/wallet";
import { resolveOperation } from "@/usecases/reconcile";

const op = (over: Partial<PendingOperation> = {}): PendingOperation => ({
  operationId: "op-1", method: "ark", destination: "tark1dest", amountSats: "500", feeSats: "0",
  movementIdBefore: "10", status: "unknown", createdAt: "2026-01-01T00:00:00.000Z", ...over,
});
const mv = (over: Partial<WalletMovement>): WalletMovement => ({
  id: "11", method: "ark", kind: "arkoor.send", direction: "outgoing", amountSats: "500", feeSats: "0",
  status: "succeeded", rawStatus: "successful", counterparty: "tark1dest", createdAt: "2026-01-01T00:00:01.000Z", ...over,
});

describe("resolveOperation", () => {
  it("adopts the status of the movement the SDK returned", () => {
    expect(resolveOperation(op({ movementId: "11" }), { syncOk: true, movements: [mv({})], pendingSats: "0" })).toEqual({ status: "succeeded", movementId: "11" });
    expect(resolveOperation(op({ movementId: "11" }), { syncOk: true, movements: [mv({ status: "pending", rawStatus: "pending" })], pendingSats: "500" })).toEqual({ status: "pending", movementId: "11" });
    expect(resolveOperation(op({ movementId: "11" }), { syncOk: true, movements: [mv({ status: "failed", rawStatus: "canceled" })], pendingSats: "0" })).toEqual({ status: "failed", movementId: "11" });
  });

  it("finds a payment that timed out but was actually made", () => {
    const r = resolveOperation(op(), { syncOk: true, movements: [mv({ id: "12" }), mv({ id: "9" })], pendingSats: "0" });
    expect(r).toEqual({ status: "succeeded", movementId: "12" });
  });

  it("does not match older movements, other destinations or incoming ones", () => {
    const movements = [mv({ id: "10" }), mv({ id: "9" }), mv({ id: "12", counterparty: "tark1other" }), mv({ id: "13", direction: "incoming" })];
    expect(resolveOperation(op(), { syncOk: true, movements, pendingSats: "0" })).toEqual({ status: "failed" });
  });

  it("concludes 'not sent' only with a fresh sync and nothing in flight", () => {
    expect(resolveOperation(op(), { syncOk: true, movements: [], pendingSats: "0" }).status).toBe("failed");
    expect(resolveOperation(op(), { syncOk: false, movements: [], pendingSats: "0" }).status).toBe("unknown");
    expect(resolveOperation(op(), { syncOk: true, movements: [], pendingSats: "500" }).status).toBe("unknown");
    expect(resolveOperation(op(), { syncOk: true, movements: [], pendingSats: "unknown" }).status).toBe("unknown");
  });

  it("never declares failure when the SDK gave a movement id that history does not show yet", () => {
    expect(resolveOperation(op({ movementId: "99" }), { syncOk: true, movements: [], pendingSats: "0" })).toEqual({ status: "unknown", movementId: "99" });
  });

  it("treats an unrecognised SDK status as unknown, not success", () => {
    expect(resolveOperation(op({ movementId: "11" }), { syncOk: true, movements: [mv({ status: "unknown", rawStatus: "something-new" })], pendingSats: "0" }).status).toBe("unknown");
  });

  it("leaves final states alone", () => {
    expect(resolveOperation(op({ status: "succeeded", movementId: "11" }), { syncOk: true, movements: [], pendingSats: "0" })).toEqual({ status: "succeeded", movementId: "11" });
    expect(resolveOperation(op({ status: "failed" }), { syncOk: true, movements: [mv({ id: "12" })], pendingSats: "0" }).status).toBe("failed");
  });

  it("matches when no movement existed before the send", () => {
    expect(resolveOperation(op({ movementIdBefore: null }), { syncOk: true, movements: [mv({ id: "1" })], pendingSats: "0" })).toEqual({ status: "succeeded", movementId: "1" });
  });
});
