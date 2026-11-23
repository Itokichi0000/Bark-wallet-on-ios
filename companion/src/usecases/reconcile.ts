import type { PendingOperation } from "@/domain/payment";
import type { WalletMovement } from "@/domain/wallet";

export interface ReconcileEvidence {
  /** Did a full sync succeed just before `movements` was read? */
  syncOk: boolean;
  movements: WalletMovement[];
  /** Sats held by operations in progress, from the same sync. */
  pendingSats: string;
}

export interface Resolution {
  status: PendingOperation["status"];
  movementId?: string;
}

function isNewer(id: string, before: string | null): boolean {
  if (before === null) return true;
  try {
    return BigInt(id) > BigInt(before);
  } catch {
    return false;
  }
}

/**
 * Decide what really happened to a send, from evidence only.
 *
 * It never concludes "failed" without proof: no fresh sync, or any sign of
 * money in flight, leaves the operation `unknown`. It never concludes
 * "succeeded" unless the wallet's own record of that movement says so.
 * Nothing here can cause a payment; it only reads.
 */
export function resolveOperation(op: PendingOperation, ev: ReconcileEvidence): Resolution {
  if (op.status === "succeeded" || op.status === "failed") return { status: op.status, movementId: op.movementId };

  const known = op.movementId !== undefined ? ev.movements.find((m) => m.id === op.movementId) : undefined;
  const candidate =
    known ??
    ev.movements
      .filter(
        (m) =>
          m.direction === "outgoing" &&
          isNewer(m.id, op.movementIdBefore) &&
          m.counterparty === op.destination,
      )
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))[0];

  if (candidate) {
    const status = candidate.status === "succeeded" ? "succeeded" : candidate.status === "failed" ? "failed" : candidate.status === "pending" ? "pending" : "unknown";
    return { status, movementId: candidate.id };
  }

  // No record of it. That only proves it was never sent if we just synced
  // successfully and nothing is in flight.
  if (ev.syncOk && op.movementId === undefined && ev.pendingSats === "0") return { status: "failed" };
  return { status: "unknown", movementId: op.movementId };
}
