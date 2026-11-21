import { vi } from 'vitest';
import type { OnchainLike, WalletLike } from '../../src/lib/bark/adapter';

/** A fake of the subset of the SDK Wallet the adapter uses. */
export function fakeWallet(overrides: Partial<Record<keyof WalletLike, unknown>> = {}) {
  const w = {
    allVtxos: vi.fn(async () => [
      { id: 'v1:0', amountSats: 8_000, expiryHeight: 1_100, kind: 'arkoor', state: { type: 'spendable' }, exitDepth: 2, exitTxWeightWu: 900, registered: true },
      { id: 'v2:0', amountSats: 3_000, expiryHeight: 1_005, kind: 'round', state: { type: 'spendable' }, exitDepth: 1, exitTxWeightWu: 600, registered: true },
      { id: 'v3:0', amountSats: 500, expiryHeight: 1_100, kind: 'arkoor', state: { type: 'spent' }, exitDepth: 2, exitTxWeightWu: 900, registered: true },
    ]),
    vtxos: vi.fn(async () => []),
    balance: vi.fn(async () => ({ spendableSats: 8_000, needsRefreshSats: 3_000, pendingInRoundSats: 200, pendingExitSats: 0, pendingLightningSendSats: 0, claimableLightningReceiveSats: 0, pendingBoardSats: 0, pendingArkoorSendSats: 0, pendingOffboardSats: 0 })),
    balanceSummary: vi.fn(async () => ({ spendableSats: 8_000, needsRefreshSats: 3_000, pendingSats: 200, totalSats: 11_200 })),
    sync: vi.fn(async () => undefined),
    newAddress: vi.fn(async () => 'tark1pfakeaddress'),
    validateArkoorAddress: vi.fn(async (a: string) => a.startsWith('tark1')),
    parsePaymentRequest: vi.fn(async (a: string) => ({ options: [{ errors: a.startsWith('ark1') ? [{ type: 'network-mismatch' }] : [] }] })),
    sendArkoorPayment: vi.fn(async () => 42),
    estimateArkoorPaymentFee: vi.fn(async (amt: number) => ({ grossAmountSats: amt, feeSats: 0, netAmountSats: amt, vtxosSpent: ['v1:0'] })),
    history: vi.fn(async () => []),
    arkInfo: vi.fn(async () => ({ network: 'Signet', vtxoLifetime: 144, vtxoExpiryDelta: 144, vtxoExitDelta: 12, maxVtxoExitDepth: 100, roundIntervalSecs: 300 })),
    network: vi.fn(async () => 'Signet'),
    config: vi.fn(() => ({ serverAddress: 'x', vtxoRefreshExpiryThreshold: 12 })),
    getVtxosToRefresh: vi.fn(async () => [{ id: 'v2:0' }]),
    pendingRoundInputVtxos: vi.fn(async () => []),
    pendingBoardVtxos: vi.fn(async () => []),
    pendingLightningSendVtxos: vi.fn(async () => []),
    estimateEmergencyExitFee: vi.fn(async () => ({ exitBroadcastFeeSats: 1200, claimFeeSats: 300, totalFeeSats: 1500, feeRateSatPerVb: 2, txsToBroadcast: 3, fundable: false })),
    remainingExitTransactions: vi.fn(async () => ({ exits: [{ vtxoId: 'v1:0', txids: ['t1', 't2'] }], transactions: [] })),
    estimateRefreshFee: vi.fn(async () => ({ grossAmountSats: 3000, feeSats: 6, netAmountSats: 2994, vtxosSpent: ['v2:0'] })),
    free: vi.fn(),
    ...overrides,
  };
  return w as unknown as WalletLike & typeof w;
}

export function fakeOnchain(tip = 1_000): OnchainLike {
  return {
    tipHeight: vi.fn(async () => tip),
    balance: vi.fn(async () => ({ confirmedSats: 0, pendingSats: 0, totalSats: 0 })),
    sync: vi.fn(async () => 0),
    free: vi.fn(),
  } as unknown as OnchainLike;
}

export const statics = { validateArkAddress: (a: string) => /^t?ark1/.test(a) };
