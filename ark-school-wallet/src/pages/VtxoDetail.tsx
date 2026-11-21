import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../i18n/useT';
import { ExplainToggle, SourceTag } from '../components/common/Badges';
import { Amount, Button, Card, IdWithCopy, KV, Notice, PageTitle } from '../components/common/ui';
import { ConceptTree } from '../components/xray/ConceptTree';
import { RiskBadge, StateChip } from '../components/xray/VtxoCard';
import { emergencyExitRoute } from '../lib/education/lessons';
import { errorMessage } from '../lib/security/redact';
import { approxHours, assessRisk, reviewThreshold } from '../lib/wallet/expiry';
import type { ExitEstimateView, ExitTransactionsView, FeeEstimateView } from '../lib/wallet/types';
import { useApp } from '../state/store';
import { usePick } from '../i18n/useT';

const EXPLAIN = {
  ja: [
    { q: 'なぜ期限が必要なの？', easy: 'サーバーが用意したお金（流動性）を永遠に拘束しないためです。期限が来る前にRefreshすれば、新しいVTXOに交換できます。', tech: 'ルートと分岐の出力にはCLTVの期限があり、期限後はサーバーがsweepできます。そのためexitは期限前に完了している必要があります。' },
    { q: 'サーバーがいても自己管理（self-custody）なの？', easy: 'はい。サーバーはあなたと一緒に署名するだけで、あなたの同意なしに動かせません。いざとなれば自分だけで引き出せます。', tech: '各VTXOは事前署名済みトランザクション列を持ち、一方的な緊急Exitが可能です。arkoorで受け取ったVTXOは、Refreshまで送り手とサーバーが結託しないことを前提とします。' },
    { q: 'VTXOとUTXOは何が違う？', easy: 'UTXOはブロックチェーンに記録されたお金。VTXOは、必要なときにUTXOにできる「約束の束」です。', tech: 'VTXOはオフチェーンで保持される署名済みトランザクションの連なりで、共有UTXOの一部を表します。チェーンに書き込まれるのはExitやラウンドのときだけです。' },
  ],
  en: [
    { q: 'Why do VTXOs expire?', easy: 'So the server\'s money (liquidity) is not locked up forever. Refresh before expiry and you get a new VTXO.', tech: 'Root and branch outputs carry a CLTV expiry; afterwards the server can sweep them. An exit must therefore complete before expiry.' },
    { q: 'Is it self-custody if there is a server?', easy: 'Yes. The server only co-signs with you and cannot move funds without you. You can leave on your own if needed.', tech: 'Each VTXO holds pre-signed transactions allowing a unilateral emergency exit. Arkoor-received VTXOs assume sender and server do not collude until refreshed.' },
    { q: 'How is a VTXO different from a UTXO?', easy: 'A UTXO is money recorded on the blockchain. A VTXO is a bundle of promises that can become a UTXO when needed.', tech: 'A VTXO is a chain of signed transactions held off-chain, representing part of a shared UTXO. It only touches the chain on exit or in rounds.' },
  ],
};

