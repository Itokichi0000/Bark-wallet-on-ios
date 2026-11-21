// Interactive lessons. They only use lib/education/lessons.ts (pure, local).
// Nothing here can reach a wallet, the SDK or the network (T14).

import { useState } from 'react';
import { usePick, useT } from '../../i18n/useT';
import {
  RAILS,
  ROUND_PHASES,
  afterExpiryAbilities,
  emergencyExitRoute,
  expiryModel,
  offboardRoute,
  restoreOutcome,
  simulateSpend,
  type BackupKind,
  type ServerCondition,
} from '../../lib/education/lessons';
import { ConceptLabel } from '../common/Badges';
import { Button } from '../common/ui';
import { cx } from '../common/util';

function Simplified() {
  const t = useT();
  return <p className="text-xs text-muted">◌ {t.lab.simplified}</p>;
}

export function Lesson1() {
  const t = useT();
  const pick = usePick();
  const [step, setStep] = useState(0);
  const [send, setSend] = useState(1_000);
  const steps = simulateSpend(10_000, send, 20);
  const cur = steps[step]!;
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-semibold">{t.send.amountLabel}: {send.toLocaleString()} sats</span>
        <input type="range" min={500} max={9_000} step={500} value={send} onChange={(e) => { setSend(Number(e.target.value)); setStep(0); }} className="mt-1 w-full accent-[var(--accent)]" aria-label={t.send.amountLabel} />
      </label>
      <div className="flex min-h-28 flex-wrap items-end justify-center gap-3" aria-live="polite">
        {cur.coins.map((c) => (
          <div
            key={c.id}
            className={cx(
              'anim-rise flex flex-col items-center justify-center rounded-full border-2 text-center font-bold transition',
              c.status === 'spent' ? 'border-dashed border-line text-muted line-through opacity-60' : c.owner === 'me' ? 'border-accent bg-accent-soft' : 'border-info bg-info-soft',
            )}
            style={{ width: 56 + Math.sqrt(c.amount) * 0.6, height: 56 + Math.sqrt(c.amount) * 0.6 }}
          >
            <span className="text-xs">VTXO {c.id}</span>
            <span className="tabular text-sm">{c.amount.toLocaleString()}</span>
            <span className="text-[10px] font-normal">{c.owner === 'me' ? (t.locale.startsWith('ja') ? 'あなた' : 'you') : t.locale.startsWith('ja') ? '相手' : 'friend'}</span>
          </div>
        ))}
      </div>
      <p className="text-sm">{pick(cur.caption)}</p>
      <div className="flex gap-2">
        <Button onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))} disabled={step === steps.length - 1} data-testid="lesson1-step">{t.lab.step}</Button>
        <Button variant="ghost" onClick={() => setStep(0)}>{t.lab.reset}</Button>
      </div>
      <Simplified />
    </div>
  );
}

