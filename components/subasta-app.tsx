'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpenCheck, ChevronRight, Gavel, Globe2, HeartHandshake, LogIn, Monitor, Moon, Sun, Tags, Users } from 'lucide-react';
import { ActivityEditor } from '@/components/activity-editor';
import { HostSession } from '@/components/host-session';
import { ParticipantSession } from '@/components/participant-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { detectLanguage, languages, translate, type TranslationKey } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/version';
import { readPreparedActivity } from '@/lib/share';
import { normalizeConfig, type ActivityConfig, type Lang, type Screen } from '@/lib/types';

type ThemePreference = 'system' | 'light' | 'dark';

export default function SubastaApp() {
  const [lang, setLang] = useState<Lang>('es');
  const [screen, setScreen] = useState<Screen>('home');
  const [initial, setInitial] = useState<ActivityConfig | null>(null);
  const [hostConfig, setHostConfig] = useState<ActivityConfig | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [participant, setParticipant] = useState<{ code: string; name: string } | null>(null);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) => translate(lang, key, replacements);

  useEffect(() => {
    const detected = detectLanguage(); setLang(detected); document.documentElement.lang = detected; document.title = translate(detected, 'appName');
    const prepared = readPreparedActivity();
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (prepared) { setInitial(prepared); setScreen('editor'); }
    else if (session) { setJoinCode(session.toUpperCase()); setScreen('join'); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('subasta-theme');
    if (saved === 'system' || saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  function changeLanguage(next: Lang) { setLang(next); localStorage.setItem('subasta-lang', next); document.documentElement.lang = next; document.title = translate(next, 'appName'); }
  function changeTheme(next: ThemePreference) { setTheme(next); localStorage.setItem('subasta-theme', next); }
  function openEditor() {
    let draft: ActivityConfig | null = null;
    try { draft = JSON.parse(localStorage.getItem('subasta-draft') || 'null') as ActivityConfig | null; } catch { /* ignored */ }
    setInitial(draft?.version === 1 ? normalizeConfig(draft) : null); setScreen('editor');
  }
  function exitToHome() {
    setScreen('home'); setHostConfig(null); setParticipant(null);
    const url = new URL(window.location.href); url.search = ''; history.replaceState({}, '', url);
  }

  return <main className="min-h-screen">
    <AppearanceControls lang={lang} theme={theme} onLanguageChange={changeLanguage} onThemeChange={changeTheme} t={t} />
    {screen === 'home' && <Landing t={t} onCreate={openEditor} onJoin={() => setScreen('join')} />}
    {screen === 'editor' && <ActivityEditor lang={lang} initial={initial} onBack={exitToHome} onStart={(config) => { setHostConfig(config); setScreen('host'); }} />}
    {screen === 'join' && <JoinForm lang={lang} initialCode={joinCode} onBack={exitToHome} onJoin={(code, name) => { setParticipant({ code, name }); setScreen('participant'); }} />}
    {screen === 'host' && hostConfig && <HostSession config={hostConfig} lang={lang} onExit={exitToHome} />}
    {screen === 'participant' && participant && <ParticipantSession code={participant.code} name={participant.name} lang={lang} onExit={exitToHome} />}
    <Footer t={t} />
  </main>;
}

function AppearanceControls({ lang, theme, onLanguageChange, onThemeChange, t }: { lang: Lang; theme: ThemePreference; onLanguageChange: (lang: Lang) => void; onThemeChange: (theme: ThemePreference) => void; t: (key: TranslationKey) => string }) {
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return <div className="fixed bottom-4 right-4 z-40 flex flex-wrap items-center justify-end gap-1 rounded-2xl border bg-white/90 p-1.5 text-sm shadow-lg backdrop-blur">
    <label className="flex items-center gap-2 rounded-xl px-2 py-1.5" title={t('language')}><Globe2 className="size-4 text-muted-foreground"/><span className="sr-only">{t('language')}</span><select aria-label={t('language')} className="bg-transparent font-semibold outline-none" value={lang} onChange={(event) => onLanguageChange(event.target.value as Lang)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <span className="h-6 w-px bg-border" />
    <label className="flex items-center gap-2 rounded-xl px-2 py-1.5" title={t('appearance')}><ThemeIcon className="size-4 text-muted-foreground"/><span className="sr-only">{t('appearance')}</span><select aria-label={t('appearance')} className="bg-transparent font-semibold outline-none" value={theme} onChange={(event) => onThemeChange(event.target.value as ThemePreference)}><option value="system">{t('themeSystem')}</option><option value="light">{t('themeLight')}</option><option value="dark">{t('themeDark')}</option></select></label>
  </div>;
}

function Footer({ t }: { t: (key: TranslationKey) => string }) {
  return <footer className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 text-center text-xs leading-6 text-muted-foreground sm:px-8">
    <span>© 2026 </span><a href="https://bilateria.org" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4 hover:text-foreground">Juan José de Haro</a>
    <span aria-hidden="true"> · </span>
    <span>{t('footerCode')}:</span>{' '}<a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer license" className="font-semibold underline underline-offset-4 hover:text-foreground">AGPL v3</a>
    <span aria-hidden="true"> · </span>
    <span>{t('footerContent')}:</span>{' '}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license" className="font-semibold underline underline-offset-4 hover:text-foreground">CC BY-SA 4.0</a>
    <span aria-hidden="true"> · </span>
    <span>v{APP_VERSION}</span>
  </footer>;
}

function Landing({ t, onCreate, onJoin }: { t: (key: TranslationKey) => string; onCreate: () => void; onJoin: () => void }) {
  return <div className="px-5 py-5 sm:px-8 lg:px-12"><header className="mx-auto flex max-w-6xl items-center"><div className="flex items-center gap-3 font-bold tracking-tight"><span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Gavel className="size-5"/></span><span>{t('appName')}</span></div></header>
    <section className="mx-auto grid max-w-6xl items-center gap-14 py-14 lg:grid-cols-[1.08fr_.92fr] lg:py-24"><div><p className="mb-5 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"><Users className="size-4"/>{t('tagline')}</p><h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.05em] sm:text-7xl">{t('appName')}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">{t('homeIntro')}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" className="h-12 rounded-xl px-5 text-base" title={t('createActivityHelp')} onClick={onCreate}>{t('createActivity')}<ChevronRight/></Button><Button size="lg" variant="outline" className="h-12 rounded-xl px-5 text-base" title={t('joinSessionHelp')} onClick={onJoin}>{t('joinSession')}</Button></div><p className="mt-5 text-sm text-muted-foreground">{t('privacyLine')}</p></div>
      <div className="relative grid gap-4"><div className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_68%)] opacity-80"/><Card className="rotate-[-1.5deg] border-0 bg-[#fff8e8] shadow-[0_24px_60px_-30px_rgb(73_43_15/.3)] ring-1 ring-amber-900/10"><CardContent className="flex gap-5 p-6"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-400/25 text-amber-800"><BookOpenCheck/></span><div><h2 className="text-xl font-bold">{t('knowledge')}</h2><p className="mt-2 leading-6 text-stone-600">{t('knowledgeDescription')}</p></div></CardContent></Card><Card className="ml-4 rotate-[1.2deg] border-0 bg-[#eefbf4] shadow-[0_24px_60px_-30px_rgb(20_83_45/.28)] ring-1 ring-emerald-900/10 sm:ml-12"><CardContent className="flex gap-5 p-6"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/20 text-emerald-800"><HeartHandshake/></span><div><h2 className="text-xl font-bold">{t('values')}</h2><p className="mt-2 leading-6 text-stone-600">{t('valuesDescription')}</p></div></CardContent></Card><Card className="rotate-[-.5deg] border-0 bg-[#f3f0ff] shadow-[0_24px_60px_-30px_rgb(76_29_149/.25)] ring-1 ring-violet-900/10"><CardContent className="flex gap-5 p-6"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-400/20 text-violet-800"><Tags/></span><div><h2 className="text-xl font-bold">{t('roles')}</h2><p className="mt-2 leading-6 text-stone-600">{t('rolesDescription')}</p></div></CardContent></Card></div></section>
  </div>;
}

function JoinForm({ lang, initialCode, onBack, onJoin }: { lang: Lang; initialCode: string; onBack: () => void; onJoin: (code: string, name: string) => void }) {
  const t = (key: TranslationKey) => translate(lang, key);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  return <div className="mx-auto max-w-lg px-5 py-6"><Button variant="ghost" title={t('backHomeHelp')} onClick={onBack}><ArrowLeft/>{t('back')}</Button><Card className="mt-14 shadow-xl"><CardContent className="p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><LogIn/></span><h1 className="mt-5 text-3xl font-black">{t('joinTitle')}</h1><form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); if (code.trim().length === 6) onJoin(code.trim().toUpperCase(), name.trim()); }}><label className="block"><span className="mb-1.5 block text-sm font-semibold">{t('sessionCode')}</span><Input className="h-12 font-mono text-xl font-black uppercase tracking-[.15em]" maxLength={6} autoCapitalize="characters" value={code} placeholder={t('codePlaceholder')} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}/></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">{t('participantName')}</span><Input className="h-12" maxLength={40} value={name} placeholder={t('participantNamePlaceholder')} onChange={(event) => setName(event.target.value)}/></label><Button type="submit" size="lg" className="h-12 w-full" title={t('enterSessionHelp')} disabled={code.length !== 6}>{t('enter')}<ChevronRight/></Button></form></CardContent></Card></div>;
}
