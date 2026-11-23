import { useCallback } from "react";
import { useSettings, type Language } from "@/state/settingsStore";
import { IS_MAINNET } from "@/config/network";
import { en } from "./en";
import { ja } from "./ja";

const tables: Record<Language, Record<string, string>> = { ja, en };

export function translate(language: Language, key: string, params?: Record<string, string | number>, mainnet: boolean = IS_MAINNET): string {
  // On Mainnet a "<key>.mainnet" entry, where one exists, replaces the Signet wording.
  const k = mainnet && `${key}.mainnet` in tables.ja ? `${key}.mainnet` : key;
  const template = tables[language][k] ?? tables.ja[k] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useT(): Translate {
  const language = useSettings((s) => s.language);
  return useCallback((key, params) => translate(language, key, params), [language]);
}
