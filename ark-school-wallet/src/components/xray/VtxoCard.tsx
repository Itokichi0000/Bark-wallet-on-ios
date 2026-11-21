import { Link } from 'react-router';
import { useT } from '../../i18n/useT';
import { approxHours, assessRisk, reviewThreshold, type RiskLevel } from '../../lib/wallet/expiry';
import type { ServerInfoView, VtxoView } from '../../lib/wallet/types';
import { SourceTag } from '../common/Badges';
import { Amount, IdWithCopy } from '../common/ui';
import { cx } from '../common/util';

const RISK_STYLE: Record<RiskLevel, { cls: string; icon: string }> = {
  'no-data': { cls: 'bg-surface-2 text-muted', icon: '?' },
  healthy: { cls: 'bg-ok-soft text-ok', icon: '✓' },
  review: { cls: 'bg-warn-soft text-warn', icon: '!' },
  'action-needed': { cls: 'bg-danger-soft text-danger', icon: '⚠' },
  'expired-or-exited': { cls: 'bg-surface-2 text-muted', icon: '■' },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const t = useT();
  const s = RISK_STYLE[level];
  return (
    <span data-testid="risk-badge" className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold', s.cls)}>
      <span aria-hidden>{s.icon}</span>
      {t.vtxo.risk[level]}
    </span>
  );
}

export function StateChip({ state }: { state: VtxoView['state'] }) {
  const t = useT();
  const tone: Record<VtxoView['state'], string> = {
    spendable: 'border-ok/50 text-ok',
    locked: 'border-warn/50 text-warn',
    pending: 'border-info/50 text-info',
    'needs-refresh': 'border-danger/50 text-danger',
    spent: 'border-line text-muted line-through',
    exited: 'border-line text-muted',
    unknown: 'border-line text-muted',
  };
  return <span className={cx('inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold', tone[state])}>{t.vtxo.states[state]}</span>;
}

export function VtxoCard({ vtxo, tip, server }: { vtxo: VtxoView; tip?: number; server?: ServerInfoView }) {
  const t = useT();
  const risk = assessRisk({ vtxo, tipHeight: tip, reviewThresholdBlocks: reviewThreshold(server), maxExitDepth: server?.maxVtxoExitDepth });
  const hours = approxHours(risk.blocksRemaining);
  const dim = vtxo.state === 'spent' || vtxo.state === 'exited';
  return (
    <article data-testid="vtxo-card" className={cx('anim-rise rounded-2xl border border-line bg-surface p-4', dim && 'opacity-70')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-bold">
          <Amount sats={vtxo.amountSats} />
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StateChip state={vtxo.state} />
          <RiskBadge level={risk.level} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted">{t.vtxo.id}</dt>
        <dd className="min-w-0 justify-self-end">
          <IdWithCopy id={vtxo.id} label="VTXO ID" />
        </dd>
        <dt className="text-muted">{t.vtxo.kind}</dt>
        <dd className="justify-self-end">{vtxo.kind ?? <span className="text-muted">{t.common.unavailable}</span>}</dd>
        <dt className="text-muted">{t.vtxo.expiry}</dt>
        <dd className="justify-self-end tabular">{vtxo.expiryHeight?.toLocaleString() ?? <span className="text-muted">{t.common.unavailable}</span>}</dd>
        <dt className="text-muted">{t.vtxo.remaining}</dt>
        <dd className="justify-self-end tabular" data-testid="blocks-remaining">
          {risk.blocksRemaining !== undefined ? t.common.blocks(risk.blocksRemaining) : <span className="text-muted">{t.common.unavailable}</span>}
          {hours !== undefined && <span className="ml-1 text-muted">({t.common.approx(hours)})</span>}
        </dd>
        <dt className="text-muted">{t.vtxo.exitDepth}</dt>
        <dd className="justify-self-end tabular">
          {vtxo.exitDepth ?? <span className="text-muted">{t.common.unavailable}</span>}
          {server?.maxVtxoExitDepth !== undefined && vtxo.exitDepth !== undefined && <span className="text-muted"> / {server.maxVtxoExitDepth}</span>}
        </dd>
      </dl>
      {risk.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {risk.reasons.map((r) => (
            <li key={r}>• {t.vtxo.reasons[r]}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <SourceTag source={vtxo.source} />
        <Link to={`/xray/vtxo/${encodeURIComponent(vtxo.id)}`} className="text-sm font-semibold text-accent hover:underline">
          {t.vtxo.open} →
        </Link>
      </div>
    </article>
  );
}