export function VtxoDetail() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const { snapshot, serverInfo, port, lang } = useApp();
  const vtxo = snapshot?.vtxos.find((v) => v.id === id);
  const [exitEst, setExitEst] = useState<ExitEstimateView | string | null>(null);
  const [exitTxs, setExitTxs] = useState<ExitTransactionsView[] | string | null>(null);
  const [refreshEst, setRefreshEst] = useState<FeeEstimateView | string | null>(null);
  const caps = port?.getCapabilities();

  if (!vtxo) {
    return (
      <div className="space-y-3">
        <Notice tone="warn">{t.vtxo.notFound}</Notice>
        <Link to="/xray" className="font-semibold text-accent">← X-Ray</Link>
      </div>
    );
  }
  const tip = snapshot?.chainTipHeight;
  const risk = assessRisk({ vtxo, tipHeight: tip, reviewThresholdBlocks: reviewThreshold(serverInfo), maxExitDepth: serverInfo?.maxVtxoExitDepth });
  const hours = approxHours(risk.blocksRemaining);
  const na = <span className="text-muted">{t.common.unavailable}</span>;
  const run = async <T,>(fn: () => Promise<T>, set: (v: T | string) => void) => {
    try {
      set(await fn());
    } catch (err) {
      set(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/xray" className="text-sm font-semibold text-accent">← X-Ray</Link>
      <PageTitle>{t.vtxo.detailTitle}</PageTitle>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">1. {t.vtxo.identity}</h2>
          <SourceTag source={vtxo.source} />
        </div>
        <dl>
          <KV k={t.vtxo.id} v={<IdWithCopy id={vtxo.id} label="VTXO ID" />} />
          <KV k={t.vtxo.amount} v={<Amount sats={vtxo.amountSats} />} />
          <KV k={t.vtxo.kind} v={vtxo.kind ?? na} />
          <KV k={t.vtxo.state} v={<span className="flex flex-wrap justify-end gap-1"><StateChip state={vtxo.state} /><RiskBadge level={risk.level} /></span>} />
          <KV k={t.vtxo.rawState} v={<code className="text-xs">{vtxo.rawState ?? '—'}{vtxo.stateDetail ? ` (${vtxo.stateDetail})` : ''}</code>} />
          <KV k={t.vtxo.registered} v={vtxo.registered === undefined ? na : vtxo.registered ? t.common.yes : t.common.no} />
        </dl>
        <p className="text-xs text-muted">{t.vtxo.stateHelp[vtxo.state]}</p>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">{t.common.evidence}</summary>
          <ul className="mt-1 list-disc pl-4">{vtxo.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
        </details>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">2. {t.vtxo.lifetime}</h2>
        <dl>
          <KV k={t.vtxo.expiry} v={vtxo.expiryHeight?.toLocaleString() ?? na} />
          <KV k={t.xray.tip} v={tip?.toLocaleString() ?? na} />
          <KV k={t.vtxo.remaining} v={risk.blocksRemaining !== undefined ? t.common.blocks(risk.blocksRemaining) : na} />
          <KV k={t.vtxo.approx} v={hours !== undefined ? t.common.approx(hours) : na} />
        </dl>
        {risk.blocksRemaining !== undefined && serverInfo?.vtxoLifetimeBlocks !== undefined && (
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, (risk.blocksRemaining / serverInfo.vtxoLifetimeBlocks) * 100))}%` }} />
          </div>
        )}
        <p className="text-xs text-muted">{t.common.referenceOnly}</p>
        {caps?.refresh !== 'supported' && <Notice tone="info">{t.vtxo.refreshDisabled}</Notice>}
        {port?.estimateRefreshFee && caps?.feeEstimate === 'supported' && vtxo.state !== 'spent' && vtxo.state !== 'exited' && (
          <div className="space-y-2">
            <Button onClick={() => void run(() => port.estimateRefreshFee!([vtxo.id]), setRefreshEst)}>{t.vtxo.refreshEstimate}</Button>
            {typeof refreshEst === 'string' && <Notice tone="warn">{refreshEst}</Notice>}
            {refreshEst && typeof refreshEst !== 'string' && (
              <dl data-testid="refresh-estimate">
                <KV k={t.send.fee} v={<><Amount sats={refreshEst.feeSats} /> <SourceTag source={refreshEst.source} /></>} />
              </dl>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">3. {t.vtxo.howExits}</h2>
        <Notice tone="info">{t.vtxo.exitDisabled}</Notice>
        <dl>
          <KV k={t.vtxo.exitDepth} v={vtxo.exitDepth ?? na} />
          <KV k={t.vtxo.exitWeight} v={vtxo.exitTxWeightWu !== undefined ? `${vtxo.exitTxWeightWu.toLocaleString()} WU` : na} />
        </dl>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {emergencyExitRoute(vtxo.exitDepth ?? 1).map((s, i) => <li key={i}>{pick(s.label)}</li>)}
        </ol>
        <p className="text-xs text-muted">{t.common.conceptual}: {t.common.conceptualNote}</p>
        {port?.estimateExit && caps?.exitEstimate === 'supported' && vtxo.state !== 'spent' && (
          <div className="space-y-2">
            <Button onClick={() => void run(() => port.estimateExit!([vtxo.id]), setExitEst)} data-testid="exit-estimate">{t.vtxo.exitEstimate}</Button>
            <p className="text-xs text-muted">{t.vtxo.exitEstimateNote}</p>
            {typeof exitEst === 'string' && <Notice tone="warn">{exitEst}</Notice>}
            {exitEst && typeof exitEst !== 'string' && (
              <dl data-testid="exit-estimate-result">
                <KV k={t.vtxo.broadcastFee} v={<Amount sats={exitEst.broadcastFeeSats} />} />
                <KV k={t.vtxo.claimFee} v={<Amount sats={exitEst.claimFeeSats} />} />
                <KV k={t.vtxo.totalFee} v={<><Amount sats={exitEst.totalFeeSats} /> <SourceTag source={exitEst.source} /></>} />
                <KV k={t.vtxo.txsToBroadcast} v={exitEst.txsToBroadcast} />
                <KV k={t.vtxo.feeRate} v={`${exitEst.feeRateSatPerVb} sat/vB`} />
              </dl>
            )}
          </div>
        )}
        {port?.getExitTransactions && caps?.exitTransactions === 'supported' && vtxo.state !== 'spent' && (
          <div className="space-y-2">
            <Button onClick={() => void run(() => port.getExitTransactions!([vtxo.id]), setExitTxs)}>{t.vtxo.exitTxs}</Button>
            {typeof exitTxs === 'string' && <Notice tone="warn">{exitTxs}</Notice>}
            {Array.isArray(exitTxs) &&
              (exitTxs.every((e) => e.txids.length === 0) ? (
                <p className="text-sm text-muted">{t.vtxo.exitTxsNone}</p>
              ) : (
                <ol className="list-decimal space-y-0.5 pl-5 font-mono text-xs">
                  {exitTxs.flatMap((e) => e.txids).map((txid) => <li key={txid} className="break-all">{txid}</li>)}
                </ol>
              ))}
          </div>
        )}
        <ConceptTree arkoorHops={Math.max(0, (vtxo.exitDepth ?? 2) - 2)} />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">4. {t.vtxo.explain}</h2>
        {EXPLAIN[lang].map((e) => (
          <div key={e.q} className="space-y-1">
            <p className="text-sm font-semibold">{e.q}</p>
            <ExplainToggle easy={e.easy} technical={e.tech} />
          </div>
        ))}
        <Link to="/learn" className="text-sm font-semibold text-accent hover:underline">{t.common.learnMore} →</Link>
      </Card>
    </div>
  );
}
