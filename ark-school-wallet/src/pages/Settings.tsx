import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Field, KV, Notice, PageTitle, inputClass } from '../components/common/ui';
import { getSignetConfig } from '../lib/bark/config';
import { SCENARIOS, type ScenarioName } from '../lib/demo/fixtures';
import { requestPersistentStorage } from '../lib/security/environment';
import { exportDiagnostics } from '../lib/security/log';
import { destroyWallet, unsealMnemonic } from '../lib/security/vault';
import type { Capability } from '../lib/wallet/types';
import { useApp } from '../state/store';

export function Settings() {
  const t = useT();
  const nav = useNavigate();
  const { mode, port, demo, record, serverInfo, startDemo, closeWallet, lastSyncAt, snapshot } = useApp();
  const cfg = getSignetConfig();
  const [persist, setPersist] = useState<string | null>(null);
  const [seedPass, setSeedPass] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [delStep, setDelStep] = useState(0);
  const [delWord, setDelWord] = useState('');

  // Hide the phrase again after 60 s or when leaving the page.
  useEffect(() => {
    if (!seed) return;
    const id = setTimeout(() => setSeed(null), 60_000);
    return () => clearTimeout(id);
  }, [seed]);

  useEffect(() => {
    if (location.hash === '#backup') document.getElementById('backup')?.scrollIntoView();
  }, []);

  const caps = port?.getCapabilities();

  return (
    <div className="space-y-4">
      <PageTitle>{t.settings.title}</PageTitle>

      <Card>
        <h2 className="mb-1 font-bold">{t.settings.network}</h2>
        <dl>
          <KV k={t.settings.network} v={<strong>{t.settings.networkFixed}</strong>} />
          <KV k={t.settings.server} v={cfg.serverAddress} mono />
          <KV k={t.settings.esplora} v={cfg.esploraAddress} mono />
          <KV k={t.settings.faucet} v={<a className="text-accent hover:underline" href={cfg.faucetUrl} target="_blank" rel="noreferrer noopener">{cfg.faucetUrl} ↗</a>} />
          <KV k={t.common.lastSync} v={lastSyncAt ? new Date(lastSyncAt).toLocaleString(t.locale) : t.common.never} />
        </dl>
        {serverInfo && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold">{t.settings.serverInfo}</summary>
            <dl className="mt-1">
              <KV k="network" v={serverInfo.network} />
              <KV k="vtxoLifetime" v={serverInfo.vtxoLifetimeBlocks ?? '—'} />
              <KV k="vtxoExitDelta" v={serverInfo.vtxoExitDeltaBlocks ?? '—'} />
              <KV k="maxVtxoExitDepth" v={serverInfo.maxVtxoExitDepth ?? '—'} />
              <KV k="roundIntervalSecs" v={serverInfo.roundIntervalSecs ?? '—'} />
              <KV k="vtxoRefreshExpiryThreshold" v={serverInfo.refreshThresholdBlocks ?? '—'} />
            </dl>
          </details>
        )}
        <p className="mt-3 text-sm font-semibold">{t.settings.syncMode}</p>
        <p className="text-sm text-muted">{t.settings.syncModeBody}</p>
      </Card>

      <Card className="space-y-3">
        <h2 id="backup" className="scroll-mt-20 font-bold">{t.settings.backup}</h2>
        <Notice tone="warn">{t.settings.backupBody1}</Notice>
        <Notice tone="warn">{t.settings.backupBody2}</Notice>
        <Notice tone="info">{t.settings.backupBody3}</Notice>
        <p className="text-sm">⛔ {t.settings.exportUnsupported}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={async () => {
            const r = await requestPersistentStorage();
            setPersist(r === 'granted' ? t.create.persistGranted : r === 'denied' ? t.create.persistDenied : 'unsupported');
          }}>{t.settings.storageRequest}</Button>
          {persist && <span className="text-sm" role="status">{persist}</span>}
        </div>
      </Card>

      {mode === 'signet' && record && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.settings.showSeed}</h2>
          <p className="text-sm text-muted">{t.settings.showSeedLead}</p>
          {seed ? (
            <div className="space-y-2">
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {seed.split(' ').map((w, i) => (
                  <li key={i} className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm"><span className="mr-2 text-muted">{i + 1}.</span>{w}</li>
                ))}
              </ol>
              <Button onClick={() => setSeed(null)}>{t.common.hide}</Button>
            </div>
          ) : (
            <form className="space-y-2" onSubmit={async (e) => {
              e.preventDefault();
              try {
                setSeed(await unsealMnemonic(record, seedPass));
                setSeedErr(null);
              } catch {
                setSeedErr(t.unlock.wrong);
              }
              setSeedPass('');
            }}>
              <Field id="seed-pass" label={t.unlock.pass} error={seedErr}>
                <input id="seed-pass" type="password" autoComplete="current-password" className={inputClass} value={seedPass} onChange={(e) => setSeedPass(e.target.value)} />
              </Field>
              <Button type="submit">{t.common.show}</Button>
            </form>
          )}
        </Card>
      )}

      {caps && (
        <Card>
          <h2 className="mb-2 font-bold">{t.settings.capabilities}</h2>
          <dl>
            {(Object.keys(caps) as Capability[]).map((k) => (
              <KV key={k} k={t.settings.capNames[k]} v={<span data-cap={k}>{caps[k] === 'supported' ? '✓' : caps[k] === 'disabled' ? '◐' : '✗'} {t.settings.capStatus[caps[k]]}</span>} />
            ))}
          </dl>
        </Card>
      )}

      {mode === 'demo' && demo && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.settings.demo}</h2>
          <Field id="scenario" label={t.settings.demoScenario}>
            <select id="scenario" className={inputClass} defaultValue="" onChange={async (e) => {
              if (e.target.value) await startDemo(demo, e.target.value as ScenarioName);
            }}>
              <option value="" disabled>—</option>
              {SCENARIOS.map((s) => <option key={s} value={s}>{t.settings.scenarios[s]}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startDemo(demo, 'empty')}>{t.settings.demoReset}</Button>
            <Button variant="ghost" onClick={async () => { await closeWallet(); nav('/'); }}>{t.settings.leaveDemo}</Button>
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-bold">{t.settings.diagnostics}</h2>
        <p className="text-sm text-muted">{t.settings.diagnosticsNote}</p>
        <Button onClick={() => {
          const text = exportDiagnostics({ mode, walletId: record?.id ?? (mode === 'demo' ? 'demo' : null), lastSyncAt, chainTip: snapshot?.chainTipHeight, vtxoCount: snapshot?.vtxos.length, capabilities: caps });
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `ark-school-diagnostics-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}>{t.settings.diagnostics}</Button>
      </Card>

      {mode === 'signet' && record && (
        <Card className="space-y-3 border-danger/40">
          <Button variant="secondary" onClick={async () => { await closeWallet(); nav('/'); }}>{t.settings.lockWallet}</Button>
          <h2 className="font-bold text-danger">{t.settings.deleteWallet}</h2>
          {delStep === 0 && <Button variant="danger" onClick={() => setDelStep(1)}>{t.settings.deleteWallet}</Button>}
          {delStep === 1 && (
            <div className="space-y-2">
              <Notice tone="danger">{t.settings.deleteWarn}</Notice>
              <Field id="del-word" label={t.settings.deleteConfirmLabel}>
                <input id="del-word" className={inputClass} value={delWord} onChange={(e) => setDelWord(e.target.value)} autoComplete="off" />
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setDelStep(0); setDelWord(''); }}>{t.common.cancel}</Button>
                <Button variant="danger" disabled={delWord.trim() !== t.settings.deleteWord} onClick={async () => {
                  await closeWallet();
                  await destroyWallet(record);
                  nav('/');
                }}>{t.settings.deleteNow}</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
