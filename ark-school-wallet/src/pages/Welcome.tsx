import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Notice } from '../components/common/ui';
import { canCreateRealWallet, checkEnvironment, type EnvironmentCheck } from '../lib/security/environment';
import { listRecords, type VaultRecord } from '../lib/security/vault';
import { startDemo } from '../lib/session';

export function Welcome() {
  const t = useT();
  const nav = useNavigate();
  const [env, setEnv] = useState<EnvironmentCheck | null>(null);
  const [records, setRecords] = useState<VaultRecord[]>([]);

  useEffect(() => {
    void checkEnvironment().then(setEnv);
    listRecords().then(setRecords).catch(() => setRecords([]));
  }, []);

  const realOk = env ? canCreateRealWallet(env) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2 pt-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.onboarding.title}</h1>
        <p className="text-muted">{t.onboarding.lead}</p>
        <p className="text-xs text-muted">{t.common.independent}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 border-demo/40">
          <p className="text-xs font-bold tracking-widest text-demo">◇ DEMO</p>
          <h2 className="text-lg font-bold">{t.onboarding.demoTitle}</h2>
          <p className="flex-1 text-sm text-muted">{t.onboarding.demoDesc}</p>
          <Button
            variant="primary"
            data-testid="start-demo"
            onClick={async () => {
              await startDemo('empty');
              nav('/');
            }}
          >
            {t.onboarding.demoTitle}
          </Button>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-widest text-ok">◆ LIVE · SIGNET</p>
          <h2 className="text-lg font-bold">{t.onboarding.createTitle}</h2>
          <p className="flex-1 text-sm text-muted">{t.onboarding.createDesc}</p>
          <Button disabled={!realOk} onClick={() => nav('/wallet/create')} data-testid="create-signet">
            {t.onboarding.createTitle}
          </Button>
          <Button variant="ghost" disabled={!realOk} onClick={() => nav('/wallet/restore')}>
            {t.onboarding.restoreTitle}
          </Button>
        </Card>
      </div>

      {env && !realOk && (
        <Notice tone="warn" title={t.onboarding.envBlocked}>
          <ul className="mt-1 space-y-0.5">
            {(Object.keys(t.onboarding.envItems) as Array<keyof EnvironmentCheck>).map((k) => (
              <li key={k}>
                {env[k] ? '✓' : '✗'} {t.onboarding.envItems[k]}
              </li>
            ))}
          </ul>
          <p className="mt-1">{t.onboarding.envFallback}</p>
        </Notice>
      )}

      {records.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">{t.onboarding.unlockTitle}</h2>
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <code className="font-mono text-xs">{r.id}</code>
                  <span className="ml-2 text-muted">{t.unlock.created(new Date(r.createdAt).toLocaleDateString(t.locale))}</span>
                </span>
                <Link to={`/wallet/unlock/${r.id}`} className="font-semibold text-accent hover:underline">
                  {t.unlock.open} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
