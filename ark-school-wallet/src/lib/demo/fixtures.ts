// Deterministic DEMO data. No seed, no keys, no real transactions (spec 7.5).
// Every id starts with "demo-" so it can never be mistaken for a real outpoint.

import type { MovementView, VtxoView } from '../wallet/types';

export const DEMO = true as const;
export const DEMO_WALLET_ID = 'demo-wallet';
export const DEMO_START_TIP = 120_000;
/** Demo-only parameters. Real values come from the Ark server (wallet.arkInfo()). */
export const DEMO_VTXO_LIFETIME = 2016;
export const DEMO_REFRESH_THRESHOLD = 144;
export const DEMO_MAX_EXIT_DEPTH = 10;
export const DEMO_FRIEND_ADDRESS = 'DEMO-ark-address-friend-0001';
export const DEMO_OWN_ADDRESS_PREFIX = 'DEMO-ark-address-me-';

export type DemoVtxo = Omit<VtxoView, 'source' | 'evidence'> & { demo: true };
export type DemoMovement = Omit<MovementView, 'source'> & { demo: true };

export interface DemoState {
  demo: true;
  tip: number;
  vtxos: DemoVtxo[];
  movements: DemoMovement[];
  counter: number;
}

export function demoId(n: number): string {
  // A tiny deterministic hash so ids look varied but are reproducible.
  let h = 2166136261 ^ n;
  for (let i = 0; i < 4; i++) h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
  return `demo-${h.toString(16).padStart(8, '0')}:${n % 3}`;
}

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 9, 0) + minutes * 60_000).toISOString();

export type ScenarioName = 'empty' | 'received' | 'sent' | 'refreshed' | 'exiting' | 'mixed';
export const SCENARIOS: ScenarioName[] = ['empty', 'received', 'sent', 'refreshed', 'exiting', 'mixed'];

