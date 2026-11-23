import { create } from "zustand";
import type { MaintenanceStatus, WalletBalance, WalletInfo, WalletMovement, WalletVtxo } from "@/domain/wallet";

export type WalletLifecycle =
  | "booting" | "not-created" | "creating" | "opening" | "syncing"
  | "ready" | "degraded" | "recovering" | "error";

export type BackupStatus = "never" | "pending" | "current" | "stale" | "failed" | "unsupported";

export interface BackupView {
  status: BackupStatus;
  generation: number;
  lastSuccessAt?: string;
  lastError?: string;
  /** Has the newest backup been handed to storage outside the app? */
  exportedGeneration: number;
}

export interface WalletView {
  lifecycle: WalletLifecycle;
  /** Is a sync in flight right now? Independent of lifecycle so stale data is never shown as fresh. */
  syncing: boolean;
  balance?: WalletBalance;
  movements: WalletMovement[];
  vtxos: WalletVtxo[];
  maintenance?: MaintenanceStatus;
  info?: WalletInfo;
  backup: BackupView;
  lastSyncError?: string;
  fatalError?: string;
  /** Funds state is a cache of the SDK; this is all the app keeps. */
  set(patch: Partial<Omit<WalletView, "set">>): void;
}

export const useWalletStore = create<WalletView>((set) => ({
  lifecycle: "booting",
  syncing: false,
  movements: [],
  vtxos: [],
  backup: { status: "never", generation: 0, exportedGeneration: 0 },
  set: (patch) => set(patch),
}));
