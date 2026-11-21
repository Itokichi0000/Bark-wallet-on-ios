import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { clearPendingSend, findMatchingMovement } from '../../lib/wallet/reconcile';
import { useApp } from '../../state/store';
import { Button, Notice } from '../common/ui';

/** Shown whenever a payment with an unknown outcome exists (T09, reload case). */
export function PendingSendNotice() {
  const t = useT();
  const { pendingSend, sync, refreshPendingSend } = useApp();
  const [result, setResult] = useState<'found' | 'not-found' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!pendingSend) return null;
  return (
    <Notice tone="warn" title={t.send.unknownTitle} role="alert">
      <p>{pendingSend.phase === 'in-flight' ? t.errors.reload : t.send.unknownBody}</p>
      <p className="mt-1 font-mono text-xs">
        {pendingSend.amountSats.toLocaleString()} sats → {pendingSend.address.slice(0, 16)}… ({new Date(pendingSend.startedAt).toLocaleString(t.locale)})
      </p>
      {result === 'found' && <p className="mt-2 font-semibold text-ok">✓ {t.send.found}</p>}
      {result === 'not-found' && <p className="mt-2 font-semibold">{t.send.notFound}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await sync();
            const history = useApp.getState().history;
            setResult(findMatchingMovement(pendingSend, history) ? 'found' : 'not-found');
            setBusy(false);
          }}
        >
          {busy ? t.common.syncing : t.send.reconcile}
        </Button>
        {result !== null && (
          <Button
            variant="ghost"
            onClick={() => {
              clearPendingSend();
              refreshPendingSend();
              setResult(null);
            }}
          >
            {t.send.acknowledge}
          </Button>
        )}
      </div>
    </Notice>
  );
}
