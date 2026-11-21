import { en } from '../../src/i18n/en';
import { ja } from '../../src/i18n/ja';
import { GLOSSARY } from '../../src/lib/education/glossary';
import { LESSONS } from '../../src/lib/education/lessons';

function shape(o: unknown): unknown {
  if (typeof o === 'function') return 'fn';
  if (Array.isArray(o)) return o.length;
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]));
  return typeof o;
}

describe('i18n', () => {
  it('ja and en have identical keys and kinds', () => {
    expect(shape(en)).toEqual(shape(ja));
  });
  it('educational content is bilingual and non-empty', () => {
    for (const g of GLOSSARY) for (const f of [g.term, g.quick, g.deep]) expect(f.ja && f.en).toBeTruthy();
    for (const l of LESSONS) expect(l.title.ja && l.title.en).toBeTruthy();
    expect(GLOSSARY.every((g) => g.sources.every((s) => s.url.startsWith('https://second.tech/docs/')))).toBe(true);
  });
});
