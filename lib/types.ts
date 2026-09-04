export type Lang = 'es' | 'ca' | 'gl' | 'eu' | 'en' | 'de';
export type Mode = 'knowledge' | 'values' | 'roles';
export type IdentityMode = 'named' | 'anonymous';
export type Screen = 'home' | 'editor' | 'join' | 'host' | 'participant';

export interface PhraseItem {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
  category: string;
  roleId: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  color: string;
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
  revealAnswers: boolean;
  roles: RoleDefinition[];
  correctRolePoints: number;
  wrongRolePoints: number;
  items: PhraseItem[];
}

export interface ParticipantPublic {
  id: string;
  name: string;
  online: boolean;
  balance: number;
  score: number;
  submitted: boolean;
  roleId: string | null;
}

export interface LotResult {
  itemId: string;
  winnerId: string | null;
  winnerName: string | null;
  amount: number;
  correct?: boolean;
  roleId?: string;
  winnerRoleId?: string | null;
  matched?: boolean;
}

export type KnowledgePhase = 'planning' | 'discussion' | 'bidding' | 'revealed';

export interface ClientSnapshot {
  revision: number;
  status: 'lobby' | 'running' | 'finished';
  config: Omit<ActivityConfig, 'items'> & { items: Array<Omit<PhraseItem, 'correct' | 'explanation' | 'roleId'> & { correct?: boolean; explanation?: string; roleId?: string }> };
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

export const defaultRoles = (): RoleDefinition[] => [
  { id: uid(), name: 'Rol 1', description: '', color: '#2563eb' },
  { id: uid(), name: 'Rol 2', description: '', color: '#059669' },
  { id: uid(), name: 'Rol 3', description: '', color: '#d97706' },
  { id: uid(), name: 'Rol 4', description: '', color: '#9333ea' },
];

export const defaultConfig = (): ActivityConfig => {
  const roles = defaultRoles();
  return ({
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
  revealAnswers: true,
  roles,
  correctRolePoints: 1,
  wrongRolePoints: 1,
  items: [
    { id: uid(), text: '', correct: true, explanation: '', category: '', roleId: roles[0].id },
    { id: uid(), text: '', correct: false, explanation: '', category: '', roleId: roles[1].id },
    { id: uid(), text: '', correct: true, explanation: '', category: '', roleId: roles[2].id },
  ],
  });
};

export function normalizeConfig(value: ActivityConfig): ActivityConfig {
  const fallback = defaultConfig();
  const roles = Array.isArray(value.roles) && value.roles.length
    ? value.roles.map((role, index) => ({ id: role.id || uid(), name: role.name || `Rol ${index + 1}`, description: role.description || '', color: role.color || fallback.roles[index % fallback.roles.length].color }))
    : fallback.roles;
  return {
    ...fallback,
    ...value,
    roles,
    identity: (value.identity as string) === 'anonymous' ? 'anonymous' : 'named',
    revealAnswers: value.revealAnswers !== false,
    correctRolePoints: Math.max(0, Number(value.correctRolePoints ?? 1)),
    wrongRolePoints: Math.max(0, Number(value.wrongRolePoints ?? 1)),
    items: value.items.map((item) => ({ ...item, correct: item.correct ?? true, explanation: item.explanation || '', category: item.category || '', roleId: item.roleId && roles.some((role) => role.id === item.roleId) ? item.roleId : roles[0].id })),
  };
}
