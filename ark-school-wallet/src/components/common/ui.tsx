import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import { formatSats } from '../../lib/wallet/sats';
import { cx, shortId } from './util';


type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-accent text-accent-fg hover:brightness-105 disabled:opacity-50',
    secondary: 'bg-surface border border-line text-fg hover:bg-surface-2 disabled:opacity-50',
    ghost: 'text-fg hover:bg-surface-2 disabled:opacity-50',
    danger: 'bg-danger text-white hover:brightness-110 disabled:opacity-50',
  };
  return (
    <button
      type="button"
      {...rest}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed', styles[variant], className)}
    />
  );
}

export function Card({ children, className, as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  return (
    <As {...rest} className={cx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {children}
    </As>
  );
}

type Tone = 'info' | 'warn' | 'danger' | 'ok' | 'demo';
const TONE_ICON: Record<Tone, string> = { info: 'ℹ', warn: '⚠', danger: '⛔', ok: '✓', demo: '◇' };
const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-info-soft text-info border-info/30',
  warn: 'bg-warn-soft text-warn border-warn/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  ok: 'bg-ok-soft text-ok border-ok/30',
  demo: 'bg-demo-soft text-demo border-demo/30',
};

/** Warnings always carry an icon and text, never color alone (spec 4). */
export function Notice({ tone = 'info', title, children, role }: { tone?: Tone; title?: ReactNode; children?: ReactNode; role?: 'alert' | 'status' }) {
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : undefined)} className={cx('flex gap-3 rounded-xl border p-3 text-sm', TONE_CLASS[tone])}>
      <span aria-hidden className="mt-0.5 shrink-0 font-bold">
        {TONE_ICON[tone]}
      </span>
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-fg/90">{children}</div>}
      </div>
    </div>
  );
}

export function Amount({ sats, className, unit = true }: { sats: number | undefined; className?: string; unit?: boolean }) {
  const t = useT();
  if (sats === undefined) return <span className={cx('text-muted', className)}>{t.common.unavailable}</span>;
  return (
    <span className={cx('tabular', className)}>
      {formatSats(sats, t.locale)}
      {unit && <span className="ml-1 text-[0.8em] font-normal text-muted">sats</span>}
    </span>
  );
}


export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-surface-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      aria-label={label ? `${t.common.copy}: ${label}` : t.common.copy}
    >
      <span aria-live="polite">{done ? t.common.copied : t.common.copy}</span>
    </button>
  );
}

export function IdWithCopy({ id, label }: { id: string; label?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <code className="truncate font-mono text-xs" title={id}>
        {shortId(id)}
      </code>
      <CopyButton value={id} label={label} />
    </span>
  );
}

export function Field({ label, children, hint, error, id }: { label: ReactNode; children: ReactNode; hint?: ReactNode; error?: ReactNode; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-muted focus:border-accent focus:outline-none';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-xl"
    >
      {open && (
        <div className="space-y-4 p-5">
          <h2 id="modal-title" className="text-lg font-bold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange, label }: { tabs: Array<{ key: K; label: ReactNode; sub?: ReactNode }>; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          id={`tab-${tab.key}`}
          aria-selected={value === tab.key}
          aria-controls={`panel-${tab.key}`}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cx('min-h-11 min-w-0 whitespace-nowrap rounded-lg px-1 py-1.5 text-[13px] font-semibold transition sm:px-3 sm:text-sm', value === tab.key ? 'bg-surface shadow-sm' : 'text-muted hover:text-fg')}
        >
          {tab.label}
          {tab.sub && <span className="hidden text-[11px] font-normal text-muted sm:block">{tab.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function KV({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 text-sm last:border-0">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={cx('min-w-0 text-right', mono && 'font-mono text-xs break-all')}>{v}</dd>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
