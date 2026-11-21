import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Field, KV, Modal, Notice, PageTitle, inputClass } from '../components/common/ui';
import { shortId } from '../components/common/util';
import { PendingSendNotice } from '../components/wallet/PendingSendNotice';
import { SnapshotDiffView } from '../components/xray/SnapshotDiff';
import { errorMessage } from '../lib/security/redact';
import { BusyError } from '../lib/wallet/reconcile';
import { formatSats, parseSatsInput } from '../lib/wallet/sats';
import type { AddressCheck, FeeEstimateView, OperationResult } from '../lib/wallet/types';
import { useApp } from '../state/store';

type Phase = 'form' | 'confirm' | 'sending' | 'done';

export function Send() {
  const t = useT();
  const { port, mode, demo, snapshot, pendingSend, diff, history, recordDiff, sync, reload, refreshPendingSend, mark } = useApp();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [amtErr, setAmtErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [estimate, setEstimate] = useState<FeeEstimateView | null>(null);
  const [estimateErr, setEstimateErr] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const addressError = (c: AddressCheck): string | null => {
    if (c.ok) return null;
    if (mode === 'demo' && c.reason === 'invalid') return t.send.errors.demoOnly;
    return t.send.errors[c.reason];
  };

  const parsed = parseSatsInput(amount);
  const sats = parsed.ok ? parsed.sats : 0;

  const review = async () => {
    if (!port) return;
    const check = await port.validateArkAddress(address);
    const aErr = addressError(check);
    setAddrErr(aErr);
    let mErr: string | null = null;
    if (!parsed.ok) {
      mErr = { empty: t.send.errors.amountEmpty, format: t.send.errors.amountFormat, zero: t.send.errors.amountZero, 'too-large': t.send.errors.amountTooLarge }[parsed.reason];
    } else if (snapshot?.balance.spendableSats !== undefined && parsed.sats > snapshot.balance.spendableSats) {
      mErr = t.send.errors.insufficient;
    }
    setAmtErr(mErr);
    if (aErr || mErr) return;
    setEstimate(null);
    setEstimateErr(null);
    setPhase('confirm');
    if (port.estimateSendFee) {
      try {
        setEstimate(await port.estimateSendFee(sats));
      } catch (err) {
        setEstimateErr(errorMessage(err));
      }
    }
  };

  const doSend = async () => {
    if (!port || phase === 'sending') return;
    setPhase('sending');
    const before = await port.getSnapshot();
    let res: OperationResult;
    try {
      res = await port.sendArk({ address, amountSats: sats });
    } catch (err) {
      res = err instanceof BusyError ? { status: 'failed', message: t.send.errors.busy } : { status: 'unknown', message: errorMessage(err) };
    }
    setResult(res);
    refreshPendingSend();
    if (res.status === 'succeeded') {
      const after = mode === 'signet' ? await sync() : (await reload(), useApp.getState().snapshot);
      if (after) recordDiff({ label: 'send', before, after, movementId: res.referenceId });
      setAddress('');
      setAmount('');
    }
    setPhase('done');
  };

  const locked = !!pendingSend;
  const movement = diff?.movementId ? history.find((m) => m.id === diff.movementId) : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle sub={t.send.lead}>{t.send.title}</PageTitle>
      <PendingSendNotice />
      {locked && <Notice tone="warn">{t.send.locked}</Notice>}

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void review();
          }}
        >
          <Field id="send-address" label={t.send.address} error={addrErr}>
            <textarea
              id="send-address"
              rows={2}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!addrErr}
              className={`${inputClass} font-mono text-sm`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          {mode === 'demo' && demo && (
            <Button onClick={() => setAddress(demo.friendAddress())} data-testid="use-friend">
              {t.send.useFriend}
            </Button>
          )}
          <Field id="send-amount" label={t.send.amount} error={amtErr} hint={snapshot ? `${t.dashboard.spendable}: ${formatSats(snapshot.balance.spendableSats, t.locale)} sats` : undefined}>
            <input id="send-amount" inputMode="numeric" autoComplete="off" aria-invalid={!!amtErr} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={locked || !port} data-testid="review-send">
            {t.send.review}
          </Button>
        </form>
      </Card>

      {result && phase === 'done' && (
        <div aria-live="polite">
          {result.status === 'succeeded' && <Notice tone="ok" title={mode === 'demo' ? t.send.successDemo : t.send.success}>#{result.referenceId}</Notice>}
          {result.status === 'failed' && <Notice tone="danger" title={t.send.failed}>{result.message}</Notice>}
          {result.status === 'unknown' && <Notice tone="warn" title={t.send.unknownTitle}>{t.send.unknownBody}</Notice>}
        </div>
      )}

      {diff && diff.label === 'send' && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.send.diffTitle}</h2>
          <SnapshotDiffView diff={diff} movement={movement} />
          <Link to="/xray?tab=coins#diff" onClick={() => mark('visited:diff')} className="inline-block text-sm font-semibold text-accent hover:underline">
            {t.send.openXray}
          </Link>
        </Card>
      )}

      <Modal open={phase === 'confirm' || phase === 'sending'} onClose={() => phase !== 'sending' && setPhase('form')} title={t.send.confirmTitle}>
        <dl>
          <KV k={t.send.network} v={<strong>SIGNET{mode === 'demo' ? ' · DEMO' : ''}</strong>} />
          <KV
            k={t.send.to}
            mono
            v={
              <span>
                {showFull ? address.trim() : shortId(address.trim(), 14, 10)}{' '}
                <button type="button" className="ml-1 text-xs font-semibold text-accent underline" onClick={() => setShowFull((s) => !s)}>
                  {showFull ? t.common.hide : t.send.showFull}
                </button>
              </span>
            }
          />
          <KV k={t.send.amountLabel} v={<strong>{formatSats(sats, t.locale)} sats</strong>} />
          <KV k={t.send.fee} v={estimate ? `${formatSats(estimate.feeSats, t.locale)} sats (${estimate.source === 'demo' ? 'DEMO' : 'SDK'})` : estimateErr ? t.common.unavailable : t.send.estimating} />
          {estimate && <KV k={t.send.total} v={`${formatSats(estimate.grossSats, t.locale)} sats`} />}
        </dl>
        {estimate && estimate.vtxosSpent.length > 0 && (
          <div className="text-xs">
            <p className="font-semibold text-muted">{t.send.vtxosSpent}</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              {estimate.vtxosSpent.map((id) => <li key={id}>{shortId(id)}</li>)}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted">{t.common.testSats}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={phase === 'sending'} onClick={() => setPhase('form')}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" disabled={phase === 'sending'} onClick={() => void doSend()} data-testid="confirm-send">
            {phase === 'sending' ? t.send.sending : t.send.sendNow}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
