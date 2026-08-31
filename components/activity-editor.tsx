'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Gavel, HeartHandshake, Link2, ListPlus, Play, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createPreparedUrl } from '@/lib/share';
import { translate, type TranslationKey } from '@/lib/i18n';
import { defaultConfig, uid, type ActivityConfig, type Lang, type PhraseItem } from '@/lib/types';

interface Props {
  lang: Lang;
  initial: ActivityConfig | null;
  onBack: () => void;
  onStart: (config: ActivityConfig) => void;
}

export function ActivityEditor({ lang, initial, onBack, onStart }: Props) {
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) => translate(lang, key, replacements);
  const [config, setConfig] = useState<ActivityConfig>(() => initial ? { ...initial, currencyName: initial.currencyName || (lang === 'ca' ? 'crèdits' : 'créditos') } : { ...defaultConfig(), currencyName: lang === 'ca' ? 'crèdits' : 'créditos' });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [preparedUrl, setPreparedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const valid = useMemo(() => config.title.trim().length > 0 && config.items.filter((item) => item.text.trim()).length >= 2, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem('subasta-draft', JSON.stringify(config)), 250);
    return () => window.clearTimeout(timer);
  }, [config]);

  function patch(next: Partial<ActivityConfig>) { setConfig((current) => ({ ...current, ...next })); }
  function patchItem(id: string, next: Partial<PhraseItem>) {
    patch({ items: config.items.map((item) => item.id === id ? { ...item, ...next } : item) });
  }
  function addItem(after?: number) {
    const item: PhraseItem = { id: uid(), text: '', correct: true, explanation: '', category: '' };
    const items = [...config.items]; items.splice(after === undefined ? items.length : after + 1, 0, item); patch({ items });
  }
  function duplicateItem(index: number) {
    const source = config.items[index];
    const items = [...config.items]; items.splice(index + 1, 0, { ...source, id: uid() }); patch({ items });
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= config.items.length) return;
    const items = [...config.items]; [items[index], items[target]] = [items[target], items[index]]; patch({ items });
  }
  function addBulk() {
    const items = bulk.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ id: uid(), text, correct: true, explanation: '', category: '' }));
    if (items.length) patch({ items: [...config.items.filter((item) => item.text.trim()), ...items] });
    setBulk(''); setBulkOpen(false);
  }
  function prepare() {
    if (!valid) return;
    setPreparedUrl(createPreparedUrl({ ...config, items: config.items.filter((item) => item.text.trim()) }, lang));
    setCopied(false);
  }
  async function copyPrepared() {
    await navigator.clipboard.writeText(preparedUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-36 pt-6 sm:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft />{t('back')}</Button>
        <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">{t('saveDraft')}</span>
      </div>
      <div className="mb-9 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[.14em] text-primary">{t('activityEditor')}</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.04em] sm:text-5xl">{config.title || t('createActivity')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader><CardTitle>{t('activityType')}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(['knowledge', 'values'] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => patch({ mode })} className={`flex gap-4 rounded-2xl border p-4 text-left transition ${config.mode === mode ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'bg-white hover:border-primary/40'}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${mode === 'knowledge' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{mode === 'knowledge' ? <Gavel /> : <HeartHandshake />}</span>
                  <span><strong className="block">{t(mode)}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground">{t(`${mode}Description` as TranslationKey)}</span></span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="space-y-5 pt-1">
              <Field label={t('title')}><Input className="h-11" value={config.title} placeholder={t('titlePlaceholder')} onChange={(event) => patch({ title: event.target.value })} /></Field>
              <Field label={t('instructions')}><Textarea value={config.instructions} placeholder={t('instructionsPlaceholder')} onChange={(event) => patch({ instructions: event.target.value })} /></Field>
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black tracking-tight">{t('phrases')} <span className="text-base font-medium text-muted-foreground">({config.items.length})</span></h2><Button variant="outline" onClick={() => setBulkOpen(true)}><ListPlus />{t('pasteList')}</Button></div>
            <div className="space-y-4">
              {config.items.map((item, index) => (
                <Card key={item.id} className="shadow-sm">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-black">{index + 1}</span>{t('phrase')}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t('moveUp')} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('moveDown')} disabled={index === config.items.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('duplicate')} onClick={() => duplicateItem(index)}><Copy /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('delete')} disabled={config.items.length <= 2} onClick={() => patch({ items: config.items.filter((entry) => entry.id !== item.id) })}><Trash2 /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea value={item.text} placeholder={t('phrasePlaceholder')} onChange={(event) => patchItem(item.id, { text: event.target.value })} />
                    {config.mode === 'knowledge' ? <>
                      <div className="flex gap-2">
                        <Button type="button" variant={item.correct ? 'default' : 'outline'} onClick={() => patchItem(item.id, { correct: true })}><Check />{t('correct')}</Button>
                        <Button type="button" variant={!item.correct ? 'default' : 'outline'} onClick={() => patchItem(item.id, { correct: false })}><X />{t('incorrect')}</Button>
                      </div>
                      <Field label={t('explanation')}><Textarea value={item.explanation} placeholder={t('explanationPlaceholder')} onChange={(event) => patchItem(item.id, { explanation: event.target.value })} /></Field>
                    </> : <Field label={t('category')}><Input value={item.category} placeholder={t('categoryPlaceholder')} onChange={(event) => patchItem(item.id, { category: event.target.value })} /></Field>}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button className="mt-4 w-full border-dashed" variant="outline" onClick={() => addItem()}><Plus />{t('addPhrase')}</Button>
          </section>
        </div>

        <Card className="shadow-sm lg:sticky lg:top-5">
          <CardHeader><CardTitle>{t('settings')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label={t('currencyName')}><Input value={config.currencyName} maxLength={30} placeholder={t('currencyPlaceholder')} onChange={(event) => patch({ currencyName: event.target.value })} /></Field>
            <NumberField label={t('budget')} value={config.budget} min={10} onChange={(budget) => patch({ budget })} />
            {config.mode === 'knowledge' && <>
              <div className="grid grid-cols-2 gap-3"><NumberField label={t('minimumBid')} value={config.minBid} min={1} onChange={(minBid) => patch({ minBid })} /><NumberField label={t('bidIncrement')} value={config.increment} min={1} onChange={(increment) => patch({ increment })} /></div>
              <div className="grid grid-cols-2 gap-3"><NumberField label={t('discussionTime')} value={config.discussionSeconds} min={0} onChange={(discussionSeconds) => patch({ discussionSeconds })} /><NumberField label={t('bidTime')} value={config.bidSeconds} min={5} onChange={(bidSeconds) => patch({ bidSeconds })} /></div>
            </>}
            <Field label={t('identity')}><select className="h-10 w-full rounded-lg border bg-white px-3" value={config.identity} onChange={(event) => patch({ identity: event.target.value as ActivityConfig['identity'] })}><option value="named">{t('named')}</option><option value="alias">{t('alias')}</option><option value="anonymous">{t('anonymous')}</option></select></Field>
            {config.mode === 'values' && <label className="flex cursor-pointer gap-3 rounded-xl bg-muted p-3 text-sm leading-5"><input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={config.showIndividualResults} onChange={(event) => patch({ showIndividualResults: event.target.checked })} /><span>{t('showBreakdown')}</span></label>}
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/92 px-5 py-4 shadow-[0_-12px_40px_rgb(60_38_20/.08)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl flex-col justify-end gap-3 sm:flex-row">
          {!valid && <p className="mr-auto self-center text-sm font-medium text-destructive">{t('validationTitle')}</p>}
          <Button size="lg" variant="outline" disabled={!valid} onClick={prepare}><Link2 />{t('prepareUrl')}</Button>
          <Button size="lg" disabled={!valid} onClick={() => onStart({ ...config, items: config.items.filter((item) => item.text.trim()) })}><Play />{t('startNow')}</Button>
        </div>
      </div>

      {bulkOpen && <Modal onClose={() => setBulkOpen(false)} title={t('pasteList')}><p className="mb-3 text-sm text-muted-foreground">{t('pasteHelp')}</p><Textarea className="min-h-48" value={bulk} onChange={(event) => setBulk(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setBulkOpen(false)}>{t('cancel')}</Button><Button disabled={!bulk.trim()} onClick={addBulk}>{t('add')}</Button></div></Modal>}
      {preparedUrl && <Modal onClose={() => setPreparedUrl('')} title={t('preparedTitle')}><p className="text-sm leading-6 text-muted-foreground">{t('preparedText')}</p><div className="mt-4 flex gap-2"><Input readOnly value={preparedUrl} /><Button onClick={copyPrepared}>{copied ? <Check /> : <Copy />}{copied ? t('urlCopied') : t('copyUrl')}</Button></div>{preparedUrl.length > 1800 && <p className="mt-3 text-sm font-medium text-amber-700">{t('urlLongWarning')}</p>}</Modal>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span>{children}</label>; }
function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))} /></Field>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <dialog open className="fixed inset-0 z-50 grid h-full max-h-none w-full max-w-none place-items-center bg-stone-950/35 p-5 backdrop-blur-sm"><Card className="w-full max-w-2xl shadow-2xl"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-xl">{title}</CardTitle><Button size="icon" variant="ghost" onClick={onClose}><X /></Button></CardHeader><CardContent>{children}</CardContent></Card></dialog>; }
