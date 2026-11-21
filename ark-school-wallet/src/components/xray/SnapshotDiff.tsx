import { useT } from '../../i18n/useT';
import { compareSnapshots } from '../../lib/wallet/snapshots';
import type { MovementView, VtxoView } from '../../lib/wallet/types';
import type { DiffRecord } from '../../state/store';
import { SourceTag } from '../common/Badges';
import { Amount, Notice } from '../common/ui';
import { cx, shortId } from '../common/util';
import { StateChip } from './VtxoCard';

function Row({ v, tone, sign }: { v: VtxoView; tone: 'created' | 'consumed' | 'changed'; sign: string }) {
  return (
    <li className={cx('flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm anim-rise', tone === 'created' ? 'border-ok/40 bg-ok-soft' : tone === 'consumed' ? 'border-line bg-surface-2' : 'border-info/40 bg-info-soft')}>
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="font-bold">{sign}</span>
        <code className="truncate font-mono text-xs" title={v.id}>{shortId(v.id)}</code>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StateChip state={v.state} />
        <Amount sats={v.amountSats} />
      </span>
    </li>
  );
}

export function SnapshotDiffView({ diff, movement }: { diff: DiffRecord; movement?: MovementView }) {
  const t = useT();
  const cmp = compareSnapshots(diff.before, diff.after);
  if (!cmp.comparable) {
    return <Notice tone="warn" title={t.xray.unavailableTitle}>{cmp.reason}</Notice>;
  }
  const source = diff.after.mode === 'demo' ? 'demo' : 'sdk';
  return (
    <div className="space-y-3" data-testid="snapshot-diff">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <SourceTag source={source} />
        <span>{t.xray.diffEvidence}</span>
        <span>
          {new Date(diff.before.capturedAt).toLocaleTimeString(t.locale)} → {new Date(diff.after.capturedAt).toLocaleTimeString(t.locale)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-semibold">− {t.xray.inputs} ({cmp.consumed.length})</p>
          <ul className="space-y-1.5" data-testid="diff-consumed">
            {cmp.consumed.map((v) => <Row key={v.id} v={v} tone="consumed" sign="−" />)}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">+ {t.xray.outputs} ({cmp.created.length})</p>
          <ul className="space-y-1.5" data-testid="diff-created">
            {cmp.created.map((v) => <Row key={v.id} v={v} tone="created" sign="+" />)}
          </ul>
        </div>
      </div>
      {cmp.stateChanged.length > 0 && (
        <ul className="space-y-1.5">
          {cmp.stateChanged.map((c) => <Row key={c.id} v={c.vtxo} tone="changed" sign="↻" />)}
        </ul>
      )}
      {cmp.spendableDeltaSats !== undefined && (
        <p className="text-sm">
          {t.dashboard.spendable}: <strong className="tabular">{cmp.spendableDeltaSats > 0 ? '+' : ''}{cmp.spendableDeltaSats.toLocaleString()} sats</strong>
        </p>
      )}
      {movement && (
        <p className="text-xs text-muted">
          {movement.source === 'sdk' ? 'wallet.history()' : 'DEMO'} #{movement.id}: inputVtxoIds {movement.inputVtxoIds.length}, outputVtxoIds {movement.outputVtxoIds.length}
          {movement.feeSats !== undefined && <> · {t.send.fee}: {movement.feeSats.toLocaleString()} sats</>}
        </p>
      )}
    </div>
  );
}
