// Lesson engine: pure functions, local data only. No imports from the SDK,
// adapters or stores, so a lesson can never affect a real wallet (T14).

import type { L } from '../../i18n';

export interface LessonMeta {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  title: L;
  summary: L;
}

export const LESSONS: LessonMeta[] = [
  { id: 1, title: { ja: 'UTXOとVTXO', en: 'UTXO and VTXO' }, summary: { ja: 'VTXOを送ると、何が消えて何が生まれる？', en: 'When you send from a VTXO, what disappears and what is created?' } },
  { id: 2, title: { ja: 'オンチェーン / Ark / Lightning', en: 'On-chain / Ark / Lightning' }, summary: { ja: '同じ1,000 satsを3つの方法で送ると？', en: 'Sending the same 1,000 sats three ways' } },
  { id: 3, title: { ja: 'Arkのラウンド', en: 'Ark rounds' }, summary: { ja: '待機・入力・新しいVTXO・承認の流れ', en: 'Waiting, inputs, new VTXOs, confirmation' } },
  { id: 4, title: { ja: 'Refreshと期限', en: 'Refresh and expiry' }, summary: { ja: '更新した場合と放置した場合を比べる', en: 'Compare refreshing with doing nothing' } },
  { id: 5, title: { ja: '協調Offboard vs 緊急Exit', en: 'Cooperative offboard vs emergency exit' }, summary: { ja: 'サーバーが協力する場合・しない場合', en: 'With and without the server\'s cooperation' } },
  { id: 6, title: { ja: 'バックアップと復元', en: 'Backup and restore' }, summary: { ja: '復元フレーズだけ vs DBの継続バックアップ', en: 'Phrase only vs continuous DB backup' } },
];

// ---- Lesson 1: UTXO → VTXO spend (simplified teaching model)

export interface Coin {
  id: string;
  amount: number;
  owner: 'me' | 'friend';
  status: 'unspent' | 'spent';
}

export interface SpendStep {
  coins: Coin[];
  caption: L;
}

/** Simplified: one input, recipient output, change. A teaching fee, not a real one. */
export function simulateSpend(input: number, send: number, teachingFee: number): SpendStep[] {
  const change = input - send - teachingFee;
  if (send <= 0 || change < 0) throw new RangeError('send + fee must fit in the input');
  const a: Coin = { id: 'A', amount: input, owner: 'me', status: 'unspent' };
  return [
    { coins: [a], caption: { ja: `あなたは ${input.toLocaleString()} sats のVTXOを1つ持っています。`, en: `You hold one VTXO of ${input.toLocaleString()} sats.` } },
    { coins: [{ ...a, status: 'spent' }], caption: { ja: '送金するとき、このVTXOはまるごと「消費」されます（一部だけ使うことはできません）。', en: 'To pay, the whole VTXO is consumed (you cannot spend part of it).' } },
    {
      coins: [
        { ...a, status: 'spent' },
        { id: 'B', amount: send, owner: 'friend', status: 'unspent' },
        { id: 'C', amount: change, owner: 'me', status: 'unspent' },
      ],
      caption: {
        ja: `相手に ${send.toLocaleString()} sats の新しいVTXO、あなたにお釣り ${change.toLocaleString()} sats のVTXOが生まれます（差の ${teachingFee} sats は教材上の手数料）。`,
        en: `A new ${send.toLocaleString()}-sat VTXO for your friend and a ${change.toLocaleString()}-sat change VTXO for you are created (the ${teachingFee}-sat difference is a teaching fee).`,
      },
    },
  ];
}

// ---- Lesson 2: comparison of rails (general characteristics, not measurements)

export interface RailRow {
  key: 'settlement' | 'server' | 'fee' | 'speed' | 'receiverOnline';
  label: L;
  onchain: L;
  ark: L;
  lightning: L;
}