export function Lesson2() {
  const pick = usePick();
  const t = useT();
  const ja = t.locale.startsWith('ja');
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">1,000 sats</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pr-3" />
              <th className="py-2 pr-3">{ja ? 'オンチェーン' : 'On-chain'}</th>
              <th className="py-2 pr-3 text-accent">Ark</th>
              <th className="py-2">Lightning</th>
            </tr>
          </thead>
          <tbody>
            {RAILS.map((r) => (
              <tr key={r.key} className="border-b border-line/60 align-top">
                <th className="py-2 pr-3 text-xs font-semibold">{pick(r.label)}</th>
                <td className="py-2 pr-3">{pick(r.onchain)}</td>
                <td className="py-2 pr-3">{pick(r.ark)}</td>
                <td className="py-2">{pick(r.lightning)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{ja ? '一般的な特徴の比較で、測定値ではありません。' : 'General characteristics, not measurements.'}</p>
    </div>
  );
}

export function Lesson3() {
  const t = useT();
  const pick = usePick();
  const [i, setI] = useState(0);
  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-5">
        {ROUND_PHASES.map((p, idx) => (
          <li key={p.phase} className={cx('rounded-xl border p-2 text-xs transition', idx === i ? 'border-accent bg-accent-soft font-semibold' : idx < i ? 'border-line text-muted' : 'border-line')}>
            <span className="tabular">{idx + 1}.</span> {pick(p.label)}
          </li>
        ))}
      </ol>
      <p className="text-sm" aria-live="polite">{pick(ROUND_PHASES[i]!.body)}</p>
      <div className="flex gap-2">
        <Button onClick={() => setI((x) => Math.min(x + 1, ROUND_PHASES.length - 1))} disabled={i === ROUND_PHASES.length - 1}>{t.lab.step}</Button>
        <Button variant="ghost" onClick={() => setI(0)}>{t.lab.reset}</Button>
      </div>
      <Simplified />
    </div>
  );
}

export function Lesson4() {
  const t = useT();
  const pick = usePick();
  const ja = t.locale.startsWith('ja');
  const lifetime = 4_032; // ≈ 28 days (Second's documented mainnet lifetime); a teaching number only
  const threshold = 288;
  const [tip, setTip] = useState(0);
  const m = expiryModel({ start: 0, lifetime, threshold, tip });
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / lifetime) * 100))}%`;
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-semibold">{ja ? '経過ブロック' : 'Blocks elapsed'}: {tip.toLocaleString()}</span>
        <input data-testid="lesson4-slider" type="range" min={0} max={lifetime + 1_000} step={24} value={tip} onChange={(e) => setTip(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" aria-label={ja ? '経過ブロック' : 'Blocks elapsed'} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">{ja ? '放置した場合' : 'If you do nothing'}</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-muted" style={{ width: pct(m.remainingNoRefresh) }} /></div>
          <p className="mt-1 text-sm tabular" data-testid="lesson4-norefresh">
            {m.remainingNoRefresh > 0 ? t.common.blocks(m.remainingNoRefresh) : ja ? '⚠ 期限切れ（サーバー依存の状態）' : '⚠ Expired (now server-dependent)'}
          </p>
        </div>
        <div className="rounded-xl border border-accent/50 p-3">
          <p className="text-sm font-semibold">{ja ? `残り${threshold}ブロックでRefreshした場合` : `If refreshed at ${threshold} blocks left`}</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent" style={{ width: pct(m.remainingWithRefresh) }} /></div>
          <p className="mt-1 text-sm tabular">
            {t.common.blocks(m.remainingWithRefresh)} {m.refreshed && <span className="text-accent">↻ {ja ? '新しいVTXOに交換済み' : 'swapped for a new VTXO'}</span>}
          </p>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">{ja ? '期限切れのあとにできること（公式資料より）' : 'After expiry (from the official docs)'}</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {afterExpiryAbilities().map((a) => (
            <li key={a.op.en} className="flex items-center gap-2">
              <span aria-hidden className={a.possible ? 'text-ok' : 'text-danger'}>{a.possible ? '✓' : '✗'}</span>
              {pick(a.op)} <span className="text-xs text-muted">— {pick(a.note)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">{ja ? '「期限を過ぎたら必ず即消失」ではありませんが、自力で取り戻す手段（緊急Exit）がなくなり、サーバーの協力が前提になります。' : 'Expiry does not mean instant loss, but you lose the unilateral exit and depend on the server.'}</p>
      <p className="text-xs text-muted">{ja ? '※ ここでは公式資料の28日（約4,032ブロック）で説明しています。SecondのSignetサーバーは寿命がずっと短い設定です（実際の値はX-Ray › Safetyで確認できます）。' : 'Note: this uses the documented 28 days (~4,032 blocks). Second\'s Signet server is configured with a much shorter lifetime (see X-Ray › Safety for the live value).'}</p>
      <Simplified />
    </div>
  );
}

export function Lesson5() {
  const t = useT();
  const pick = usePick();
  const ja = t.locale.startsWith('ja');
  const [depth, setDepth] = useState(3);
  const off = offboardRoute();
  const ex = emergencyExitRoute(depth);
  const txs = (r: typeof off) => r.reduce((a, s) => a + s.onchainTxs, 0);
  return (
    <div className="space-y-4">
      <ConceptLabel />
      <label className="block text-sm">
        <span className="font-semibold">Exit depth: {depth}</span>
        <input type="range" min={1} max={8} value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" aria-label="Exit depth" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-ok/40 p-3" data-testid="route-offboard">
          <p className="font-semibold">{ja ? '協調的Offboard（サーバーが協力）' : 'Cooperative offboard (server helps)'}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{off.map((s, i) => <li key={i}>{pick(s.label)}</li>)}</ol>
          <p className="mt-2 text-xs text-muted">{ja ? `オンチェーンTX: ${txs(off)}件` : `On-chain txs: ${txs(off)}`}</p>
        </div>
        <div className="rounded-xl border border-danger/40 p-3" data-testid="route-exit">
          <p className="font-semibold">{ja ? '緊急Exit（サーバーが協力しない）' : 'Emergency exit (server does not help)'}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{ex.map((s, i) => <li key={i}>{pick(s.label)}{s.waitsForConfirmation && <span className="text-xs text-muted"> ⏳</span>}</li>)}</ol>
          <p className="mt-2 text-xs text-muted">{ja ? `オンチェーンTX: ${txs(ex)}件・各段で承認待ち・手数料用のオンチェーン資金が必要` : `On-chain txs: ${txs(ex)}; waits for each confirmation; needs on-chain funds for fees`}</p>
        </div>
      </div>
      <p className="text-xs text-muted">{ja ? 'ふだんはOffboard。緊急Exitはサーバーが応答しない・拒否するときの最終手段で、期限前に完了する必要があります。' : 'Offboard is the normal path. The emergency exit is a last resort when the server is unresponsive or refuses, and must finish before expiry.'}</p>
    </div>
  );
}

export function Lesson6() {
  const t = useT();
  const ja = t.locale.startsWith('ja');
  const [kind, setKind] = useState<BackupKind>('seed-only');
  const [server, setServer] = useState<ServerCondition>('cooperative');
  const out = restoreOutcome(kind, server);
  const mark = (ok: boolean) => <span aria-hidden className={ok ? 'text-ok' : 'text-danger'}>{ok ? '✓' : '✗'}</span>;
  const label = (v: string) => ({ restored: ja ? '戻る' : 'restored', 'not-restored': ja ? '戻らない' : 'not restored', 'partial-risk': ja ? '一部のリスク' : 'partial risk', lost: ja ? '失われる' : 'lost' })[v] ?? v;
  return (
    <div className="space-y-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold">{ja ? 'バックアップ' : 'Backup'}</legend>
        {(['seed-only', 'seed-plus-db'] as const).map((k) => (
          <Button key={k} variant={kind === k ? 'primary' : 'secondary'} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'seed-only' ? (ja ? '復元フレーズだけ' : 'Phrase only') : ja ? 'フレーズ＋継続DBバックアップ' : 'Phrase + continuous DB backup'}
          </Button>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-semibold">{ja ? 'Arkサーバー' : 'Ark server'}</legend>
        {(['cooperative', 'unavailable'] as const).map((k) => (
          <Button key={k} variant={server === k ? 'primary' : 'secondary'} aria-pressed={server === k} onClick={() => setServer(k)}>
            {k === 'cooperative' ? (ja ? '協力してくれる' : 'Cooperative') : ja ? '応答しない' : 'Unavailable'}
          </Button>
        ))}
      </fieldset>
      <ul className="space-y-1.5 text-sm" data-testid="restore-outcome" aria-live="polite">
        <li>{mark(out.balance === 'restored')} {ja ? '残高' : 'Balance'}: <strong>{label(out.balance)}</strong></li>
        <li>{mark(out.history === 'restored')} {ja ? '取引履歴' : 'History'}: <strong>{label(out.history)}</strong></li>
        <li>{mark(out.inProgressExits === 'restored')} {ja ? '進行中のExit' : 'In-progress exits'}: <strong>{label(out.inProgressExits)}</strong></li>
      </ul>
      <p className="text-xs text-muted">
        {ja
          ? '出典: Second「Backups」。Exit済みのビットコインもclaimするまではウォレットDBが必要です。このアプリ（Web SDK）では継続DBバックアップは未対応です。'
          : 'Source: Second "Backups". Exited bitcoin also needs the wallet DB until it is claimed. This app (Web SDK) does not support continuous DB backups.'}
      </p>
    </div>
  );
}
