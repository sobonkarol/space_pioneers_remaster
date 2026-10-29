import { en } from './en';
import { pl } from './pl';

export type Language = 'pl' | 'en';

const dictionaries = { pl, en };
const LANG_KEY = 'sp.lang';

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'pl' || stored === 'en') return stored;
  } catch {
    // ignorujemy brak localStorage
  }
  return 'pl';
}

let current: Language = initialLanguage();
const listeners = new Set<() => void>();

export function language(): Language {
  return current;
}

export function setLanguage(lang: string): void {
  const next: Language = lang === 'en' ? 'en' : 'pl';
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // ignorujemy
  }
  listeners.forEach((l) => l());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(section: 'ui' | 'names' | 'descriptions', key: string): string | undefined {
  return dictionaries[current][section][key] ?? dictionaries.pl[section][key];
}

/** Tekst interfejsu z podstawieniem parametrow {nazwa}. */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = lookup('ui', key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

/** Nazwa budynku, badania lub jednostki. */
export function nameOf(key: string): string {
  return lookup('names', key) ?? key;
}

export function describe(key: string): string {
  return lookup('descriptions', key) ?? '';
}
