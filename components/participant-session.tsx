'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataConnection, Peer } from 'peerjs';
import { ArrowLeft, CheckCircle2, Clock3, Gavel, LoaderCircle, Send, Trophy, Users, WalletCards, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { translate, type TranslationKey } from '@/lib/i18n';
import { peerOptions } from '@/lib/peer-config';
import { uid, type ClientSnapshot, type Lang, type RoleDefinition } from '@/lib/types';

interface Props { code: string; name: string; lang: Lang; onExit: () => void }

export function ParticipantSession({ code, name, lang, onExit }: Props) {
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) => translate(lang, key, replacements);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const [token] = useState(() => {
    if (typeof window === 'undefined') return '';
    const storageKey = `subasta-participant-${code}`;
    const value = localStorage.getItem(storageKey) || uid(); localStorage.setItem(storageKey, value); return value;
  });

  useEffect(() => {
    let cancelled = false;
    const connect = async () => {
      const { Peer: PeerClass } = await import('peerjs');
      if (cancelled) return;
      const peer = new PeerClass(`bidder-${uid()}`, peerOptions); peerRef.current = peer;
      peer.on('open', () => {
        const conn = peer.connect(code.toUpperCase(), { reliable: true }); connRef.current = conn;
        conn.on('open', () => { setStatus('connected'); void conn.send({ type: 'hello', token, name }); });
        conn.on('data', (raw) => {
          const message = raw as { type?: string; payload?: ClientSnapshot };
          if (message.type === 'state' && message.payload) setSnapshot((current) => !current || message.payload!.revision >= current.revision ? message.payload! : current);
        });
        conn.on('close', () => setStatus('error'));
        conn.on('error', () => setStatus('error'));
      });
      peer.on('error', () => setStatus('error'));
    };
    void connect();
    return () => { cancelled = true; connRef.current?.close(); peerRef.current?.destroy(); };
  }, [code, name]);

  const me = snapshot?.participants.find((participant) => participant.id === token);
  const auction = snapshot?.knowledge;
  const item = auction ? snapshot?.config.items[auction.index] : null;
  const used = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  const rankings = useMemo(() => [...(snapshot?.participants ?? [])].sort((a, b) => b.score - a.score || b.balance - a.balance), [snapshot]);
  const myRole = snapshot?.config.roles.find((role) => role.id === me?.roleId);
  const biddingTimeUp = Boolean(auction && (snapshot?.config.bidSeconds ?? 0) > 0 && auction.secondsLeft === 0);

  function bid(extra = 0) {
    if (!snapshot || !auction || !me) return;
    const base = auction.currentBid === 0 ? snapshot.config.minBid : auction.currentBid + snapshot.config.increment;
    const amount = base + extra;
    if (biddingTimeUp) { flash(t('biddingClosed')); return; }
    if (amount > me.balance) { flash(t('insufficientBalance')); return; }
    void connRef.current?.send({ type: 'bid', amount }); flash(t('bidAccepted'));
  }
  function updateAllocation(id: string, raw: number) {
    const value = Math.max(0, Math.floor(raw || 0));
    const old = allocation[id] || 0; const available = (snapshot?.config.budget ?? 0) - used + old;
    setAllocation((current) => ({ ...current, [id]: Math.min(value, available) })); setSent(false);
  }
  function submitAllocation() { void connRef.current?.send({ type: 'allocation', allocation }); setSent(true); flash(t('allocationSent')); }
  function flash(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 1600); }

  if (status === 'connecting' || (status === 'connected' && !snapshot)) return <Centered><LoaderCircle className="size-12 animate-spin text-primary"/><h1 className="mt-5 text-2xl font-black">{t('connecting')}</h1></Centered>;
  if (status === 'error') return <Centered><WifiOff className="size-12 text-destructive"/><h1 className="mt-5 text-2xl font-black">{t('connectionError')}</h1><Button className="mt-5" title={t('backHomeHelp')} onClick={onExit}>{t('back')}</Button></Centered>;
  if (!snapshot) return null;

  return <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-28 pt-6 sm:px-8 sm:pb-10">
    <header className="mb-7 flex items-center justify-between gap-3"><Button variant="ghost" title={t('exitSessionHelp')} onClick={onExit}><ArrowLeft />{t('back')}</Button>{me && <div className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">{me.name}</div>}</header>
    {feedback && <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background shadow-xl">{feedback}</div>}

    {snapshot.status === 'lobby' && <Centered><Users className="size-14 text-primary"/><h1 className="mt-5 text-3xl font-black">{t('waitingRoom')}</h1>{snapshot.config.mode === 'roles' && myRole && <div className="mt-5 rounded-2xl border bg-white p-5 text-center shadow-sm"><p className="text-sm font-semibold text-muted-foreground">{t('yourRole')}</p><div className="mt-2"><RoleBadge role={myRole}/></div>{myRole.description && <p className="mt-2 max-w-md text-sm text-muted-foreground">{myRole.description}</p>}</div>}<p className="mt-3 text-center text-muted-foreground">{t('waitingForHost')}</p></Centered>}

    {snapshot.status === 'running' && snapshot.config.mode !== 'values' && auction && <>
      {auction.phase === 'planning' ? <div><h1 className="text-3xl font-black">{t('planning')}</h1><p className="mt-2 text-muted-foreground">{t(snapshot.config.mode === 'roles' ? 'rolePlanningHelp' : 'planningHelp')}</p>{snapshot.config.mode === 'roles' && <><Card className="mt-5 border-2" style={{ borderColor: myRole?.color }}><CardContent><p className="text-sm font-semibold text-muted-foreground">{t('yourRole')}</p><RoleBadge role={myRole}/>{myRole?.description && <p className="mt-2 text-sm text-muted-foreground">{myRole.description}</p>}</CardContent></Card><h2 className="mt-6 text-xl font-black">{t('allRoles')}</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{snapshot.config.roles.map((role) => <div key={role.id} className={`rounded-xl border bg-white p-3 ${role.id === myRole?.id ? 'ring-2 ring-primary/30' : ''}`}><RoleBadge role={role}/>{role.description && <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>}</div>)}</div></>}<ol className="mt-6 space-y-3">{snapshot.config.items.map((phrase, index) => <li key={phrase.id} className="flex gap-3 rounded-xl border bg-white p-4 shadow-sm"><span className="font-black text-primary">{index + 1}</span><span>{phrase.text}</span></li>)}</ol></div> : item && <div className="space-y-5">
        <div className="flex items-center justify-between gap-3"><p className="font-bold text-muted-foreground">{t('lotOf', { current: auction.index + 1, total: snapshot.config.items.length })}</p><span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">{t(auction.phase)}</span></div>
        <Card className="min-h-64 justify-center bg-white shadow-[0_24px_70px_-38px_rgb(70_42_20/.35)]"><CardContent className="py-10 text-center"><p className="text-3xl font-black leading-tight tracking-[-.03em] sm:text-5xl">{item.text}</p>{item.category && <span className="mt-5 inline-block rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{item.category}</span>}</CardContent></Card>
        {auction.phase === 'discussion' && <Card><CardContent className="text-center"><Clock3 className="mx-auto size-8 text-primary"/><p className="mt-2 text-xl font-black">{auction.secondsLeft ? t('timeLeft', { seconds: auction.secondsLeft }) : t('timerFinished')}</p><p className="mt-1 text-muted-foreground">{t('discussion')}</p></CardContent></Card>}
        {auction.phase === 'bidding' && <Card><CardContent><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{t('currentBid')}</p><p className="text-4xl font-black">{auction.currentBid || '—'} <span className="text-sm text-muted-foreground">{snapshot.config.currencyName}</span></p><p className="mt-1 font-semibold">{auction.leaderName ? t('leader', { name: auction.leaderName }) : t('noBids')}</p></div><div className="text-right"><p className="text-sm text-muted-foreground">{t('balance')}</p><p className="text-2xl font-black">{me?.balance ?? snapshot.config.budget} <span className="text-xs text-muted-foreground">{snapshot.config.currencyName}</span></p><p className={`mt-1 flex items-center justify-end gap-1.5 text-sm font-bold ${biddingTimeUp ? 'text-destructive' : ''}`}><Clock3 className="size-4"/>{biddingTimeUp ? t('biddingClosed') : t('timeLeft', { seconds: auction.secondsLeft })}</p></div></div><div className="mt-6 grid grid-cols-2 gap-3"><Button size="lg" title={t('placeBidHelp')} disabled={!me || biddingTimeUp || auction.leaderId === me.id} onClick={() => bid()}><Gavel />{t('bid', { amount: auction.currentBid === 0 ? snapshot.config.minBid : auction.currentBid + snapshot.config.increment })}</Button><Button size="lg" variant="outline" aria-label={t('higherBidHelp')} disabled={!me || biddingTimeUp || auction.leaderId === me.id} onClick={() => bid(snapshot.config.increment * 2)}>+ {snapshot.config.increment * 2}</Button></div></CardContent></Card>}
        {auction.phase === 'revealed' && (snapshot.config.mode === 'roles' ? <ParticipantRoleResolution snapshot={snapshot} item={item} t={t}/> : !snapshot.config.revealAnswers ? <Card><CardContent><h2 className="text-2xl font-black">{t('lotClosed')}</h2><p className="mt-3 text-muted-foreground">{t('answerHidden')}</p><p className="mt-4 font-semibold">{auction.leaderName ? `${t('soldTo', { name: auction.leaderName, amount: auction.currentBid })} ${snapshot.config.currencyName}` : t('unsold')}</p></CardContent></Card> : <Card className={item.correct ? 'bg-emerald-50 ring-emerald-700/20' : 'bg-rose-50 ring-rose-700/20'}><CardContent><h2 className={`text-2xl font-black ${item.correct ? 'text-emerald-800' : 'text-rose-800'}`}>{item.correct ? t('answerCorrect') : t('answerIncorrect')}</h2>{item.explanation && <p className="mt-3 text-lg leading-7">{item.explanation}</p>}<p className="mt-4 font-semibold">{auction.leaderName ? `${t('soldTo', { name: auction.leaderName, amount: auction.currentBid })} ${snapshot.config.currencyName}` : t('unsold')}</p></CardContent></Card>)}
      </div>}
    </>}

    {snapshot.status === 'running' && snapshot.config.mode === 'values' && snapshot.values && <div>
      <h1 className="text-3xl font-black">{snapshot.config.title}</h1><p className="mt-2 text-muted-foreground">{snapshot.config.instructions}</p>
      <Card className="mt-6"><CardContent><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{t('unitsUsed', { currency: snapshot.config.currencyName })}</p><p className="text-3xl font-black">{used} / {snapshot.config.budget}</p></div><WalletCards className="size-9 text-primary"/></div><Progress className="mt-3" value={used / snapshot.config.budget * 100}/></CardContent></Card>
      <p className="mt-5 text-sm text-muted-foreground">{t('allocateHelp', { budget: snapshot.config.budget, currency: snapshot.config.currencyName })}</p>
      <div className="mt-4 space-y-3">{snapshot.config.items.map((phrase) => <Card key={phrase.id}><CardContent><div className="flex items-start gap-4"><div className="flex-1"><p className="text-lg font-bold leading-6">{phrase.text}</p>{phrase.category && <p className="mt-1 text-sm text-muted-foreground">{phrase.category}</p>}</div><Input className="h-11 w-24 text-center text-lg font-black" type="number" min={0} max={snapshot.config.budget - used + (allocation[phrase.id] || 0)} value={allocation[phrase.id] || 0} disabled={!snapshot.values?.open} onChange={(event) => updateAllocation(phrase.id, Number(event.target.value))}/></div></CardContent></Card>)}</div>
      <Button size="lg" className="mt-5 w-full" title={t('submitAllocationHelp')} disabled={!snapshot.values.open} onClick={submitAllocation}>{sent ? <CheckCircle2 /> : <Send />}{sent ? t('updateAllocation') : t('submitAllocation')}</Button>
    </div>}

    {snapshot.status === 'finished' && <div><div className="text-center"><Trophy className="mx-auto size-14 text-amber-600"/><h1 className="mt-3 text-4xl font-black">{snapshot.config.mode !== 'values' ? t('rankings') : t('collectiveResult')}</h1>{snapshot.config.mode !== 'values' && <p className="mt-2 text-muted-foreground">{t('auctionedCount', { done: snapshot.knowledge?.lots.length ?? 0, total: snapshot.config.items.length })}</p>}</div>{snapshot.config.mode !== 'values' ? <><Card className="mt-7"><CardContent><ol className="space-y-2">{rankings.map((participant, index) => <li key={participant.id} className="grid grid-cols-[32px_1fr_auto] items-center rounded-xl border bg-white p-3"><strong className="text-primary">{index + 1}</strong><span className="font-semibold">{participant.name}{snapshot.config.mode === 'roles' && <span className="block"><RoleBadge role={snapshot.config.roles.find((role) => role.id === participant.roleId)}/></span>}</span><span className="text-right font-black">{participant.score}</span></li>)}</ol></CardContent></Card>{snapshot.config.mode === 'roles' && <RoleTotals snapshot={snapshot} t={t}/>}<MyPhrases snapshot={snapshot} token={token} t={t}/></> : <ValuesResult snapshot={snapshot} t={t} />}</div>}
  </div>;
}

function MyPhrases({ snapshot, token, t }: { snapshot: ClientSnapshot; token: string; t: (key: TranslationKey, replacements?: Record<string, string | number>) => string }) {
  const mine = (snapshot.knowledge?.lots ?? []).filter((lot) => lot.winnerId === token);
  return <Card className="mt-5"><CardHeader><CardTitle>{t('yourPhrases')}</CardTitle></CardHeader><CardContent>
    {mine.length === 0
      ? <p className="text-muted-foreground">{t('noWonPhrases')}</p>
      : <ul className="space-y-3">{mine.map((lot) => {
          const item = snapshot.config.items.find((entry) => entry.id === lot.itemId);
          const targetRole = snapshot.config.roles.find((role) => role.id === lot.roleId);
          const tone = lot.correct === undefined && lot.matched === undefined ? 'border bg-white' : (lot.correct ?? lot.matched) ? 'border-emerald-700/20 bg-emerald-50' : 'border-rose-700/20 bg-rose-50';
          return <li key={lot.itemId} className={`rounded-xl border p-4 ${tone}`}>
            <p className="font-bold leading-6">{item?.text}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('paidAmount', { amount: lot.amount, currency: snapshot.config.currencyName })}</p>
            {lot.correct !== undefined && <p className={`mt-2 font-bold ${lot.correct ? 'text-emerald-800' : 'text-rose-800'}`}>{lot.correct ? t('answerCorrect') : t('answerIncorrect')}</p>}
            {targetRole && <div className="mt-2 flex items-center gap-2"><span className="text-sm text-muted-foreground">{t('belongsToRole')}</span><RoleBadge role={targetRole}/></div>}
            {item?.explanation && <p className="mt-2 text-sm leading-6">{item.explanation}</p>}
          </li>;
        })}</ul>}
  </CardContent></Card>;
}
function ValuesResult({ snapshot, t }: { snapshot: ClientSnapshot; t: (key: TranslationKey) => string }) {
  const rows = snapshot.config.items.map((item) => ({ ...item, total: snapshot.values?.totals?.[item.id] ?? 0 })).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.map((row) => row.total));
  return <><Card className="mt-7"><CardContent className="space-y-5">{rows.map((row, index) => <div key={row.id}><div className="mb-2 flex gap-3"><strong className="text-primary">{index + 1}</strong><span className="flex-1 font-semibold">{row.text}</span><strong>{row.total} {snapshot.config.currencyName}</strong></div><Progress value={row.total / max * 100}/></div>)}</CardContent></Card>{snapshot.values?.allocations && <Card className="mt-5"><CardHeader><CardTitle>{t('individualBreakdown')}</CardTitle></CardHeader><CardContent className="space-y-4">{Object.entries(snapshot.values.allocations).map(([name, allocation]) => <div key={name} className="rounded-xl border bg-white p-4"><h3 className="font-black">{name}</h3><ul className="mt-2 space-y-1 text-sm">{snapshot.config.items.filter((item) => (allocation[item.id] || 0) > 0).map((item) => <li key={item.id} className="flex gap-3"><span className="flex-1">{item.text}</span><strong>{allocation[item.id]} {snapshot.config.currencyName}</strong></li>)}</ul></div>)}</CardContent></Card>}</>;
}
function RoleBadge({ role }: { role?: RoleDefinition }) { return role ? <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" style={{ color: role.color, backgroundColor: `${role.color}18` }}><span className="size-2 rounded-full" style={{ backgroundColor: role.color }}/>{role.name}</span> : null; }
function ParticipantRoleResolution({ snapshot, item, t }: { snapshot: ClientSnapshot; item: ClientSnapshot['config']['items'][number]; t: (key: TranslationKey, replacements?: Record<string, string | number>) => string }) {
  const auction = snapshot.knowledge!;
  const targetRole = snapshot.config.roles.find((role) => role.id === item.roleId);
  const winner = snapshot.participants.find((participant) => participant.id === auction.leaderId);
  const winnerRole = snapshot.config.roles.find((role) => role.id === winner?.roleId);
  const matched = Boolean(winner && winner.roleId === item.roleId);
  return <Card className={winner ? (matched ? 'bg-emerald-50 ring-emerald-700/20' : 'bg-rose-50 ring-rose-700/20') : 'bg-stone-50'}><CardContent><h2 className="text-2xl font-black">{t('phraseBelongsTo', { role: targetRole?.name ?? t('unassignedRole') })}</h2><div className="mt-3"><RoleBadge role={targetRole}/></div>{item.explanation && <p className="mt-3 text-lg leading-7">{item.explanation}</p>}<p className={`mt-4 font-bold ${winner ? (matched ? 'text-emerald-800' : 'text-rose-800') : ''}`}>{winner ? t(matched ? 'roleMatch' : 'roleMismatch', { points: matched ? snapshot.config.correctRolePoints : snapshot.config.wrongRolePoints }) : t('roleUnsold')}</p><p className="mt-2 font-semibold">{winner ? `${t('soldTo', { name: winner.name, amount: auction.currentBid })} ${snapshot.config.currencyName}` : t('unsold')}</p>{winnerRole && <div className="mt-3"><RoleBadge role={winnerRole}/></div>}</CardContent></Card>;
}
function RoleTotals({ snapshot, t }: { snapshot: ClientSnapshot; t: (key: TranslationKey) => string }) {
  const totals = snapshot.config.roles.map((role) => ({ role, score: snapshot.participants.filter((participant) => participant.roleId === role.id).reduce((sum, participant) => sum + participant.score, 0) })).sort((a, b) => b.score - a.score);
  return <Card className="mt-5"><CardHeader><CardTitle>{t('roleResults')}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{totals.map(({ role, score }) => <div key={role.id} className="flex items-center justify-between rounded-xl border bg-white p-3"><RoleBadge role={role}/><strong>{score}</strong></div>)}</CardContent></Card>;
}
function Centered({ children }: { children: React.ReactNode }) { return <div className="grid min-h-[65vh] place-content-center justify-items-center px-5">{children}</div>; }
