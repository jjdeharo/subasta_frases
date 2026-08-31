'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpenCheck, ChevronRight, Gavel, Globe2, HeartHandshake, LogIn, Users } from 'lucide-react';
import { ActivityEditor } from '@/components/activity-editor';
import { HostSession } from '@/components/host-session';
import { ParticipantSession } from '@/components/participant-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { detectLanguage, translate, type TranslationKey } from '@/lib/i18n';
import { readPreparedActivity } from '@/lib/share';
import type { ActivityConfig, Lang, Screen } from '@/lib/types';

export default function SubastaApp() {
  const [lang, setLang] = useState<Lang>('es');
  const [screen, setScreen] = useState<Screen>('home');
  const [initial, setInitial] = useState<ActivityConfig | null>(null);
  const [hostConfig, setHostConfig] = useState<ActivityConfig | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [participant, setParticipant] = useState<{ code: string; name: string } | null>(null);
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) => translate(lang, key, replacements);

  useEffect(() => {
    const detected = detectLanguage(); setLang(detected); document.documentElement.lang = detected;
    const prepared = readPreparedActivity();
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (prepared) { setInitial(prepared); setScreen('editor'); }
    else if (session) { setJoinCode(session.toUpperCase()); setScreen('join'); }
  }, []);

  function changeLanguage(next: Lang) { setLang(next); localStorage.setItem('subasta-lang', next); document.documentElement.lang = next; }
  function openEditor() {
    let draft: ActivityConfig | null = null;
    try { draft = JSON.parse(localStorage.getItem('subasta-draft') || 'null') as ActivityConfig | null; } catch { /* ignored */ }
    setInitial(draft?.version === 1 ? draft : null); setScreen('editor');
  }
  function exitToHome() {
    setScreen('home'); setHostConfig(null); setParticipant(null);
    const url = new URL(window.location.href); url.search = ''; history.replaceState({}, '', url);
  }

  return <main className="min-h-screen">
    <LanguageSwitch lang={lang} onChange={changeLanguage} label={t('language')} />
    {screen === 'home' && <Landing t={t} onCreate={openEditor} onJoin={() => setScreen('join')} />}
    {screen === 'editor' && <ActivityEditor lang={lang} initial={initial} onBack={exitToHome} onStart={(config) => { setHostConfig(config); setScreen('host'); }} />}
    {screen === 'join' && <JoinForm lang={lang} initialCode={joinCode} onBack={exitToHome} onJoin={(code, name) => { setParticipant({ code, name }); setScreen('participant'); }} />}
    {screen === 'host' && hostConfig && <HostSession config={hostConfig} lang={lang} onExit={exitToHome} />}
    {screen === 'participant' && participant && <ParticipantSession code={participant.code} name={participant.name} lang={lang} onExit={exitToHome} />}
  </main>;
}

function LanguageSwitch({ lang, onChange, label }: { lang: Lang; onChange: (lang: Lang) => void; label: string }) {
  return <label className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-white/90 px-3 py-2 text-sm shadow-lg backdrop-blur"><Globe2 className="size-4 text-muted-foreground"/><span className="sr-only">{label}</span><select aria-label={label} className="bg-transparent font-semibold outline-none" value={lang} onChange={(event) => onChange(event.target.value as Lang)}><option value="es">Español</option><option value="ca">Català</option></select></label>;
}

function Landing({ t, onCreate, onJoin }: { t: (key: TranslationKey) => string; onCreate: () => void; onJoin: () => void }) {
  return <div className="px-5 py-5 sm:px-8 lg:px-12"><header className="mx-auto flex max-w-6xl items-center"><div className="flex items-center gap-3 font-bold tracking-tight"><span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Gavel className="size-5"/></span><span>{t('appName')}</span></div></header>
    <section className="mx-auto grid max-w-6xl items-center gap-14 py-14 lg:grid-cols-[1.08fr_.92fr] lg:py-24"><div><p className="mb-5 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"><Users className="size-4"/>{t('tagline')}</p><h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.05em] sm:text-7xl">{t('appName')}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">{t('homeIntro')}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" className="h-12 rounded-xl px-5 text-base" onClick={onCreate}>{t('createActivity')}<ChevronRight/></Button><Button size="lg" variant="outline" className="h-12 rounded-xl px-5 text-base" onClick={onJoin}>{t('joinSession')}</Button></div><p className="mt-5 text-sm text-muted-foreground">{t('privacyLine')}</p></div>
      <div className="relative grid gap-4"><div className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_68%)] opacity-80"/><Card className="rotate-[-1.5deg] border-0 bg-[#fff8e8] shadow-[0_24px_60px_-30px_rgb(73_43_15/.3)] ring-1 ring-amber-900/10"><CardContent className="flex gap-5 p-6"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-400/25 text-amber-800"><BookOpenCheck/></span><div><h2 className="text-xl font-bold">{t('knowledge')}</h2><p className="mt-2 leading-6 text-stone-600">{t('knowledgeDescription')}</p></div></CardContent></Card><Card className="ml-4 rotate-[1.2deg] border-0 bg-[#eefbf4] shadow-[0_24px_60px_-30px_rgb(20_83_45/.28)] ring-1 ring-emerald-900/10 sm:ml-12"><CardContent className="flex gap-5 p-6"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/20 text-emerald-800"><HeartHandshake/></span><div><h2 className="text-xl font-bold">{t('values')}</h2><p className="mt-2 leading-6 text-stone-600">{t('valuesDescription')}</p></div></CardContent></Card></div></section>
  </div>;
}

function JoinForm({ lang, initialCode, onBack, onJoin }: { lang: Lang; initialCode: string; onBack: () => void; onJoin: (code: string, name: string) => void }) {
  const t = (key: TranslationKey) => translate(lang, key);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  return <div className="mx-auto max-w-lg px-5 py-6"><Button variant="ghost" onClick={onBack}><ArrowLeft/>{t('back')}</Button><Card className="mt-14 shadow-xl"><CardContent className="p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><LogIn/></span><h1 className="mt-5 text-3xl font-black">{t('joinTitle')}</h1><form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); if (code.trim().length === 6) onJoin(code.trim().toUpperCase(), name.trim()); }}><label className="block"><span className="mb-1.5 block text-sm font-semibold">{t('sessionCode')}</span><Input className="h-12 font-mono text-xl font-black uppercase tracking-[.15em]" maxLength={6} autoCapitalize="characters" value={code} placeholder={t('codePlaceholder')} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}/></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">{t('participantName')}</span><Input className="h-12" maxLength={40} value={name} placeholder={t('participantNamePlaceholder')} onChange={(event) => setName(event.target.value)}/></label><Button size="lg" className="h-12 w-full" disabled={code.length !== 6}>{t('enter')}<ChevronRight/></Button></form></CardContent></Card></div>;
}
