import { Link, useParams } from 'react-router';
import { usePick, useT } from '../i18n/useT';
import { Button, Card, PageTitle } from '../components/common/ui';
import { cx } from '../components/common/util';
import { Lesson1, Lesson2, Lesson3, Lesson4, Lesson5, Lesson6 } from '../components/lab/Lessons';
import { LESSONS } from '../lib/education/lessons';
import { useApp } from '../state/store';

const LESSON_COMPONENTS = { 1: Lesson1, 2: Lesson2, 3: Lesson3, 4: Lesson4, 5: Lesson5, 6: Lesson6 } as const;

export function Lab() {
  const t = useT();
  const pick = usePick();
  const { lesson } = useParams();
  const { progress, mark } = useApp();
  const current = LESSONS.find((l) => String(l.id) === lesson) ?? LESSONS[0]!;
  const Comp = LESSON_COMPONENTS[current.id];

  return (
    <div className="space-y-4">
      <div role="note" data-testid="lab-banner" className="rounded-xl border border-demo/40 bg-demo-soft px-3 py-2 text-center text-xs font-bold text-demo">
        ◇ {t.common.demoBanner}
      </div>
      <PageTitle sub={t.lab.lead}>{t.lab.title}</PageTitle>
      <nav aria-label={t.lab.title} className="flex flex-wrap gap-2">
        {LESSONS.map((l) => (
          <Link
            key={l.id}
            to={`/lab/${l.id}`}
            aria-current={l.id === current.id ? 'page' : undefined}
            className={cx('min-h-11 shrink-0 rounded-xl border px-3 py-2 text-sm', l.id === current.id ? 'border-accent bg-accent-soft font-semibold' : 'border-line bg-surface')}
          >
            {progress[`lesson:${l.id}`] && <span aria-hidden className="mr-1 text-ok">✓</span>}
            {l.id}. {pick(l.title)}
          </Link>
        ))}
      </nav>
      <Card className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent">{t.lab.lesson(current.id)}</p>
          <h2 className="text-xl font-bold">{pick(current.title)}</h2>
          <p className="text-sm text-muted">{pick(current.summary)}</p>
        </div>
        <Comp />
        <Button variant={progress[`lesson:${current.id}`] ? 'ghost' : 'secondary'} onClick={() => mark(`lesson:${current.id}`)}>
          {progress[`lesson:${current.id}`] ? '✓ ' : ''}
          {t.lab.done}
        </Button>
      </Card>
    </div>
  );
}
