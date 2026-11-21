// Payment safety (spec 3.4 / 6.3, T09, T21).
// 1. SingleFlight: one network payment per user action, no matter how often
//    the button is pressed.
// 2. Uncertain payments are remembered across reloads and block further
//    sending until the user has checked history. Never auto-retried.

import type { MovementView, Sats } from './types';

export class SingleFlight {
  private running: Promise<unknown> | undefined;

  get busy(): boolean {
    return this.running !== undefined;
  }

  /** Runs fn if nothing is in flight; otherwise rejects immediately without calling fn. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running) throw new BusyError();
    const p = fn();
    this.running = p;
    try {
      return await p;
    } finally {
      this.running = undefined;
    }
  }
}

export class BusyError extends Error {
  constructor() {
    super('Another payment is already in progress');
  }
}

export interface PendingSend {
  walletId: string;
  address: string;
  amountSats: Sats;
  startedAt: string;
  /** 'in-flight' is written before the SDK call; 'unknown' after an error. */
  phase: 'in-flight' | 'unknown';
  message?: string;
}

const KEY = 'ark-school:pending-send';

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readPendingSend(walletId: string): PendingSend | undefined {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return undefined;
    const p = JSON.parse(raw) as PendingSend;
    return p.walletId === walletId ? p : undefined;
  } catch {
    return undefined;
  }
}

export function writePendingSend(p: PendingSend): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable; the in-memory guard still applies */
  }
}

export function clearPendingSend(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Looks for a history entry that matches an uncertain send. Matching is
 * deliberately conservative: same destination address, created at or after
 * the attempt (with a small clock margin).
 */
export function findMatchingMovement(pending: PendingSend, history: MovementView[]): MovementView | undefined {
  const started = Date.parse(pending.startedAt) - 60_000;
  return history.find((m) => {
    if (!m.sentTo.includes(pending.address)) return false;
    const created = m.createdAt ? Date.parse(m.createdAt) : NaN;
    return Number.isNaN(created) || created >= started;
  });
}
