import es from '@/locales/es.json';
import ca from '@/locales/ca.json';
import type { Lang } from './types';

const dictionaries = { es, ca } as const;
export type TranslationKey = keyof typeof es;

export function translate(lang: Lang, key: TranslationKey, replacements?: Record<string, string | number>) {
  let value: string = dictionaries[lang][key] ?? dictionaries.es[key] ?? key;
  if (replacements) Object.entries(replacements).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); });
  return value;
}

export function detectLanguage(): Lang {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('lang');
  const stored = localStorage.getItem('subasta-lang');
  if (requested === 'ca' || requested === 'es') return requested;
  if (stored === 'ca' || stored === 'es') return stored;
  return navigator.languages.some((item) => item.toLowerCase().startsWith('ca')) ? 'ca' : 'es';
}
