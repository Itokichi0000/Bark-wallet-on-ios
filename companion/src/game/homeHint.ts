import type { WalletView } from "@/state/walletStore";

/**
 * What the companion says on the home screen when nothing else is happening:
 * the single most useful next thing, in priority order. Pure, so it is tested.
 * It reads only what the home screen already shows; never a secret.
 */
export interface HomeHint {
  lineKey: string;
  /** Where tapping the hint leads, if anywhere. */
  route?: "/receive" | "/send" | "/settings" | "/assets" | "/archive" | "/quest";
}

export interface HomeHintInput {
  view: Pick<WalletView, "lifecycle" | "balance" | "maintenance" | "backup" | "lastSyncError" | "movements">;
  seedBackupConfirmed: boolean;
  isMock: boolean;
  hour: number;
}

export function homeHint({ view, seedBackupConfirmed, isMock, hour }: HomeHintInput): HomeHint {
  if (view.movements.some((m) => m.status === "pending" || m.status === "unknown")) return { lineKey: "hint.pending", route: "/archive" };
  if (view.maintenance && view.maintenance.severity !== "none") return { lineKey: "hint.maintenance", route: "/assets" };
  if (view.lastSyncError !== undefined || view.lifecycle === "degraded") return { lineKey: "hint.offline" };
  if (!isMock && !seedBackupConfirmed) return { lineKey: "hint.seed", route: "/settings" };
  if (!isMock && view.backup.generation > view.backup.exportedGeneration) return { lineKey: "hint.backup", route: "/settings" };
  if (!view.balance || view.balance.spendableSats === "0") return { lineKey: "hint.receiveFirst", route: "/receive" };
  if (view.movements.every((m) => m.direction !== "outgoing")) return { lineKey: "hint.sendFirst", route: "/send" };
  if (hour < 5) return { lineKey: "hint.night" };
  if (hour < 11) return { lineKey: "hint.morning" };
  if (hour < 18) return { lineKey: "hint.day" };
  return { lineKey: "hint.evening" };
}
