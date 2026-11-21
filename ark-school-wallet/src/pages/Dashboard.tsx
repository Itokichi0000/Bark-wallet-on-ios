import { Link } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Notice, PageTitle } from '../components/common/ui';
import { BalanceCard } from '../components/wallet/BalanceCard';
import { HistoryList } from '../components/wallet/HistoryList';
import { PendingSendNotice } from '../components/wallet/PendingSendNotice';
import { formatSats } from '../lib/wallet/sats';
import { useApp } from '../state/store';

export function Dashboard() {
  const t = useT();
  const { snapshot, history, sync, syncing, syncError, mode, demo, reload, progress, mark } = useApp();
  const live = snapshot?.vtxos.filter((v) => v.state !== 'spent' && v.state !== 'exited') ?? [];
  const needsRefresh = live.filter((v) => v.state === 'needs-refresh').length;
  const pending = snapshot?.balance.pendingSats;

  const tourDone = [
    (snapshot?.vtxos.length ?? 0) > 0,
    !!progress['visited:xray'],
    history.some((m) => m.sentTo.length > 0),
    !!progress['visited:diff'],
    !!progress['lesson:4'] || !!progress['lesson:5'],
  ];

  return (
    <div className="space-y-4">
      <PageTitle>{t.dashboard.title}</PageTitle>
      <PendingSendNotice />
      {syncError && <Notice tone="warn" title={t.dashboard.syncFailed}>{syncError}</Notice>}

      <BalanceCard snapshot={snapshot} />

      <div className="grid grid-cols-3 gap-2">
        <Link to="/receive" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-3 text-sm font-bold text-accent-fg">
          ↓ {t.dashboard.receive}
        </Link>
        <Link to="/send" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-bold">
          ↑ {t.dashboard.send}
        </Link>
        <Button onClick={() => void sync()} disabled={syncing} className="min-h-12" data-testid="sync-button">
          ⟳ {syncing ? t.common.syncing : t.common.sync}
        </Button>
      </div>
      {mode === 'signet' && <p className="text-xs text-muted">{t.dashboard.autoSync}</p>}

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-line bg-surface px-3 py-1" data-testid="vtxo-count">{t.dashboard.vtxos(live.length)}</span>
        <span className="rounded-full border border-line bg-surface px-3 py-1">{t.dashboard.needsRefreshCount(needsRefresh)}</span>
        <span className="rounded-full border border-line bg-surface px-3 py-1">{t.dashboard.pendingAmount(formatSats(pending, t.locale))}</span>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-accent-soft">
        <p className="text-sm font-semibold">
          <span aria-hidden className="mr-1 text-accent">●</span>
          {t.dashboard.hint}
        </p>
        <Link to="/xray" className="text-sm font-bold text-accent hover:underline" onClick={() => mark('visited:xray')}>
          {t.dashboard.seeInside}
        </Link>
      </Card>

      {mode === 'demo' && demo && (
        <Card>
          <h2 className="mb-2 font-bold">{t.dashboard.tourTitle}</h2>
          <ol className="space-y-1.5 text-sm">
            {t.dashboard.tour.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span aria-hidden className={tourDone[i] ? 'text-ok' : 'text-muted'}>{tourDone[i] ? '✓' : '○'}</span>
                <span className={tourDone[i] ? 'line-through text-muted' : ''}>{i + 1}. {label}</span>
              </li>
            ))}
          </ol>
          {(snapshot?.vtxos.length ?? 0) === 0 && (
            <Button
              variant="primary"
              className="mt-3"
              data-testid="demo-receive"
              onClick={async () => {
                await demo.receive(10_000);
                await reload();
              }}
            >
              {t.dashboard.demoReceive('10,000')}
            </Button>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-bold">{t.dashboard.recent}</h2>
        <HistoryList items={history} limit={5} />
      </Card>
    </div>
  );
}
