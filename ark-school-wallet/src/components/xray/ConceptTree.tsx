import { useT } from '../../i18n/useT';
import { ConceptLabel } from '../common/Badges';

/**
 * Conceptual transaction tree (spec 7.3). It is an illustration only and is
 * always rendered with the conceptual label. It never uses wallet data.
 */
export function ConceptTree({ highlight = 'A' as 'A' | 'B' | 'none', arkoorHops = 0 }: { highlight?: 'A' | 'B' | 'none'; arkoorHops?: number }) {
  const t = useT();
  const ja = t.locale.startsWith('ja');
  const node = (x: number, y: number, label: string, sub: string, active: boolean, key: string) => (
    <g key={key}>
      <rect x={x - 62} y={y - 20} width={124} height={40} rx={10} fill={active ? 'var(--accent-soft)' : 'var(--surface)'} stroke={active ? 'var(--accent)' : 'var(--border)'} strokeWidth={active ? 2 : 1.2} />
      <text x={x} y={y - 3} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--fg)">{label}</text>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="var(--muted)">{sub}</text>
    </g>
  );
  const line = (x1: number, y1: number, x2: number, y2: number, active: boolean, key: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? 'var(--accent)' : 'var(--border)'} strokeWidth={active ? 2.5 : 1.5} />
  );
  const hops = Math.min(3, Math.max(0, arkoorHops));
  const height = 300 + hops * 56;
  return (
    <figure className="space-y-2">
      <ConceptLabel />
      <svg viewBox={`0 0 420 ${height}`} className="w-full" role="img" aria-label={t.common.conceptual}>
        {line(210, 50, 110, 140, highlight === 'A', 'l1')}
        {line(210, 50, 310, 140, highlight === 'B', 'l2')}
        {line(110, 160, 110, 240, highlight === 'A', 'l3')}
        {line(310, 160, 310, 240, highlight === 'B', 'l4')}
        {node(210, 40, ja ? '共有アンカー' : 'Shared anchor', ja ? 'オンチェーンUTXO' : 'on-chain UTXO', highlight !== 'none', 'root')}
        {node(110, 150, ja ? '分岐' : 'Branch', ja ? '署名済み・オフチェーン' : 'pre-signed, off-chain', highlight === 'A', 'b1')}
        {node(310, 150, ja ? '分岐' : 'Branch', ja ? '署名済み・オフチェーン' : 'pre-signed, off-chain', highlight === 'B', 'b2')}
        {node(110, 250, 'VTXO A', ja ? 'あなたのコイン' : 'your coin', highlight === 'A', 'v1')}
        {node(310, 250, 'VTXO B', ja ? 'ほかの人' : 'someone else', highlight === 'B', 'v2')}
        {Array.from({ length: hops }, (_, i) => (
          <g key={`hop${i}`}>
            {line(110, 270 + i * 56, 110, 286 + i * 56, true, `hl${i}`)}
            {node(110, 306 + i * 56, `arkoor +${i + 1}`, ja ? 'ラウンド外送金で延長' : 'extended by OOR spend', true, `h${i}`)}
          </g>
        ))}
      </svg>
      <figcaption className="text-xs text-muted">
        {ja
          ? '共有アンカーから自分のVTXOまでの道すじ（オレンジ）が、緊急Exitで順に放送するトランザクションのイメージです。arkoorで受け取るたびに道すじが1段のびます。'
          : 'The orange path from the shared anchor to your VTXO illustrates the transactions an emergency exit broadcasts in order. Each arkoor receive extends the path by one step.'}
      </figcaption>
    </figure>
  );
}
