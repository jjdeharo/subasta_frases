import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { ActivityConfig } from './types';

export function createPreparedUrl(config: ActivityConfig, lang: string) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('activity', compressToEncodedURIComponent(JSON.stringify(config)));
  url.searchParams.set('lang', lang);
  return url.toString();
}

export function readPreparedActivity(): ActivityConfig | null {
  try {
    const packed = new URLSearchParams(window.location.search).get('activity');
    if (!packed) return null;
    const raw = decompressFromEncodedURIComponent(packed);
    const parsed = JSON.parse(raw) as ActivityConfig;
    return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export function sessionUrl(code: string, lang: string) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('session', code);
  url.searchParams.set('lang', lang);
  return url.toString();
}
