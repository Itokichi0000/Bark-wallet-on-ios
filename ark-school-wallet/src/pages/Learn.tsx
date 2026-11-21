import { useState } from 'react';
import { usePick, useT } from '../i18n/useT';
import { Card, PageTitle, inputClass } from '../components/common/ui';
import { GLOSSARY } from '../lib/education/glossary';

export function Learn() {
  const t = useT();
  const pick = usePick();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const items = GLOSSARY.filter((g) => !query || [g.term.ja, g.term.en, g.quick.ja, g.quick.en].some((s) => s.toLowerCase().includes(query)));
  return (
    <div className="space-y-4">
      <PageTitle>{t.learn.title}</PageTitle>
      <label className="block">
        <span className="sr-only">{t.learn.search}</span>
        <input type="search" placeholder={t.learn.search} value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
      </label>
      {items.length === 0 && <p className="text-sm text-muted">{t.learn.none}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((g) => (
          <Card key={g.id} as="article" aria-labelledby={`term-${g.id}`}>
            <h2 id={`term-${g.id}`} className="text-lg font-bold">{pick(g.term)}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-accent">{t.learn.quick}</p>
            <p className="mt-1 text-sm leading-relaxed">{pick(g.quick)}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">{t.learn.deep}</summary>
              <p className="mt-2 leading-relaxed text-muted">{pick(g.deep)}</p>
            </details>
            <p className="mt-3 text-xs text-muted">
              {t.learn.source}:{' '}
              {g.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent hover:underline">{s.label} ↗</a>
                </span>
              ))}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
