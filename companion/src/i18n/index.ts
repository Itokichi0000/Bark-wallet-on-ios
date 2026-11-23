import { useCallback } from "react";
import { useSettings, type Language } from "@/state/settingsStore";
import { en } from "./en";
import { ja } from "./ja";

const tables: Record<Language, Record<string, string>> = { ja, en };

export function translate(language: Language, key: string, params?: Record<string, string | number>): string {
  const template = tables[language][key] ?? tables.ja[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useT(): Translate {
  const language = useSettings((s) => s.language);
  return useCallback((key, params) => translate(language, key, params), [language]);
}
