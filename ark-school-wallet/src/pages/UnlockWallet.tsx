import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Field, Notice, PageTitle, inputClass } from '../components/common/ui';
import { getRecord, type VaultRecord } from '../lib/security/vault';
import { errorMessage } from '../lib/security/redact';
import { classifyOpenError, unlockWallet } from '../lib/session';

export function UnlockWallet() {
  const t = useT();
  const nav = useNavigate();
  const { id } = useParams();
  const [record, setRecord] = useState<VaultRecord | null | undefined>(undefined);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) getRecord(id).then((r) => setRecord(r ?? null)).catch(() => setRecord(null));
  }, [id]);

  if (record === null) return <Notice tone="warn">{t.vtxo.notFound}</Notice>;
  if (!record) return <p className="text-muted">{t.common.loading}</p>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageTitle sub={t.unlock.created(new Date(record.createdAt).toLocaleString(t.locale))}>{t.unlock.title}</PageTitle>
      <Card>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await unlockWallet(record, pass);
              setPass('');
              nav('/');
            } catch (err) {
              const kind = classifyOpenError(err);
              setError(kind === 'bad-passphrase' ? t.unlock.wrong : `${kind === 'generic' ? t.errors.generic : t.errors[kind]} (${errorMessage(err)})`);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field id="unlock-pass" label={t.unlock.pass} error={error}>
            <input id="unlock-pass" type="password" autoComplete="current-password" className={inputClass} value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={busy || pass.length === 0}>
            {busy ? t.unlock.opening : t.unlock.open}
          </Button>
        </form>
      </Card>
    </div>
  );
}
