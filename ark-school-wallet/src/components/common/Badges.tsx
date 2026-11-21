import { useT } from '../../i18n/useT';
import type { DataSource } from '../../lib/wallet/types';
import { cx } from './util';

export function NetworkBadge() {
  const t = useT();
  return (
    <span data-testid="network-badge" className="inline-flex items-center gap-1 rounded-md border border-fg/30 bg-surface-2 px-2 py-0.5 text-[11px] font-bold tracking-widest">
      <span aria-hidden>●</span>
      {t.common.signet}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: 'demo' | 'signet' | 'none' }) {
  const t = useT();
  if (mode === 'none') return null;
  const demo = mode === 'demo';
  return (
    <span
      data-testid="mode-badge"
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-widest',
        demo ? 'bg-demo-soft text-demo border border-demo/40' : 'bg-ok-soft text-ok border border-ok/40',
      )}
    >
      <span aria-hidden>{demo ? '◇' : '◆'}</span>
      {demo ? t.common.demo : t.common.live}
    </span>
  );
}

export function SourceTag({ source }: { source: DataSource }) {
  const t = useT();
  return (
    <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', source === 'demo' ? 'bg-demo-soft text-demo' : 'bg-ok-soft text-ok')}>
      {source === 'demo' ? t.common.sourceDemo : t.common.sourceSdk}
    </span>
  );
}

export function ConceptLabel() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-info/50 bg-info-soft px-3 py-2 text-xs text-info">
      <span className="font-bold">◌ {t.common.conceptual}</span>
      <span>{t.common.conceptualNote}</span>
    </div>
  );
}

export function ExplainToggle({ easy, technical }: { easy: string; technical: string }) {
  const t = useT();
  return (
    <details className="group rounded-xl border border-line bg-surface-2/60 p-3 text-sm">
      <summary className="cursor-pointer list-none font-semibold">
        <span aria-hidden className="mr-1 inline-block transition group-open:rotate-90">▸</span>
        {t.common.easy}
      </summary>
      <p className="mt-2 leading-relaxed">{easy}</p>
      <p className="mt-3 text-xs font-semibold text-muted">{t.common.technical}</p>
      <p className="mt-1 leading-relaxed text-muted">{technical}</p>
    </details>
  );
}
