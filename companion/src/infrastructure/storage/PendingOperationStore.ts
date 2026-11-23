import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingOperation } from "@/domain/payment";

const KEEP_RESOLVED = 50;

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Sends the app has started, persisted *before* the SDK call so a crash or
 * kill mid-send leaves a record to reconcile instead of a silent gap.
 * Contains destinations and amounts but no secrets.
 */
export class PendingOperationStore {
  constructor(private readonly kv: KeyValueStore = AsyncStorage, private readonly key = "bcw.signet.pendingOps.v1") {}

  async all(): Promise<PendingOperation[]> {
    const raw = await this.kv.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PendingOperation[]) : [];
    } catch {
      return [];
    }
  }

  async unresolved(): Promise<PendingOperation[]> {
    return (await this.all()).filter((o) => o.status === "submitting" || o.status === "pending" || o.status === "unknown");
  }

  async put(op: PendingOperation): Promise<void> {
    const ops = (await this.all()).filter((o) => o.operationId !== op.operationId);
    ops.push(op);
    const open = ops.filter((o) => o.status !== "succeeded" && o.status !== "failed");
    const closed = ops.filter((o) => o.status === "succeeded" || o.status === "failed").slice(-KEEP_RESOLVED);
    await this.kv.setItem(this.key, JSON.stringify([...closed, ...open]));
  }

  async get(operationId: string): Promise<PendingOperation | undefined> {
    return (await this.all()).find((o) => o.operationId === operationId);
  }
}
