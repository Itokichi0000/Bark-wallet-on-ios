import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/useT';
import { Button, Card, CopyButton, Field, Notice, PageTitle, inputClass } from '../components/common/ui';
import { QrCode } from '../components/wallet/QrCode';
import { getSignetConfig } from '../lib/bark/config';
import { errorMessage } from '../lib/security/redact';
import { approxHours } from '../lib/wallet/expiry';
import { formatSats } from '../lib/wallet/sats';
import { useApp } from '../state/store';

export function Receive() {
  const t = useT();
  const { port, mode, demo, sync, snapshot, reload, recordDiff, serverInfo } = useApp();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [check, setCheck] = useState<{ delta: number } | 'none' | null>(null);
  const [busy, setBusy] = useState(false);

  const fresh = useCallback(async () => {
    if (!port) return;
    try {
      setAddress(await port.getReceiveAddress());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [port]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off fetch on mount
    void fresh();
  }, [fresh]);

  const verify = async () => {
    setBusy(true);
    const before = useApp.getState().snapshot;
    const after = await sync();
    const a = before?.balance.totalSats;
    const b = after?.balance.totalSats;
    if (before && after && a !== undefined && b !== undefined && b > a) {
      setCheck({ delta: b - a });
      recordDiff({ label: 'receive', before, after });
    } else setCheck('none');
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle sub={t.common.testSats}>{t.receive.title}</PageTitle>
      {mode === 'demo' && <Notice tone="demo">{t.receive.demoAddress}</Notice>}
      {mode === 'signet' && serverInfo?.vtxoLifetimeBlocks !== undefined && (
        <Notice tone="warn">{t.xray.lifetimeNotice(serverInfo.vtxoLifetimeBlocks, t.common.approx(approxHours(serverInfo.vtxoLifetimeBlocks)!))}</Notice>
      )}
      <Card className="space-y-4">
        <p className="text-sm font-semibold">{t.receive.address}</p>
        {address ? (
          <>
            <QrCode value={address} alt={t.receive.qrAlt} />
            <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
              <code data-testid="receive-address" className="min-w-0 flex-1 break-all font-mono text-xs">{address}</code>
              <CopyButton value={address} label={t.receive.address} />
            </div>
          </>
        ) : error ? (
          <Notice tone="danger" title={t.errors.server}>{error}</Notice>
        ) : (
          <p className="text-muted">{t.common.loading}</p>
        )}
        <Button variant="ghost" onClick={() => void fresh()}>{t.receive.newAddress}</Button>
        <Field id="recv-note" label={t.receive.amount} hint={t.receive.amountNote}>
          <input id="recv-note" inputMode="numeric" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {t.receive.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        {mode === 'signet' && (
          <a href={getSignetConfig().faucetUrl} target="_blank" rel="noreferrer noopener" className="inline-block text-sm font-semibold text-accent hover:underline">
            {t.receive.faucet} ↗
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void verify()} disabled={busy}>
            {busy ? t.common.syncing : t.receive.checkNow}
          </Button>
          {mode === 'demo' && demo && (
            <Button
              data-testid="demo-receive-here"
              onClick={async () => {
                const before = useApp.getState().snapshot;
                await demo.receive(note && /^\d+$/.test(note) ? Number(note) : 5_000);
                await reload();
                const after = useApp.getState().snapshot;
                if (before && after) {
                  recordDiff({ label: 'receive', before, after });
                  setCheck({ delta: (after.balance.totalSats ?? 0) - (before.balance.totalSats ?? 0) });
                }
              }}
            >
              {t.receive.demoReceive}
            </Button>
          )}
        </div>
        <div aria-live="polite">
          {check === 'none' && <Notice tone="info" title={t.receive.waiting}>{t.receive.noChange}</Notice>}
          {check && check !== 'none' && <Notice tone="ok">{t.receive.received(formatSats(check.delta, t.locale))}</Notice>}
        </div>
        {snapshot && <p className="text-xs text-muted">{t.dashboard.spendable}: {formatSats(snapshot.balance.spendableSats, t.locale)} sats</p>}
      </Card>
    </div>
  );
}
