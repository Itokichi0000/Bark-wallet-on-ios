import { Link } from 'react-router';
import { useT } from '../../i18n/useT';
import type { MovementView } from '../../lib/wallet/types';
import { SourceTag } from '../common/Badges';
import { Amount } from '../common/ui';
import { shortId } from '../common/util';

function Ids({ label, ids, sign }: { label: string; ids: string[]; sign: string }) {
  if (ids.length === 0) return null;
  return (
    <div className="text-xs">
      <span className="text-muted">{label}: </span>
      {ids.map((id) => (
        <Link key={id} to={`/xray/vtxo/${encodeURIComponent(id)}`} className="mr-2 font-mono hover:underline">
          {sign}
          {shortId(id, 6, 4)}
        </Link>
      ))}
    </div>
  );
}

/** "Life" tab: real movements from wallet.history() (or demo fixtures), oldest first. */
export function VtxoTimeline({ history }: { history: MovementView[] }) {
  const t = useT();
  if (history.length === 0) return <p className="text-sm text-muted">{t.xray.lifeEmpty}</p>;
  const ordered = [...history].reverse();
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {ordered.map((m) => (
        <li key={m.id} className="relative">
          <span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent bg-surface" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{m.kind}</p>
            <span className="text-xs text-muted">{m.status}</span>
            <SourceTag source={m.source} />
          </div>
          <p className="text-xs text-muted">{m.createdAt ? new Date(m.createdAt).toLocaleString(t.locale) : '—'}</p>
          {m.effectiveBalanceSats !== undefined && (
            <p className="text-sm">
              {m.effectiveBalanceSats >= 0 ? '+' : '−'}
              <Amount sats={Math.abs(m.effectiveBalanceSats)} />
            </p>
          )}
          <Ids label={t.xray.inputs} ids={m.inputVtxoIds} sign="−" />
          <Ids label={t.xray.outputs} ids={m.outputVtxoIds} sign="+" />
          <Ids label={t.xray.exited} ids={m.exitedVtxoIds} sign="⇣" />
        </li>
      ))}
    </ol>
  );
}
