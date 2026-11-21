import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../i18n/useT';
import { Card, Field, Notice, PageTitle, inputClass } from '../components/common/ui';
import { validateMnemonic } from '../lib/bark/adapter';
import { listRecords } from '../lib/security/vault';
import { errorMessage } from '../lib/security/redact';
import { classifyOpenError, createWallet } from '../lib/session';
import { PassphraseFields } from './CreateWallet';

export function RestoreWallet() {
  const t = useT();
  const nav = useNavigate();
  const [phrase, setPhrase] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [recovery, setRecovery] = useState<{ status: string; complete?: boolean } | null>(null);

  useEffect(() => {
    listRecords().then((r) => setHasExisting(r.length > 0)).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle sub={t.restore.lead}>{t.restore.title}</PageTitle>
      <Notice tone="warn">{t.restore.seedLimit}</Notice>
      {hasExisting && <Notice tone="info">{t.restore.existing}</Notice>}
      <Card className="space-y-4">
        <Field id="phrase" label={t.restore.phrase} error={invalid ? t.restore.invalid : undefined}>
          <textarea
            id="phrase"
            rows={3}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`${inputClass} font-mono`}
            value={phrase}
            onChange={(e) => {
              setPhrase(e.target.value);
              setInvalid(false);
            }}
          />
        </Field>
        <PassphraseFields
          busy={busy}
          submitLabel={busy ? t.restore.restoring : t.restore.title}
          onSubmit={async (pass) => {
            const normalized = phrase.trim().toLowerCase().split(/\s+/).join(' ');
            setBusy(true);
            setError(null);
            try {
              if (!(await validateMnemonic(normalized))) {
                setInvalid(true);
                return;
              }
              const res = await createWallet(normalized, pass, 'restored');
              setPhrase('');
              setRecovery(res.recovery ?? null);
              if (!res.recovery || res.recovery.complete !== false) nav('/');
            } catch (err) {
              const kind = classifyOpenError(err);
              setError(`${kind === 'generic' || kind === 'bad-passphrase' ? t.errors.generic : t.errors[kind]} (${errorMessage(err)})`);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      {recovery && (
        <Notice tone={recovery.complete === false ? 'warn' : 'info'} title={t.restore.recovery(recovery.status)}>
          {recovery.complete === false && t.restore.incomplete}
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
