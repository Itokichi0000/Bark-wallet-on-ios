import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useT } from '../../i18n/useT';
import { useApp } from '../../state/store';
import { ModeBadge, NetworkBadge } from './Badges';
import { cx } from './util';

function timeAgo(iso: string | null, locale: string, never: string): string {
  if (!iso) return never;
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));
}

export function Header() {
  const t = useT();
  const { mode, lang, setLang, connection, lastSyncAt, syncing } = useApp();
  const conn =
    mode === 'none' ? t.header.noWallet : mode === 'demo' ? `${t.common.demo}` : connection === 'connected' ? t.header.connected : connection === 'disconnected' ? t.header.disconnected : '…';
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <img src="./favicon.svg" alt="" width={24} height={24} />
          <span>{t.common.appName}</span>
        </Link>
        <NetworkBadge />
        <ModeBadge mode={mode} />
        <span className="hidden text-[11px] text-muted lg:inline">{t.common.independent}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted sm:inline" aria-live="polite">
            {t.header.server}: <span className={cx(connection === 'disconnected' && mode === 'signet' && 'font-semibold text-danger')}>{connection === 'disconnected' && mode === 'signet' ? '⚠ ' : ''}{conn}</span>
            {mode !== 'none' && (
              <>
                {' · '}
                {t.common.lastSync}: {syncing ? t.common.syncing : timeAgo(lastSyncAt, t.locale, t.common.never)}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
            className="min-h-9 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-surface-2"
            aria-label={lang === 'ja' ? 'Switch to English' : '日本語に切り替え'}
          >
            {t.header.language}
          </button>
          <Link to="/learn" className="hidden min-h-9 items-center rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-surface-2 sm:inline-flex" aria-label={t.header.guide}>
            ?
          </Link>
          <Link to="/settings#backup" className="hidden min-h-9 items-center rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-surface-2 sm:inline-flex">
            {t.header.backup}
          </Link>
        </div>
        <p className="w-full text-[11px] text-muted sm:hidden" aria-live="polite" data-testid="mobile-status">
          {t.header.server}: {connection === 'disconnected' && mode === 'signet' ? '⚠ ' : ''}{conn}
          {mode !== 'none' && <> · {t.common.lastSync}: {syncing ? t.common.syncing : timeAgo(lastSyncAt, t.locale, t.common.never)}</>}
        </p>
      </div>
    </header>
  );
}

const NAV = [
  { to: '/', key: 'wallet', icon: '◎' },
  { to: '/xray', key: 'xray', icon: '⌬' },
  { to: '/lab', key: 'lab', icon: '⚗' },
  { to: '/learn', key: 'learn', icon: '☰' },
  { to: '/settings', key: 'settings', icon: '⚙' },
] as const;

export function SideNav() {
  const t = useT();
  return (
    <nav aria-label="Main" className="sticky top-16 hidden h-fit w-48 shrink-0 space-y-1 md:block">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) => cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold', isActive ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}
        >
          <span aria-hidden className="w-5 text-center text-accent">
            {n.icon}
          </span>
          {t.nav[n.key]}
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomTabs() {
  const t = useT();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-accent' : 'text-muted')}>
            <span aria-hidden className="text-base">
              {n.icon}
            </span>
            {t.nav[n.key]}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function panelKey(path: string): keyof ReturnType<typeof useT>['panel'] {
  if (path.startsWith('/receive')) return 'receive';
  if (path.startsWith('/send')) return 'send';
  if (path.startsWith('/xray')) return 'xray';
  if (path.startsWith('/lab')) return 'lab';
  if (path.startsWith('/learn')) return 'learn';
  if (path.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export function LearnPanel() {
  const t = useT();
  const { pathname } = useLocation();
  const key = panelKey(pathname);
  const text = t.panel[key];
  return (
    <aside aria-label={t.panel.title} className="sticky top-16 hidden h-fit w-72 shrink-0 space-y-3 xl:block">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">{t.panel.title}</p>
        <p className="mt-2 text-sm leading-relaxed">{typeof text === 'string' ? text : ''}</p>
        <Link to="/learn" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          {t.common.learnMore} →
        </Link>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-muted">{t.common.independent}</p>
    </aside>
  );
}

export function DemoBanner() {
  const t = useT();
  const mode = useApp((s) => s.mode);
  if (mode !== 'demo') return null;
  return (
    <div role="note" data-testid="demo-banner" className="border-b border-demo/30 bg-demo-soft px-4 py-1.5 text-center text-xs font-semibold text-demo">
      ◇ {t.common.demoBanner}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <Header />
      <DemoBanner />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-24 pt-5 md:pb-10">
        <SideNav />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
        <LearnPanel />
      </div>
      <BottomTabs />
    </div>
  );
}
