import { toMoney } from "@/domain/money";
import type { MaintenanceStatus, MovementStatus, VtxoHealth, WalletMovement } from "@/domain/wallet";
import { EXPIRY_URGENT_BLOCKS, REFRESH_SOON_BLOCKS } from "./barkConfig";

/** The fields of the SDK's `Movement` this app reads. Kept structural so it can be tested without the native module. */
export interface SdkMovementLike {
  id: number;
  status: string;
  subsystemName: string;
  subsystemKind: string;
  effectiveBalanceSats: bigint;
  offchainFeeSats: bigint;
  sentToAddresses: string[];
  receivedOnAddresses: string[];
  createdAt: string;
  completedAt?: string;
}

/**
 * bark's movement status words. Anything this app does not know is
 * `unknown`, never optimistically `succeeded`.
 */
export function mapMovementStatus(status: string): MovementStatus {
  switch (status) {
    case "successful":
      return "succeeded";
    case "pending":
      return "pending";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "unknown";
  }
}

export function mapMovement(m: SdkMovementLike): WalletMovement {
  const eff = m.effectiveBalanceSats;
  const name = m.subsystemName.replace(/^bark\./, "");
  const lower = `${name}.${m.subsystemKind}`.toLowerCase();
  const method = lower.includes("arkoor") ? "ark" : lower.includes("lightning") ? "lightning" : "other";
  const direction = eff > 0n ? "incoming" : eff < 0n ? "outgoing" : "internal";
  return {
    id: String(m.id),
    method,
    kind: `${name}.${m.subsystemKind}`,
    direction,
    amountSats: toMoney(eff < 0n ? -eff : eff),
    feeSats: toMoney(m.offchainFeeSats < 0n ? 0n : m.offchainFeeSats),
    status: mapMovementStatus(m.status),
    rawStatus: m.status,
    counterparty: direction === "outgoing" ? m.sentToAddresses[0] : m.receivedOnAddresses[0],
    createdAt: m.createdAt,
    completedAt: m.completedAt,
  };
}

export function vtxoHealth(input: { locked: boolean; sdkSaysRefresh: boolean; blocksToExpiry?: number }): VtxoHealth {
  if (input.locked) return "locked";
  if (input.sdkSaysRefresh) return "refresh-required";
  if (input.blocksToExpiry !== undefined && input.blocksToExpiry <= REFRESH_SOON_BLOCKS) return "refresh-soon";
  return "ok";
}

export function maintenanceSeverity(input: {
  tipHeight?: number;
  vtxosToRefresh: number;
  nextRequiredRefreshHeight?: number;
  firstExpiryHeight?: number;
}): MaintenanceStatus["severity"] {
  if (input.vtxosToRefresh > 0) return "urgent";
  if (input.tipHeight === undefined) return "none";
  if (input.firstExpiryHeight !== undefined && input.firstExpiryHeight - input.tipHeight <= EXPIRY_URGENT_BLOCKS) return "urgent";
  if (input.nextRequiredRefreshHeight !== undefined && input.nextRequiredRefreshHeight - input.tipHeight <= REFRESH_SOON_BLOCKS) return "notice";
  return "none";
}
