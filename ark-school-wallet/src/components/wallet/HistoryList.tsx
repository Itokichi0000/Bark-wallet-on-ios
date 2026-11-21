import { useT } from '../../i18n/useT';
import type { MovementView } from '../../lib/wallet/types';
import { SourceTag } from '../common/Badges';
import { Amount } from '../common/ui';
import { cx } from '../common/util';

export function HistoryList({ items, limit }: { items: MovementView[]; limit?: number }) {
  const t = useT();
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) return <p className="text-sm text-muted">{t.dashboard.noHistory}</p>;
  return (
    <ul className="divide-y divide-line">
      {shown.map((m) => {
        const delta = m.effectiveBalanceSats;
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold">{m.kind}</p>
              <p className="text-xs text-muted">
                {m.status} · {m.createdAt ? new Date(m.createdAt).toLocaleString(t.locale) : '—'} · <SourceTag source={m.source} />
              </p>
            </div>
            <span className={cx('shrink-0 font-semibold', delta !== undefined && delta > 0 && 'text-ok', delta !== undefined && delta < 0 && 'text-fg')}>
              {delta === undefined ? <span className="text-muted">{t.common.unavailable}</span> : (
                <>
                  {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                  <Amount sats={Math.abs(delta)} />
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
