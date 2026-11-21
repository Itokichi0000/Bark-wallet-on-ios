import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useT } from '../i18n/useT';
import { SourceTag } from '../components/common/Badges';
import { Card, KV, Notice, PageTitle, Tabs } from '../components/common/ui';
import { ConceptTree } from '../components/xray/ConceptTree';
import { SnapshotDiffView } from '../components/xray/SnapshotDiff';
import { RiskBadge, VtxoCard } from '../components/xray/VtxoCard';
import { VtxoTimeline } from '../components/xray/VtxoTimeline';
import { approxHours, assessRisk, reviewThreshold } from '../lib/wallet/expiry';
import { useApp } from '../state/store';

type Tab = 'coins' | 'life' | 'structure' | 'safety';

export function XRay() {
  const t = useT();
  const { snapshot, history, serverInfo, diff, record, mode, mark } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'coins';
  const [showSpent, setShowSpent] = useState(false);
  useEffect(() => mark('visited:xray'), [mark]);

  const tip = snapshot?.chainTipHeight;
  const all = snapshot?.vtxos ?? [];
  const live = all.filter((v) => v.state !== 'spent' && v.state !== 'exited');
  const shown = showSpent ? all : live;
  const movement = diff?.movementId ? history.find((m) => m.id === diff.movementId) : undefined;
  const risky = live
    .map((v) => ({ v, r: assessRisk({ vtxo: v, tipHeight: tip, reviewThresholdBlocks: reviewThreshold(serverInfo), maxExitDepth: serverInfo?.maxVtxoExitDepth }) }))
    .filter(({ r }) => r.level !== 'healthy');

  return (
    <div className="space-y-4">
      <PageTitle sub={snapshot ? `${t.xray.tip}: ${tip?.toLocaleString() ?? t.common.unavailable} · ${t.common.lastSync}: ${new Date(snapshot.capturedAt).toLocaleTimeString(t.locale)}` : undefined}>
        {t.xray.title}
      </PageTitle>
      <Tabs
        label={t.xray.title}
        value={tab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        tabs={(['coins', 'life', 'structure', 'safety'] as const).map((k) => ({ key: k, label: t.xray.tabs[k], sub: t.xray.tabDesc[k] }))}
      />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
        {snapshot?.vtxosUnavailable && (
          <>
            <Notice tone="warn" title={t.xray.unavailableTitle}>{t.xray.unavailableBody}</Notice>
            <ConceptTree />
          </>
        )}

        {tab === 'coins' && !snapshot?.vtxosUnavailable && (
          <>
            {diff && (
              <Card className="space-y-2" aria-labelledby="diff-h">
                <h2 id="diff-h" className="font-bold" data-anchor="diff">{t.xray.diffTitle} ({diff.label})</h2>
                <SnapshotDiffView diff={diff} movement={movement} />
              </Card>
            )}
            {!diff && <p className="text-sm text-muted">{t.xray.diffNone}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">{t.xray.counts(all.length, live.length)}</p>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={showSpent} onChange={(e) => setShowSpent(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                {t.xray.showSpent}
              </label>
            </div>
            {shown.length === 0 ? (
              <Card><p className="text-sm text-muted">{t.xray.empty}</p></Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {shown.map((v) => <VtxoCard key={v.id} vtxo={v} tip={tip} server={serverInfo} />)}
              </div>
            )}
            <p className="text-xs text-muted">{t.vtxo.reviewNote} {t.common.referenceOnly}</p>
          </>
        )}

        {tab === 'life' && (
          <Card>
            <VtxoTimeline history={history} />
          </Card>
        )}

        {tab === 'structure' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <h2 className="font-bold">{t.xray.structureReal}</h2>
              <p className="text-sm text-muted">{t.xray.structureRealBody}</p>
              {live.length === 0 ? (
                <p className="text-sm text-muted">{t.xray.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {live.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <Link to={`/xray/vtxo/${encodeURIComponent(v.id)}`} className="truncate font-mono text-xs hover:underline">{v.id}</Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <span aria-label={t.vtxo.exitDepth} className="flex gap-0.5">
                          {Array.from({ length: Math.min(v.exitDepth ?? 0, 12) }, (_, i) => <span key={i} aria-hidden className="h-3 w-1.5 rounded-sm bg-accent" />)}
                        </span>
                        <span className="tabular text-xs">{v.exitDepth ?? '?'}</span>
                        <SourceTag source={v.source} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <ConceptTree arkoorHops={mode === 'demo' ? 1 : 0} />
            </Card>
          </div>
        )}

        {tab === 'safety' && (
          <div className="space-y-4">
            {mode === 'signet' && serverInfo?.vtxoLifetimeBlocks !== undefined && (
              <Notice tone="warn">{t.xray.lifetimeNotice(serverInfo.vtxoLifetimeBlocks, t.common.approx(approxHours(serverInfo.vtxoLifetimeBlocks)!))}</Notice>
            )}
            <Card className="space-y-2">
              {risky.length === 0 ? (
                <p className="text-sm">✓ {t.xray.safetyNone}</p>
              ) : (
                <ul className="space-y-2">
                  {risky.map(({ v, r }) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <Link to={`/xray/vtxo/${encodeURIComponent(v.id)}`} className="font-mono text-xs hover:underline">{v.id.slice(0, 18)}…</Link>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted">{r.reasons.map((x) => t.vtxo.reasons[x]).join(' / ')}</span>
                        <RiskBadge level={r.level} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">{t.vtxo.reviewNote}</p>
            </Card>
            <Card>
              <dl>
                <KV k={t.xray.lifetime} v={serverInfo?.vtxoLifetimeBlocks !== undefined ? t.common.blocks(serverInfo.vtxoLifetimeBlocks) : t.common.unavailable} />
                <KV k={t.xray.nextRefresh} v={serverInfo?.refreshThresholdBlocks !== undefined ? t.common.blocks(serverInfo.refreshThresholdBlocks) : t.common.unavailable} />
                <KV k={t.xray.maxDepth} v={serverInfo?.maxVtxoExitDepth ?? t.common.unavailable} />
              </dl>
            </Card>
            <Card className="space-y-2">
              <h2 className="font-bold">{t.xray.backupStatus}</h2>
              {mode === 'signet' && <p className="text-sm">{record?.backupConfirmed ? `✓ ${t.xray.backupSeed}` : `⚠ ${t.xray.backupSeedNo}`}</p>}
              <p className="text-sm">⚠ {t.xray.backupDb}</p>
              <Link to="/settings#backup" className="text-sm font-semibold text-accent hover:underline">{t.header.backup} →</Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
