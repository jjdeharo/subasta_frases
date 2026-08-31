export type Lang = 'es' | 'ca';
export type Mode = 'knowledge' | 'values';
export type IdentityMode = 'named' | 'alias' | 'anonymous';
export type Screen = 'home' | 'editor' | 'join' | 'host' | 'participant';

export interface PhraseItem {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
  category: string;
}

export interface ActivityConfig {
  version: 1;
  mode: Mode;
  title: string;
  instructions: string;
  currencyName: string;
  budget: number;
  minBid: number;
  increment: number;
  discussionSeconds: number;
  bidSeconds: number;
  identity: IdentityMode;
  showIndividualResults: boolean;
  items: PhraseItem[];
}

export interface ParticipantPublic {
  id: string;
  name: string;
  online: boolean;
  balance: number;
  score: number;
  submitted: boolean;
}

export interface LotResult {
  itemId: string;
  winnerId: string | null;
  winnerName: string | null;
  amount: number;
  correct: boolean;
}

export type KnowledgePhase = 'planning' | 'discussion' | 'bidding' | 'revealed';

export interface ClientSnapshot {
  revision: number;
  status: 'lobby' | 'running' | 'finished';
  config: Omit<ActivityConfig, 'items'> & { items: Array<Omit<PhraseItem, 'correct' | 'explanation'> & { correct?: boolean; explanation?: string }> };
  participants: ParticipantPublic[];
  knowledge?: {
    index: number;
    phase: KnowledgePhase;
    currentBid: number;
    leaderId: string | null;
    leaderName: string | null;
    secondsLeft: number;
    lots: LotResult[];
  };
  values?: {
    open: boolean;
    totals: Record<string, number> | null;
    allocations: Record<string, Record<string, number>> | null;
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultConfig = (): ActivityConfig => ({
  version: 1,
  mode: 'knowledge',
  title: '',
  instructions: '',
  currencyName: 'créditos',
  budget: 1000,
  minBid: 50,
  increment: 50,
  discussionSeconds: 30,
  bidSeconds: 25,
  identity: 'named',
  showIndividualResults: false,
  items: [
    { id: uid(), text: '', correct: true, explanation: '', category: '' },
    { id: uid(), text: '', correct: false, explanation: '', category: '' },
    { id: uid(), text: '', correct: true, explanation: '', category: '' },
  ],
});
