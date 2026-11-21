import { useApp } from '../state/store';
import { dictionaries, pick, type L } from '.';

export function useT() {
  const lang = useApp((s) => s.lang);
  return dictionaries[lang];
}

export function useLang() {
  return useApp((s) => s.lang);
}

export function usePick() {
  const lang = useApp((s) => s.lang);
  return (l: L) => pick(l, lang);
}
