import type { Application, Difficulty, GameState, NewsItem, Principal, SponsorDeal, Team, TeamOps } from '../types';
import type { Rng } from './rng';
import { COMPONENTS, carRating } from './team';
import { DIFF, dm } from './difficulty';

const NAMES = ['Vertex Energy', 'Lumina Telecom', 'Atlas Bank', 'Nova Fuels', 'Kiro Watches'];
export const newApplication = (): Application => ({ status: 'draft', facilities: 0, support: 0, daysLeft: 0, reasons: [], attempts: 0 });
export const newTeamOps = (): TeamOps => ({
  staff: [], projects: [], sponsors: [], ledger: [], devSpent: 0, academy: [],
  car: COMPONENTS.map((c) => ({ id: c.id, label: c.label, performance: 35, reliability: 60, level: 1 })),
});
export const startOffers = (rng: Rng, season: number): SponsorDeal[] =>
  [0, 1].map((i) => ({ id: `so0-${i}`, name: rng.pick(NAMES), endSeason: season + rng.int(1, 2), pay: Math.round((1 + rng.next() * 2) * 10) / 10 }));

/** Ser aceptado como jefe de una escudería existente: la media de tu perfil debe alcanzar la exigencia del equipo. */
export function acceptance(team: Team, p: Principal, diff: Difficulty) {
  const need = Math.round(team.reputation * 0.8 * DIFF[diff].ask), score = Math.round((p.experience + p.reputation + p.management + p.technical) / 4);
  return { ok: score >= need, need, score };
}

export const REQ = (s: GameState) => ({ budget: Math.round(50 * dm(s).ask), facilities: 12, staff: 6, skill: 50, support: 40, fee: 20 });
const myTeam = (s: GameState) => s.teams.find((t) => t.id === s.player.teamId);
const nw = (s: GameState, id: string, headline: string, body: string): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category: 'system', headline, body, involved: [myTeam(s)?.name ?? ''] });

export function checks(s: GameState) {
  const t = myTeam(s), a = s.application, q = REQ(s), st = s.ops.staff;
  const avg = st.length ? Math.round(st.reduce((x, y) => x + y.skill, 0) / st.length) : 0;
  return [
    { label: 'Capacidad financiera', ok: (t?.budget ?? 0) >= q.budget, have: `${t?.budget ?? 0} M`, need: `${q.budget} M de presupuesto` },
    { label: 'Instalaciones', ok: (a?.facilities ?? 0) >= q.facilities, have: `${a?.facilities ?? 0} M`, need: `${q.facilities} M invertidos` },
    { label: 'Personal técnico', ok: st.length >= q.staff && avg >= q.skill, have: `${st.length} empleados, nivel medio ${avg}`, need: `${q.staff} empleados, nivel medio ${q.skill}` },
    { label: 'Proyecto deportivo y apoyo de la FIA', ok: (a?.support ?? 0) >= q.support, have: `${a?.support ?? 0}`, need: `${q.support} de apoyo` },
  ];
}
const setApp = (s: GameState, patch: Partial<Application>): GameState => (s.application ? { ...s, application: { ...s.application, ...patch } } : s);
const pay = (s: GameState, amount: number): GameState =>
  ({ ...s, teams: s.teams.map((t) => (t.id === s.player.teamId ? { ...t, budget: Math.round((t.budget - amount) * 100) / 100 } : t)) });

export function investFacilities(s: GameState, amount: number): GameState {
  const t = myTeam(s), a = s.application;
  if (!a || a.status !== 'draft' || !t || amount <= 0 || amount > t.budget) return s;
  return setApp(pay(s, amount), { facilities: Math.round((a.facilities + amount) * 10) / 10 });
}
export function lobbyFia(s: GameState): GameState {
  const t = myTeam(s), a = s.application;
  if (!a || a.status !== 'draft' || !t || t.budget < 2) return s;
  const gain = Math.round(6 + (s.principal?.reputation ?? 50) / 10);
  return { ...setApp(pay(s, 2), { support: Math.min(100, a.support + gain) }), news: [nw(s, 'lobby', 'Reuniones con la FIA', `Tus contactos con la federación suman ${gain} puntos de apoyo.`), ...s.news] };
}
export function submitApplication(s: GameState): GameState {
  if (!s.application || s.application.status !== 'draft') return s;
  return { ...setApp(s, { status: 'review', daysLeft: 30, reasons: [] }), news: [nw(s, 'submit', 'Solicitud presentada a la FIA', 'La federación revisará el proyecto durante 30 días.'), ...s.news] };
}

/** Cada día avanza la revisión; al terminar, la FIA admite al equipo o devuelve los motivos del rechazo. */
export function fiaStep(s: GameState): { state: GameState; news: NewsItem[] } {
  const a = s.application, team = myTeam(s);
  if (!a || a.status !== 'review' || !team) return { state: s, news: [] };
  if (a.daysLeft > 1) return { state: setApp(s, { daysLeft: a.daysLeft - 1 }), news: [] };
  const bad = checks(s).filter((c) => !c.ok);
  if (bad.length) {
    const reasons = bad.map((c) => `${c.label}: tienes ${c.have}, se exige ${c.need}`);
    return { state: setApp(s, { status: 'draft', daysLeft: 0, reasons, attempts: a.attempts + 1 }), news: [nw(s, 'fia-no', 'La FIA rechaza la solicitud', `${team.name} no cumple los requisitos. Puedes corregirlos y volver a presentarla.`)] };
  }
  const q = REQ(s);
  const paid = pay(s, q.fee);
  return {
    state: { ...setApp(paid, { status: 'approved', reasons: [] }), teams: paid.teams.map((t) => (t.id === team.id ? { ...t, entered: true, reputation: 40, carPerf: carRating(s.ops) } : t)) },
    news: [nw(s, 'fia-ok', `La FIA admite a ${team.name}`, `Pagas la cuota de inscripción de ${q.fee} M. Necesitas dos pilotos para competir.`)],
  };
}