export const RAILS: RailRow[] = [
  { key: 'settlement', label: { ja: '確定のしかた', en: 'How it settles' }, onchain: { ja: 'ブロックに取り込まれ承認される', en: 'Included and confirmed in a block' }, ark: { ja: 'サーバーと共同署名した事前署名トランザクション（必要時にオンチェーン化）', en: 'Pre-signed transactions co-signed with the server (on-chain only if needed)' }, lightning: { ja: 'チャネル内のHTLCで決済', en: 'HTLCs settled through channels' } },
  { key: 'server', label: { ja: 'サーバーの役割', en: 'Role of a server' }, onchain: { ja: '不要', en: 'None' }, ark: { ja: 'Arkサーバーの協力が必要（非協力時は緊急Exit）', en: 'Needs the Ark server (emergency exit if it refuses)' }, lightning: { ja: '経路上のノード・チャネル相手が必要', en: 'Needs routing nodes and channel peers' } },
  { key: 'fee', label: { ja: '手数料の傾向', en: 'Fee tendency' }, onchain: { ja: 'ブロック空間の需要で変動', en: 'Varies with block-space demand' }, ark: { ja: 'サーバーの手数料表による。オンチェーン費用を多人数で分担', en: 'Per the server fee schedule; on-chain costs shared by many' }, lightning: { ja: '経路の手数料。少額は安い傾向', en: 'Routing fees; small amounts tend to be cheap' } },
  { key: 'speed', label: { ja: '速さの傾向', en: 'Speed tendency' }, onchain: { ja: '承認まで数十分以上のことも', en: 'Confirmation can take tens of minutes or more' }, ark: { ja: 'ラウンド外送金は即時。Refreshはラウンドを待つ', en: 'Out-of-round payments are instant; refresh waits for a round' }, lightning: { ja: '通常は数秒', en: 'Usually seconds' } },
  { key: 'receiverOnline', label: { ja: '受け手のオンライン', en: 'Receiver online?' }, onchain: { ja: '不要', en: 'Not needed' }, ark: { ja: '不要（サーバーのメールボックスに届く）', en: 'Not needed (delivered to a server mailbox)' }, lightning: { ja: '原則必要', en: 'Generally needed' } },
];

// ---- Lesson 3: round timeline

export type RoundPhase = 'waiting' | 'registration' | 'signing' | 'broadcast' | 'confirmed';
export const ROUND_PHASES: Array<{ phase: RoundPhase; label: L; body: L }> = [
  { phase: 'waiting', label: { ja: '次のラウンドを待つ', en: 'Wait for the next round' }, body: { ja: 'ラウンドはサーバーが決めた間隔で始まります。すぐには始まらないことがあります。', en: 'Rounds start at a server-defined interval. It may not start right away.' } },
  { phase: 'registration', label: { ja: '入力を登録', en: 'Register inputs' }, body: { ja: 'Refreshしたい古いVTXOと、受け取りたい新しいVTXOの内容をサーバーに伝えます。', en: 'You tell the server which old VTXOs to refresh and what new VTXOs you want.' } },
  { phase: 'signing', label: { ja: 'ツリーに署名・forfeit', en: 'Sign the tree, forfeit' }, body: { ja: '新しいトランザクションツリーに共同署名し、古いVTXOをforfeit（没収可能）にする署名を渡します。', en: 'You co-sign the new transaction tree and hand over forfeit signatures for the old VTXOs.' } },
  { phase: 'broadcast', label: { ja: 'ラウンドTXを放送', en: 'Broadcast round tx' }, body: { ja: 'サーバーがラウンドのトランザクションをオンチェーンに放送します。', en: 'The server broadcasts the round transaction on-chain.' } },
  { phase: 'confirmed', label: { ja: '承認・新VTXO', en: 'Confirmed, new VTXO' }, body: { ja: '承認されると新しいVTXOが使えるようになり、寿命がリセットされた状態になります。', en: 'Once confirmed, the new VTXO is usable with a fresh lifetime.' } },
];

// ---- Lesson 4: expiry model

export interface ExpiryPoint {
  tip: number;
  remainingNoRefresh: number;
  remainingWithRefresh: number;
  refreshed: boolean;
}

/**
 * Teaching model: a VTXO born at `start` with `lifetime` blocks. With refresh,
 * a new VTXO (fresh lifetime) replaces it once it is within `threshold` blocks.
 */
