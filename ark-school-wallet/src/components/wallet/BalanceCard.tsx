import { useT } from '../../i18n/useT';
import type { WalletSnapshot } from '../../lib/wallet/types';
import { SourceTag } from '../common/Badges';
import { Amount, Card } from '../common/ui';

export function BalanceCard({ snapshot }: { snapshot: WalletSnapshot | null }) {
  const t = useT();
  const b = snapshot?.balance;
  const source = snapshot?.mode === 'demo' ? 'demo' : 'sdk';
  return (
    <Card aria-label={t.dashboard.spendable}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{t.dashboard.spendable}</p>
        {snapshot && <SourceTag source={source} />}
      </div>
      <p data-testid="spendable" className="mt-1 text-4xl font-bold tracking-tight">
        {snapshot ? <Amount sats={b?.spendableSats} /> : <span className="text-muted">{t.common.loading}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{t.common.testSats}</p>
      {snapshot && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            { k: t.dashboard.needsRefresh, v: b?.needsRefreshSats, id: 'needs-refresh' },
            { k: t.dashboard.pending, v: b?.pendingSats, id: 'pending' },
            { k: t.dashboard.total, v: b?.totalSats, id: 'total' },
            { k: t.dashboard.onchain, v: b?.onchainSats, id: 'onchain' },
          ].map((row) => (
            <div key={row.id} className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-muted">{row.k}</dt>
              <dd data-testid={`balance-${row.id}`} className="font-semibold">
                <Amount sats={row.v} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted">{t.dashboard.notSpendableNote}</p>
    </Card>
  );
}
