'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataConnection, Peer } from 'peerjs';
import QRCode from 'qrcode';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, Clock3, Copy, Download, Gavel, Play, Radio, Shuffle, Square, Trophy, UserRoundX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { translate, type TranslationKey } from '@/lib/i18n';
import { peerOptions } from '@/lib/peer-config';
import { sessionUrl } from '@/lib/share';
import type { ActivityConfig, ClientSnapshot, Lang, LotResult, ParticipantPublic, PhraseItem, RoleDefinition } from '@/lib/types';

interface ParticipantRecord extends ParticipantPublic { token: string; allocation: Record<string, number> }
interface InternalState {
  revision: number;
  status: 'lobby' | 'running' | 'finished';
  participants: Map<string, ParticipantRecord>;
  knowledge: { index: number; phase: 'planning' | 'discussion' | 'bidding' | 'revealed'; currentBid: number; leaderId: string | null; secondsLeft: number; endsAt: number | null; lots: LotResult[] };
  values: { open: boolean };
}

interface Props { config: ActivityConfig; lang: Lang; onExit: () => void }

export function HostSession({ config, lang, onExit }: Props) {
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) => translate(lang, key, replacements);
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connections = useRef(new Map<string, DataConnection>());
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<InternalState>({
    revision: 0, status: 'lobby', participants: new Map(),
    knowledge: { index: 0, phase: 'planning', currentBid: 0, leaderId: null, secondsLeft: 0, endsAt: null, lots: [] },
    values: { open: false },
  });
  const [snapshot, setSnapshot] = useState<ClientSnapshot>(() => makeSnapshot(config, stateRef.current));

  const publish = useCallback(() => {
    stateRef.current.revision += 1;
    const next = makeSnapshot(config, stateRef.current);
    setSnapshot(next);
    connections.current.forEach((conn) => { if (conn.open) void conn.send({ type: 'state', payload: next }); });
    localStorage.setItem('subasta-host-last', JSON.stringify({ config, snapshot: next }));
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      const { Peer: PeerClass } = await import('peerjs');
      let attempts = 0;
      const create = () => {
        if (cancelled) return;
        const id = Math.random().toString(36).slice(2, 8).toUpperCase();
        const peer = new PeerClass(id, peerOptions);
        peerRef.current = peer;
        peer.on('open', () => { setCode(id); setError(''); });
        peer.on('connection', (conn) => {
          conn.on('data', (raw) => handleMessage(conn, raw));
          conn.on('close', () => markOffline(conn.peer));
        });
        peer.on('error', (event) => {
          if (event.type === 'unavailable-id' && attempts++ < 3) { peer.destroy(); create(); }
          else setError(t('connectionError'));
        });
      };
      create();
    };
    void start();
    return () => { cancelled = true; if (timerRef.current) window.clearInterval(timerRef.current); peerRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    const recompute = () => { if (document.visibilityState === 'visible') tickRef.current?.(); };
    document.addEventListener('visibilitychange', recompute);
    window.addEventListener('focus', recompute);
    return () => { document.removeEventListener('visibilitychange', recompute); window.removeEventListener('focus', recompute); };
  }, []);

  useEffect(() => {
    if (!code) return;
    void QRCode.toDataURL(sessionUrl(code, lang), { width: 360, margin: 1, color: { dark: '#382a20', light: '#ffffff' } }).then(setQr);
  }, [code, lang]);

  function markOffline(peerId: string) {
    const entry = [...connections.current.entries()].find(([, conn]) => conn.peer === peerId);
    if (!entry) return;
    connections.current.delete(entry[0]);
    const participant = stateRef.current.participants.get(entry[0]);
    if (participant) { participant.online = false; publish(); }
  }

  function handleMessage(conn: DataConnection, raw: unknown) {
    const message = raw as { type?: string; token?: string; name?: string; amount?: number; allocation?: Record<string, number> };
    if (message.type === 'hello' && message.token) {
      let participant = [...stateRef.current.participants.values()].find((entry) => entry.token === message.token);
      if (!participant) {
        const number = stateRef.current.participants.size + 1;
        const requested = String(message.name ?? '').trim().slice(0, 40);
        const baseName = config.identity === 'anonymous' ? `${t('participant')} ${number}` : requested || `${t('participant')} ${number}`;
        let name = baseName;
        let suffix = 2;
        const names = new Set([...stateRef.current.participants.values()].map((entry) => entry.name.toLocaleLowerCase()));
        while (names.has(name.toLocaleLowerCase())) name = `${baseName} (${suffix++})`;
        const roleId = config.mode === 'roles' ? pickBalancedRandomRole(config.roles, [...stateRef.current.participants.values()]) : null;
        participant = { id: message.token, token: message.token, name, online: true, balance: config.budget, score: 0, submitted: false, roleId, allocation: {} };
        stateRef.current.participants.set(participant.id, participant);
      } else { participant.online = true; }
      connections.current.set(participant.id, conn);
      publish();
      return;
    }
    const participant = [...stateRef.current.participants.values()].find((entry) => connections.current.get(entry.id) === conn);
    if (!participant) return;
    if (message.type === 'bid' && config.mode !== 'values' && stateRef.current.knowledge.phase === 'bidding') {
      const auction = stateRef.current.knowledge;
      const minimum = auction.currentBid === 0 ? config.minBid : auction.currentBid + config.increment;
      const amount = Math.floor(Number(message.amount));
      const timeUp = auction.endsAt !== null && Date.now() >= auction.endsAt;
      if (!timeUp && Number.isFinite(amount) && amount >= minimum && amount <= participant.balance && auction.leaderId !== participant.id) {
        auction.currentBid = amount; auction.leaderId = participant.id;
        publish();
      }
    }
    if (message.type === 'allocation' && config.mode === 'values' && stateRef.current.values.open && message.allocation) {
      const clean: Record<string, number> = {};
      config.items.forEach((item) => { clean[item.id] = Math.max(0, Math.floor(Number(message.allocation?.[item.id]) || 0)); });
      const total = Object.values(clean).reduce((sum, value) => sum + value, 0);
      if (total <= config.budget) { participant.allocation = clean; participant.submitted = true; publish(); }
    }
  }

  function stopTimer() {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    tickRef.current = null;
    stateRef.current.knowledge.endsAt = null;
  }
  function runTimer(seconds: number, onEnd?: () => void) {
    stopTimer();
    stateRef.current.knowledge.secondsLeft = Math.max(0, seconds);
    if (seconds <= 0) { publish(); return; }
    const endsAt = Date.now() + seconds * 1000;
    stateRef.current.knowledge.endsAt = endsAt; publish();
    // El tiempo restante se calcula contra el reloj del sistema: si el navegador
    // frena o congela los temporizadores en segundo plano, el primer tic que se
    // ejecute recupera el valor real en vez de arrastrar el retraso.
    const tick = () => {
      const auction = stateRef.current.knowledge;
      if (auction.endsAt !== endsAt) return;
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (left !== auction.secondsLeft) { auction.secondsLeft = left; publish(); }
      if (left === 0) {
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        tickRef.current = null;
        onEnd?.();
      }
    };
    tickRef.current = tick;
    timerRef.current = window.setInterval(tick, 250);
  }

  function startActivity() {
    stateRef.current.status = 'running';
    if (config.mode === 'values') stateRef.current.values.open = true;
    publish();
  }
  function startLot(index = 0) {
    Object.assign(stateRef.current.knowledge, { index, phase: 'discussion', currentBid: 0, leaderId: null });
    runTimer(config.discussionSeconds, () => { if (stateRef.current.knowledge.phase === 'discussion') openBidding(); });
  }
  function openBidding() {
    stateRef.current.knowledge.phase = 'bidding'; stateRef.current.knowledge.currentBid = 0; stateRef.current.knowledge.leaderId = null;
    runTimer(config.bidSeconds);
  }
  function closeBidding() {
    stopTimer();
    const auction = stateRef.current.knowledge;
    const item = config.items[auction.index];
    const winner = auction.leaderId ? stateRef.current.participants.get(auction.leaderId) : null;
    const matched = config.mode === 'roles' && winner ? winner.roleId === item.roleId : undefined;
    if (winner) {
      winner.balance -= auction.currentBid;
      winner.score += config.mode === 'roles' ? (matched ? config.correctRolePoints : -config.wrongRolePoints) : (item.correct ? 1 : -1);
    }
    auction.lots.push({ itemId: item.id, winnerId: winner?.id ?? null, winnerName: winner?.name ?? null, amount: auction.currentBid, correct: config.mode === 'knowledge' ? item.correct : undefined, roleId: config.mode === 'roles' ? item.roleId : undefined, winnerRoleId: config.mode === 'roles' ? winner?.roleId ?? null : undefined, matched });
    auction.phase = 'revealed'; auction.secondsLeft = 0; publish();
  }
  function nextLot() {
    const next = stateRef.current.knowledge.index + 1;
    if (next >= config.items.length) finish(); else startLot(next);
  }
  function finish() {
    stopTimer();
    stateRef.current.knowledge.secondsLeft = 0;
    stateRef.current.status = 'finished'; stateRef.current.values.open = false; publish();
  }
  function endEarly() { setConfirmEnd(false); finish(); }
  function removeParticipant(id: string) { connections.current.get(id)?.close(); connections.current.delete(id); stateRef.current.participants.delete(id); publish(); }
  function setParticipantRole(id: string, roleId: string) { const participant = stateRef.current.participants.get(id); if (participant) { participant.roleId = roleId || null; publish(); } }
  function randomizeRoles() {
    const participants = [...stateRef.current.participants.values()];
    for (let index = participants.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [participants[index], participants[target]] = [participants[target], participants[index]];
    }
    participants.forEach((participant, index) => { participant.roleId = config.roles[index % config.roles.length]?.id ?? null; });
    publish();
  }
  async function copyLink() { await navigator.clipboard.writeText(sessionUrl(code, lang)); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  function exportCsv() {
    const rows = config.mode !== 'values'
      ? [['participant', ...(config.mode === 'roles' ? ['role'] : []), 'points', 'balance'], ...snapshot.participants.map((p) => [p.name, ...(config.mode === 'roles' ? [config.roles.find((role) => role.id === p.roleId)?.name ?? ''] : []), p.score, p.balance])]
      : [['phrase', 'credits'], ...config.items.map((item) => [item.text, snapshot.values?.totals?.[item.id] ?? 0])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = 'resultados-subasta.csv'; link.click(); URL.revokeObjectURL(link.href);
  }

  const auction = snapshot.knowledge;
  const item = auction ? config.items[auction.index] : null;
  const sorted = [...snapshot.participants].sort((a, b) => b.score - a.score || b.balance - a.balance);
  const submitted = snapshot.participants.filter((participant) => participant.submitted).length;

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" title={t('exitSessionHelp')} onClick={onExit}><ArrowLeft />{t('back')}</Button>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Radio className="size-4 text-emerald-600" />{config.title}</div>
      </header>

      {error && <div className="mb-5 rounded-xl bg-red-50 p-4 font-medium text-red-700">{error}</div>}
      {snapshot.status === 'lobby' && <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="shadow-sm"><CardHeader><CardTitle>{t('session')}</CardTitle></CardHeader><CardContent className="text-center">
          {qr ? <Image unoptimized width={256} height={256} className="mx-auto aspect-square w-64 rounded-xl bg-white p-2" src={qr} alt="QR" /> : <div className="mx-auto h-64 w-64 animate-pulse rounded-xl bg-muted" />}
          <div className="mt-5 font-mono text-4xl font-black tracking-[.16em]">{code || '······'}</div>
          <Button className="mt-4" variant="outline" title={t('copySessionHelp')} disabled={!code} onClick={copyLink}>{copied ? <CheckCircle2 /> : <Copy />}{copied ? t('copied') : t('copy')}</Button>
        </CardContent></Card>
        <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Users />{t('waitingRoom')} <span className="rounded-full bg-secondary px-2 py-0.5 text-sm">{snapshot.participants.length}</span></CardTitle></CardHeader><CardContent>
          <ParticipantList participants={snapshot.participants} roles={config.mode === 'roles' ? config.roles : undefined} t={t} onRemove={removeParticipant} onRoleChange={setParticipantRole} />
          {config.mode === 'roles' && <Button className="mt-4 w-full" variant="outline" title={t('randomizeRolesHelp')} onClick={randomizeRoles}><Shuffle />{t('randomizeRoles')}</Button>}
          <Button size="lg" className="mt-6 w-full" title={t('startActivityHelp')} disabled={!code || snapshot.participants.length === 0} onClick={startActivity}><Play />{t('startActivity')}</Button>
        </CardContent></Card>
      </div>}

      {snapshot.status === 'running' && config.mode !== 'values' && auction && item && <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          {auction.phase === 'planning' ? <Card className="shadow-sm"><CardHeader><CardTitle className="text-3xl">{t('planning')}</CardTitle></CardHeader><CardContent><p className="mb-5 text-muted-foreground">{t(config.mode === 'roles' ? 'rolePlanningHelp' : 'planningHelp')}</p>{config.mode === 'roles' && <RoleList roles={config.roles} />}<ol className="mt-5 space-y-2">{config.items.map((phrase, index) => <li key={phrase.id} className="flex gap-3 rounded-xl bg-muted/70 p-3"><span className="font-black text-primary">{index + 1}</span>{phrase.text}</li>)}</ol><Button size="lg" className="mt-6" title={t('startFirstLotHelp')} onClick={() => startLot()}><Gavel />{t('startFirstLot')}</Button></CardContent></Card> : <>
            <div className="flex items-center justify-between gap-3"><p className="font-bold text-muted-foreground">{t('lotOf', { current: auction.index + 1, total: config.items.length })}</p><PhaseBadge phase={auction.phase} t={t} /></div>
            <Card className="min-h-64 justify-center bg-white shadow-[0_24px_70px_-38px_rgb(70_42_20/.35)]"><CardContent className="py-10 text-center"><p className="text-3xl font-black leading-tight tracking-[-.03em] sm:text-5xl">{item.text}</p>{item.category && <span className="mt-5 inline-block rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{item.category}</span>}</CardContent></Card>
            {(auction.phase === 'discussion' || auction.phase === 'bidding') && <div className="grid gap-4 sm:grid-cols-2"><Card><CardContent className="flex items-center gap-4"><Clock3 className="size-8 text-primary"/><div><p className="text-sm text-muted-foreground">{auction.secondsLeft ? t('timeLeft', { seconds: auction.secondsLeft }) : t('timerFinished')}</p><Progress className="mt-2 w-44" value={auction.phase === 'discussion' ? auction.secondsLeft / Math.max(1, config.discussionSeconds) * 100 : auction.secondsLeft / Math.max(1, config.bidSeconds) * 100} /></div></CardContent></Card><Card><CardContent><p className="text-sm text-muted-foreground">{t('currentBid')}</p><p className="mt-1 text-3xl font-black">{auction.currentBid || '—'} <span className="text-base font-semibold text-muted-foreground">{config.currencyName}</span></p><p className="text-sm font-medium">{auction.leaderName ? t('leader', { name: auction.leaderName }) : t('noBids')}</p></CardContent></Card></div>}
            {auction.phase === 'discussion' && <Button size="lg" className="w-full" title={t('startBiddingHelp')} onClick={openBidding}><Radio />{t('startBidding')}</Button>}
            {auction.phase === 'bidding' && <Button size="lg" className="w-full" title={t('closeBiddingHelp')} onClick={closeBidding}><Square />{t('closeBidding')}</Button>}
            {auction.phase === 'revealed' && (config.mode === 'roles' ? <RoleResolution config={config} item={item} auction={auction} t={t}><Button className="mt-5" size="lg" title={t(auction.index === config.items.length - 1 ? 'showResultsHelp' : 'nextPhraseHelp')} onClick={nextLot}>{auction.index === config.items.length - 1 ? <Trophy /> : <Gavel />}{auction.index === config.items.length - 1 ? t('showFinalResults') : t('nextPhrase')}</Button></RoleResolution> : <Card className={item.correct ? 'bg-emerald-50 ring-emerald-700/20' : 'bg-rose-50 ring-rose-700/20'}><CardContent><h2 className={`text-2xl font-black ${item.correct ? 'text-emerald-800' : 'text-rose-800'}`}>{item.correct ? t('answerCorrect') : t('answerIncorrect')}</h2>{item.explanation && <p className="mt-3 text-lg leading-7">{item.explanation}</p>}<p className="mt-4 font-semibold">{auction.leaderName ? `${t('soldTo', { name: auction.leaderName, amount: auction.currentBid })} ${config.currencyName}` : t('unsold')}</p>{!config.revealAnswers && <p className="mt-2 text-sm font-semibold text-muted-foreground">{t('answersHiddenNotice')}</p>}<Button className="mt-5" size="lg" title={t(auction.index === config.items.length - 1 ? 'showResultsHelp' : 'nextPhraseHelp')} onClick={nextLot}>{auction.index === config.items.length - 1 ? <Trophy /> : <Gavel />}{auction.index === config.items.length - 1 ? t('showFinalResults') : t('nextPhrase')}</Button></CardContent></Card>)}
          </>}
        </div>
        <Card className="h-fit shadow-sm xl:sticky xl:top-5"><CardHeader><CardTitle>{t('rankings')}</CardTitle></CardHeader><CardContent>
          <Ranking participants={sorted} currency={config.currencyName} roles={config.mode === 'roles' ? config.roles : undefined} t={t} />
          <p className="mt-5 text-sm text-muted-foreground">{t('auctionedCount', { done: auction.lots.length, total: config.items.length })}</p>
          {confirmEnd
            ? <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3"><p className="text-sm font-semibold">{t('endNowConfirm', { pending: config.items.length - auction.lots.length })}</p><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="destructive" title={t('endNowHelp')} onClick={endEarly}><Trophy />{t('endNowYes')}</Button><Button variant="outline" onClick={() => setConfirmEnd(false)}>{t('cancel')}</Button></div></div>
            : <Button variant="outline" className="mt-3 w-full" title={t('endNowHelp')} onClick={() => setConfirmEnd(true)}><Trophy />{t('endNow')}</Button>}
        </CardContent></Card>
      </div>}

      {snapshot.status === 'running' && config.mode === 'values' && <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="shadow-sm"><CardHeader><CardTitle className="text-3xl">{config.title}</CardTitle></CardHeader><CardContent><p className="mb-6 text-lg text-muted-foreground">{config.instructions}</p><div className="space-y-3">{config.items.map((phrase) => <div key={phrase.id} className="rounded-xl border bg-white p-4"><p className="text-lg font-bold">{phrase.text}</p>{phrase.category && <p className="mt-1 text-sm text-muted-foreground">{phrase.category}</p>}</div>)}</div></CardContent></Card>
        <div className="space-y-5"><Card className="shadow-sm"><CardContent><p className="text-sm font-semibold text-muted-foreground">{t('submittedCount', { count: submitted, total: snapshot.participants.length })}</p><Progress className="mt-3" value={snapshot.participants.length ? submitted / snapshot.participants.length * 100 : 0} /><Button size="lg" className="mt-5 w-full" title={t('closeValuesHelp')} onClick={finish}><Trophy />{t('closeValues')}</Button></CardContent></Card><Card className="shadow-sm"><CardHeader><CardTitle>{t('connectedParticipants')}</CardTitle></CardHeader><CardContent><ParticipantList participants={snapshot.participants} t={t} onRemove={removeParticipant} /></CardContent></Card></div>
      </div>}

      {snapshot.status === 'finished' && <Results config={config} snapshot={snapshot} t={t} onExport={exportCsv} onExit={onExit} />}
    </div>
  );
}

function pickBalancedRandomRole(roles: RoleDefinition[], participants: ParticipantRecord[]) {
  if (!roles.length) return null;
  const counts = new Map(roles.map((role) => [role.id, participants.filter((participant) => participant.roleId === role.id).length]));
  const minimum = Math.min(...counts.values());
  const candidates = roles.filter((role) => counts.get(role.id) === minimum);
  return candidates[Math.floor(Math.random() * candidates.length)]?.id ?? null;
}

function makeSnapshot(config: ActivityConfig, state: InternalState): ClientSnapshot {
  const revealCurrent = state.status === 'finished' || state.knowledge.phase === 'revealed';
  const hideAnswers = config.mode === 'knowledge' && !config.revealAnswers;
  const items = config.items.map((item, index) => ({ id: item.id, text: item.text, category: item.category, ...(!hideAnswers && (revealCurrent && index === state.knowledge.index || state.status === 'finished') ? { correct: config.mode === 'knowledge' ? item.correct : undefined, roleId: config.mode === 'roles' ? item.roleId : undefined, explanation: item.explanation } : {}) }));
  const participants = [...state.participants.values()].map(({ id, name, online, balance, score, submitted, roleId }) => ({ id, name, online, balance, score, submitted, roleId }));
  const leader = state.knowledge.leaderId ? state.participants.get(state.knowledge.leaderId) : null;
  const totals = state.status === 'finished' && config.mode === 'values' ? Object.fromEntries(config.items.map((item) => [item.id, [...state.participants.values()].reduce((sum, participant) => sum + (participant.allocation[item.id] || 0), 0)])) : null;
  const allocations = state.status === 'finished' && config.mode === 'values' && config.showIndividualResults ? Object.fromEntries([...state.participants.values()].map((participant) => [participant.name, participant.allocation])) : null;
  const lots = hideAnswers ? state.knowledge.lots.map(({ correct: _correct, ...lot }) => lot) : state.knowledge.lots;
  const { endsAt: _endsAt, ...knowledge } = state.knowledge;
  return { revision: state.revision, status: state.status, config: { ...config, items }, participants, knowledge: config.mode !== 'values' ? { ...knowledge, lots, leaderName: leader?.name ?? null } : undefined, values: config.mode === 'values' ? { open: state.values.open, totals, allocations } : undefined };
}

function ParticipantList({ participants, roles, t, onRemove, onRoleChange }: { participants: ParticipantPublic[]; roles?: RoleDefinition[]; t: (key: TranslationKey, replacements?: Record<string, string | number>) => string; onRemove: (id: string) => void; onRoleChange?: (id: string, roleId: string) => void }) {
  if (!participants.length) return <p className="rounded-xl bg-muted p-5 text-center text-muted-foreground">{t('noParticipants')}</p>;
  return <ul className="space-y-2">{participants.map((participant) => <li key={participant.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3"><span className={`size-2.5 rounded-full ${participant.online ? 'bg-emerald-500' : 'bg-stone-300'}`} /><span className="min-w-32 flex-1 truncate font-semibold">{participant.name}</span>{roles && <select aria-label={t('assignRole')} title={t('assignRole')} className="h-9 max-w-52 rounded-lg border bg-white px-2 text-sm font-semibold" value={participant.roleId ?? ''} onChange={(event) => onRoleChange?.(participant.id, event.target.value)}><option value="">{t('unassignedRole')}</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}<span className="text-xs text-muted-foreground">{participant.online ? t('online') : t('offline')}</span><Button size="icon-sm" variant="ghost" aria-label={t('removeParticipant')} title={t('removeParticipantHelp')} onClick={() => onRemove(participant.id)}><UserRoundX /></Button></li>)}</ul>;
}
function Ranking({ participants, currency, roles, t }: { participants: ParticipantPublic[]; currency: string; roles?: RoleDefinition[]; t: (key: TranslationKey) => string }) { return <ol className="space-y-2">{participants.map((participant, index) => <li key={participant.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border bg-white p-3"><span className="font-black text-primary">{index + 1}</span><span className="min-w-0"><span className="block truncate font-semibold">{participant.name}</span>{roles && <RoleBadge role={roles.find((role) => role.id === participant.roleId)} />}</span><span className="text-right text-sm"><strong>{participant.score} {t('points').toLowerCase()}</strong><br/><span className="text-muted-foreground">{participant.balance} {currency}</span></span></li>)}</ol>; }
function PhaseBadge({ phase, t }: { phase: 'discussion' | 'bidding' | 'revealed' | 'planning'; t: (key: TranslationKey) => string }) { return <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">{t(phase)}</span>; }

function RoleBadge({ role }: { role?: RoleDefinition }) { return role ? <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: role.color, backgroundColor: `${role.color}18` }}><span className="size-2 rounded-full" style={{ backgroundColor: role.color }}/>{role.name}</span> : null; }
function RoleList({ roles }: { roles: RoleDefinition[] }) { return <div className="grid gap-2 sm:grid-cols-2">{roles.map((role) => <div key={role.id} className="rounded-xl border bg-white p-3"><RoleBadge role={role}/>{role.description && <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>}</div>)}</div>; }
function RoleResolution({ config, item, auction, t, children }: { config: ActivityConfig; item: PhraseItem; auction: NonNullable<ClientSnapshot['knowledge']>; t: (key: TranslationKey, replacements?: Record<string, string | number>) => string; children?: React.ReactNode }) {
  const role = config.roles.find((entry) => entry.id === item.roleId);
  const winner = auction.leaderId ? config.roles.find((entry) => entry.id === auction.lots.at(-1)?.winnerRoleId) : undefined;
  const matched = Boolean(auction.leaderId && winner?.id === role?.id);
  return <Card className={auction.leaderId ? (matched ? 'bg-emerald-50 ring-emerald-700/20' : 'bg-rose-50 ring-rose-700/20') : 'bg-stone-50'}><CardContent><h2 className="text-2xl font-black">{t('phraseBelongsTo', { role: role?.name ?? t('unassignedRole') })}</h2><div className="mt-3 flex flex-wrap gap-2"><RoleBadge role={role}/>{winner && <span className="text-sm text-muted-foreground">{auction.leaderName}: <RoleBadge role={winner}/></span>}</div>{item.explanation && <p className="mt-3 text-lg leading-7">{item.explanation}</p>}<p className={`mt-4 font-bold ${auction.leaderId ? (matched ? 'text-emerald-800' : 'text-rose-800') : ''}`}>{auction.leaderId ? t(matched ? 'roleMatch' : 'roleMismatch', { points: matched ? config.correctRolePoints : config.wrongRolePoints }) : t('roleUnsold')}</p><p className="mt-2 font-semibold">{auction.leaderName ? `${t('soldTo', { name: auction.leaderName, amount: auction.currentBid })} ${config.currencyName}` : t('unsold')}</p>{children}</CardContent></Card>;
}

function Results({ config, snapshot, t, onExport, onExit }: { config: ActivityConfig; snapshot: ClientSnapshot; t: (key: TranslationKey, replacements?: Record<string, string | number>) => string; onExport: () => void; onExit: () => void }) {
  const sorted = [...snapshot.participants].sort((a, b) => b.score - a.score || b.balance - a.balance);
  const valueRows = config.items.map((item) => ({ ...item, total: snapshot.values?.totals?.[item.id] ?? 0 })).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...valueRows.map((row) => row.total));
  const roleTotals = config.roles.map((role) => ({ role, score: snapshot.participants.filter((participant) => participant.roleId === role.id).reduce((sum, participant) => sum + participant.score, 0) })).sort((a, b) => b.score - a.score);
  return <div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><Trophy className="mx-auto size-14 text-amber-600"/><h1 className="mt-3 text-4xl font-black">{config.mode !== 'values' ? t('rankings') : t('collectiveResult')}</h1>{config.mode !== 'values' && <p className="mt-2 text-muted-foreground">{t('auctionedCount', { done: snapshot.knowledge?.lots.length ?? 0, total: config.items.length })}</p>}</div><Card className="shadow-sm"><CardContent>{config.mode !== 'values' ? <Ranking participants={sorted} currency={config.currencyName} roles={config.mode === 'roles' ? config.roles : undefined} t={t} /> : <div className="space-y-5">{valueRows.length ? valueRows.map((row, index) => <div key={row.id}><div className="mb-2 flex gap-3"><span className="font-black text-primary">{index + 1}</span><span className="flex-1 font-semibold">{row.text}</span><strong>{row.total} {config.currencyName}</strong></div><Progress value={row.total / max * 100} /></div>) : <p>{t('noAllocations')}</p>}</div>}</CardContent></Card>{config.mode === 'roles' && <Card className="mt-6 shadow-sm"><CardHeader><CardTitle>{t('roleResults')}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{roleTotals.map(({ role, score }) => <div key={role.id} className="flex items-center justify-between rounded-xl border bg-white p-4"><RoleBadge role={role}/><strong>{score} {t('points').toLowerCase()}</strong></div>)}</CardContent></Card>}{snapshot.values?.allocations && <Card className="mt-6 shadow-sm"><CardHeader><CardTitle>{t('individualBreakdown')}</CardTitle></CardHeader><CardContent className="space-y-4">{Object.entries(snapshot.values.allocations).map(([name, allocation]) => <div key={name} className="rounded-xl border bg-white p-4"><h3 className="font-black">{name}</h3><ul className="mt-2 space-y-1 text-sm">{config.items.filter((item) => (allocation[item.id] || 0) > 0).map((item) => <li key={item.id} className="flex gap-3"><span className="flex-1">{item.text}</span><strong>{allocation[item.id]} {config.currencyName}</strong></li>)}</ul></div>)}</CardContent></Card>}<div className="mt-6 flex justify-center gap-3"><Button variant="outline" title={t('exportResultsHelp')} onClick={onExport}><Download />{t('exportCsv')}</Button><Button title={t('newActivityHelp')} onClick={onExit}>{t('newActivity')}</Button></div></div>;
}
