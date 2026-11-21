import { en } from './en';
import { ja, type Dict } from './ja';

export type Lang = 'ja' | 'en';
export const dictionaries: Record<Lang, Dict> = { ja, en };

/** A bilingual string for longer educational content. */
export interface L {
  ja: string;
  en: string;
}

export function pick(l: L, lang: Lang): string {
  return l[lang];
}
