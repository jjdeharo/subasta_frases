import es from '@/locales/es.json';
import ca from '@/locales/ca.json';
import gl from '@/locales/gl.json';
import eu from '@/locales/eu.json';
import en from '@/locales/en.json';
import de from '@/locales/de.json';
import type { Lang } from './types';

const dictionaries = { es, ca, gl, eu, en, de } as const;
export type TranslationKey = keyof typeof es;

export const languages: { code: Lang; name: string }[] = [
  { code: 'es', name: 'Español' },
  { code: 'ca', name: 'Català' },
  { code: 'gl', name: 'Galego' },
  { code: 'eu', name: 'Euskara' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
];

function isLang(value: string | null): value is Lang {
  return value !== null && languages.some((item) => item.code === value);
}

export function translate(lang: Lang, key: TranslationKey, replacements?: Record<string, string | number>) {
  let value: string = dictionaries[lang][key] ?? dictionaries.es[key] ?? key;
  if (replacements) Object.entries(replacements).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); });
  return value;
}

export function detectLanguage(): Lang {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (isLang(requested)) return requested;
  const stored = localStorage.getItem('subasta-lang');
  if (isLang(stored)) return stored;
  const preferred = navigator.languages
    .map((item) => item.toLowerCase().split('-')[0])
    .find((item) => isLang(item));
  return isLang(preferred ?? null) ? (preferred as Lang) : 'es';
}