export function expiryModel(params: { start: number; lifetime: number; threshold: number; tip: number }): ExpiryPoint {
  const { start, lifetime, threshold, tip } = params;
  if (!(lifetime > threshold && threshold >= 0)) throw new RangeError('lifetime must exceed threshold');
  const remainingNoRefresh = start + lifetime - tip;
  let currentExpiry = start + lifetime;
  let refreshed = false;
  // Each time the tip reaches the threshold, a round replaces the VTXO with a fresh one.
  while (tip >= currentExpiry - threshold) {
    currentExpiry = currentExpiry - threshold + lifetime;
    refreshed = true;
  }
  return { tip, remainingNoRefresh, remainingWithRefresh: currentExpiry - tip, refreshed };
}

export function afterExpiryAbilities(): Array<{ op: L; possible: boolean; note: L }> {
  // From https://second.tech/docs/learn/lifetime ("What happens when VTXOs expire?")
  return [
    { op: { ja: 'Refresh', en: 'Refresh' }, possible: true, note: { ja: 'サーバーの協力が必要', en: 'Needs the server' } },
    { op: { ja: 'Lightning送金', en: 'Lightning send' }, possible: true, note: { ja: 'サーバーの協力が必要', en: 'Needs the server' } },
    { op: { ja: 'オンチェーン送金 / Offboard', en: 'On-chain send / offboard' }, possible: true, note: { ja: 'サーバーの協力が必要', en: 'Needs the server' } },
    { op: { ja: 'Ark送金', en: 'Ark payment' }, possible: false, note: { ja: '不可', en: 'Not possible' } },
    { op: { ja: '緊急Exit', en: 'Emergency exit' }, possible: false, note: { ja: '不可（自力の回復手段がなくなる）', en: 'Not possible (no unilateral remedy left)' } },
  ];
}

// ---- Lesson 5: exit routes

export interface ExitRouteStep {
  label: L;
  onchainTxs: number;
  waitsForConfirmation: boolean;
}

export function offboardRoute(): ExitRouteStep[] {
  return [
    { label: { ja: 'サーバーにOffboardを依頼', en: 'Ask the server to offboard' }, onchainTxs: 0, waitsForConfirmation: false },
    { label: { ja: 'サーバーが作ったTXに署名', en: 'Sign the server-built tx' }, onchainTxs: 0, waitsForConfirmation: false },
    { label: { ja: '1つのオンチェーンTXで着金', en: 'Funds arrive in one on-chain tx' }, onchainTxs: 1, waitsForConfirmation: true },
  ];
}

/** Emergency exit for a VTXO of the given exit depth (teaching model). */
export function emergencyExitRoute(exitDepth: number): ExitRouteStep[] {
  const d = Math.max(1, Math.floor(exitDepth));
  const steps: ExitRouteStep[] = [];
  for (let i = 1; i <= d; i++) {
    steps.push({
      label: i < d ? { ja: `ツリーのTX ${i}/${d} を放送（CPFPで手数料）`, en: `Broadcast tree tx ${i}/${d} (fee via CPFP)` } : { ja: `exitトランザクション ${i}/${d} を放送`, en: `Broadcast exit tx ${i}/${d}` },
      onchainTxs: 1,
      waitsForConfirmation: true,
    });
  }
  steps.push({ label: { ja: '相対タイムロックを待つ', en: 'Wait for the relative timelock' }, onchainTxs: 0, waitsForConfirmation: true });
  steps.push({ label: { ja: 'claimトランザクションで回収', en: 'Collect with a claim transaction' }, onchainTxs: 1, waitsForConfirmation: true });
  return steps;
}

// ---- Lesson 6: backup comparison

export type BackupKind = 'seed-only' | 'seed-plus-db';
export type ServerCondition = 'cooperative' | 'unavailable';

export interface RestoreOutcome {
  balance: 'restored' | 'not-restored' | 'partial-risk';
  history: 'restored' | 'lost';
  inProgressExits: 'restored' | 'lost';
}

/** From https://second.tech/docs/backups */
export function restoreOutcome(kind: BackupKind, server: ServerCondition): RestoreOutcome {
  if (kind === 'seed-plus-db') return { balance: 'restored', history: 'restored', inProgressExits: 'restored' };
  return {
    balance: server === 'cooperative' ? 'restored' : 'not-restored',
    history: 'lost',
    inProgressExits: 'lost',
  };
}