export function scenario(name: ScenarioName): DemoState {
  const tip = DEMO_START_TIP;
  const base: DemoState = { demo: true, tip, vtxos: [], movements: [], counter: 100 };
  const recvVtxo: DemoVtxo = {
    demo: true, id: demoId(1), amountSats: 10_000, kind: 'arkoor', state: 'spendable', expiryHeight: tip + 1_500, exitDepth: 2, exitTxWeightWu: 1_400, registered: true,
  };
  const recvMove: DemoMovement = {
    demo: true, id: 'demo-m1', status: 'successful', kind: 'arkoor / receive', effectiveBalanceSats: 10_000, feeSats: 0,
    inputVtxoIds: [], outputVtxoIds: [recvVtxo.id], exitedVtxoIds: [], sentTo: [], receivedOn: [`${DEMO_OWN_ADDRESS_PREFIX}0`], createdAt: at(0), completedAt: at(0),
  };

  switch (name) {
    case 'empty':
      return base;
    case 'received':
      return { ...base, vtxos: [recvVtxo], movements: [recvMove] };
    case 'sent': {
      const change: DemoVtxo = { demo: true, id: demoId(2), amountSats: 8_988, kind: 'arkoor', state: 'spendable', expiryHeight: tip + 1_500, exitDepth: 3, exitTxWeightWu: 1_900, registered: true };
      return {
        ...base,
        vtxos: [{ ...recvVtxo, state: 'spent' }, change],
        movements: [
          recvMove,
          { demo: true, id: 'demo-m2', status: 'successful', kind: 'arkoor / send', effectiveBalanceSats: -1_012, feeSats: 12, inputVtxoIds: [recvVtxo.id], outputVtxoIds: [change.id], exitedVtxoIds: [], sentTo: [DEMO_FRIEND_ADDRESS], receivedOn: [], createdAt: at(30), completedAt: at(30) },
        ],
      };
    }
    case 'refreshed': {
      const fresh: DemoVtxo = { demo: true, id: demoId(3), amountSats: 9_990, kind: 'round', state: 'spendable', expiryHeight: tip + DEMO_VTXO_LIFETIME, exitDepth: 1, exitTxWeightWu: 700, registered: true };
      return {
        ...base,
        vtxos: [{ ...recvVtxo, state: 'spent' }, fresh],
        movements: [
          recvMove,
          { demo: true, id: 'demo-m3', status: 'successful', kind: 'round / refresh', effectiveBalanceSats: -10, feeSats: 10, inputVtxoIds: [recvVtxo.id], outputVtxoIds: [fresh.id], exitedVtxoIds: [], sentTo: [], receivedOn: [], createdAt: at(60), completedAt: at(75) },
        ],
      };
    }
    case 'exiting': {
      const exiting: DemoVtxo = { demo: true, id: demoId(4), amountSats: 5_000, kind: 'round', state: 'exited', stateDetail: 'demo: emergency exit in progress', expiryHeight: tip + 800, exitDepth: 3, exitTxWeightWu: 2_100, registered: true };
      const keep: DemoVtxo = { demo: true, id: demoId(5), amountSats: 5_000, kind: 'round', state: 'spendable', expiryHeight: tip + 800, exitDepth: 3, exitTxWeightWu: 2_100, registered: true };
      return {
        ...base,
        vtxos: [exiting, keep],
        movements: [
          { demo: true, id: 'demo-m4', status: 'pending', kind: 'exit / start', effectiveBalanceSats: -5_000, feeSats: undefined, inputVtxoIds: [], outputVtxoIds: [], exitedVtxoIds: [exiting.id], sentTo: [], receivedOn: [], createdAt: at(120), completedAt: undefined },
        ],
      };
    }
    case 'mixed': {
      const vtxos: DemoVtxo[] = [
        { demo: true, id: demoId(11), amountSats: 6_000, kind: 'round', state: 'spendable', expiryHeight: tip + 1_800, exitDepth: 1, exitTxWeightWu: 700, registered: true },
        { demo: true, id: demoId(12), amountSats: 3_200, kind: 'arkoor', state: 'spendable', expiryHeight: tip + 220, exitDepth: 4, exitTxWeightWu: 2_600, registered: true },
        { demo: true, id: demoId(13), amountSats: 1_500, kind: 'arkoor', state: 'spendable', expiryHeight: tip + 90, exitDepth: 6, exitTxWeightWu: 3_800, registered: true },
        { demo: true, id: demoId(14), amountSats: 2_000, kind: 'round', state: 'locked', stateDetail: 'movement:7', expiryHeight: tip + 1_200, exitDepth: 1, exitTxWeightWu: 700, registered: true },
        { demo: true, id: demoId(15), amountSats: 4_000, kind: 'board', state: 'spent', expiryHeight: tip + 400, exitDepth: 1, exitTxWeightWu: 600, registered: true },
      ];
      return {
        ...base,
        vtxos,
        movements: [
          { demo: true, id: 'demo-m11', status: 'successful', kind: 'board / board', effectiveBalanceSats: 4_000, feeSats: 0, inputVtxoIds: [], outputVtxoIds: [demoId(15)], exitedVtxoIds: [], sentTo: [], receivedOn: [], createdAt: at(0), completedAt: at(60) },
          { demo: true, id: 'demo-m12', status: 'successful', kind: 'round / refresh', effectiveBalanceSats: -6, feeSats: 6, inputVtxoIds: [demoId(15)], outputVtxoIds: [demoId(11)], exitedVtxoIds: [], sentTo: [], receivedOn: [], createdAt: at(90), completedAt: at(100) },
          { demo: true, id: 'demo-m13', status: 'successful', kind: 'arkoor / receive', effectiveBalanceSats: 4_700, feeSats: 0, inputVtxoIds: [], outputVtxoIds: [demoId(12), demoId(13)], exitedVtxoIds: [], sentTo: [], receivedOn: [`${DEMO_OWN_ADDRESS_PREFIX}1`], createdAt: at(200), completedAt: at(200) },
          { demo: true, id: 'demo-m14', status: 'pending', kind: 'round / refresh', effectiveBalanceSats: 0, feeSats: undefined, inputVtxoIds: [demoId(14)], outputVtxoIds: [], exitedVtxoIds: [], sentTo: [], receivedOn: [], createdAt: at(260), completedAt: undefined },
        ],
      };
    }
  }
}
