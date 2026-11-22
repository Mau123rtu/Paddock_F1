import type { Driver, GameState, NewsItem, RaceResult } from '../types';
import { STAT_KEYS } from '../types';
import { Rng } from './rng';
import { FIRST_NAMES, LAST_NAMES, NATIONALITIES } from '../data/world';
import { asking, rating, roster } from './market';
import { PLAYER_ID, makeOffer, playerOf } from './career';

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const myTeam = (s: GameState) => s.teams.find((t) => t.id === s.player.teamId);
const nw = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved: [s.player.name] });
const withNews = (s: GameState, n: NewsItem): GameState => ({ ...s, news: [n, ...s.news] });
function addDays(iso: string, days: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

/* ---------- Relaciones individuales ---------- */
export const bump = (s: GameState, d: Record<string, number>): GameState => {
  const b = { ...s.bonds };
  for (const [k, v] of Object.entries(d)) b[k] = clamp((b[k] ?? 50) + v);
  return { ...s, bonds: b };
};
export const friends = (s: GameState) => Object.entries(s.bonds).filter(([k, v]) => k !== 'engineer' && v >= 70).length;

/** Piloto: duelos cercanos enfrían la relación, compartir podio la mejora, ganar al compañero la daña; el ingeniero valora los buenos resultados. */
export function raceBonds(s: GameState, result: RaceResult): GameState {
  const me = result.entries.find((e) => e.id === PLAYER_ID);
  if (!me) return s;
  const d: Record<string, number> = { engineer: me.status === 'dnf' ? -1 : me.pos <= 6 ? 1 : 0 };
  for (const e of result.entries) {
    if (e.id === PLAYER_ID) continue;
    let v = 0;
    if (Math.abs(e.pos - me.pos) === 1) v -= 1;
    if (e.pos <= 3 && me.pos <= 3 && me.status === 'finished') v += 1;
    if (e.team === me.team && e.status === 'finished') v += me.pos < e.pos ? -2 : 1;
    if (v) d[e.name] = (d[e.name] ?? 0) + v;
  }
  return bump(s, d);
}
/** Jefe de equipo: tus pilotos valoran los podios; la orden de mantener posiciones molesta al que va detrás. */
export function principalBonds(s: GameState, result: RaceResult): GameState {
  const mine = result.entries.filter((e) => s.drivers.find((d) => d.id === e.id)?.teamId === s.player.teamId);
  if (!mine.length) return s;
  const d: Record<string, number> = {};
  mine.forEach((e) => { d[e.id] = e.status === 'dnf' ? -1 : e.pos <= 3 ? 2 : 0; });
  const fin = mine.filter((e) => e.status === 'finished').sort((a, b) => b.pos - a.pos);
  if (result.hold && mine.length === 2 && fin.length) d[fin[0].id] = (d[fin[0].id] ?? 0) - 3;
  return bump(s, d);
}
export function renewDriver(s: GameState, id: string, salary: number, years: number): GameState {
  const d = s.drivers.find((x) => x.id === id), t = myTeam(s);
  if (s.mode !== 'principal' || !d || !d.contract || !t || d.teamId !== t.id) return s;
  const need = Math.round(asking(s, d) * (1.3 - (s.bonds[id] ?? 50) / 200) * 10) / 10;
  if (salary < need) return withNews(bump(s, { [id]: -2 }), nw(s, `rn-no-${id}`, 'transfer', `${d.name} rechaza renovar`, `Pide al menos ${need} M anuales (su relación con el equipo influye).`));
  const endSeason = s.season + years - 1;
  return withNews(bump({ ...s, drivers: s.drivers.map((x) => (x.id === id ? { ...x, contract: { teamId: t.id, salary, endSeason } } : x)) }, { [id]: 3 }),
    nw(s, `rn-${id}`, 'transfer', `${d.name} renueva con ${t.name}`, `${salary} M anuales hasta ${endSeason}.`));
}

/* ---------- Representante ---------- */
export const hireAgent = (s: GameState): GameState => (s.mode !== 'driver' || s.career.agent.hired ? s
  : withNews({ ...s, career: { ...s.career, agent: { ...s.career.agent, hired: true } } }, nw(s, 'agent', 'system', 'Contratas un representante', 'Cobra el 10 % de tus ingresos, mejora tus ofertas y negocia por ti.')));
export const fireAgent = (s: GameState): GameState => ({ ...s, career: { ...s.career, agent: { hired: false, nextAsk: s.career.agent.nextAsk } } });
export function askAgent(s: GameState): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p || !s.career.agent.hired) return s;
  if (s.date < s.career.agent.nextAsk) return withNews(s, nw(s, 'agent-wait', 'system', 'Tu representante necesita tiempo', `Podrá buscar de nuevo a partir del ${s.career.agent.nextAsk}.`));
  const rng = new Rng(s.seed), agent = { ...s.career.agent, nextAsk: addDays(s.date, 30) };
  if (s.offers.length === 0 && rng.next() < 0.6) {
    const o = makeOffer(s, p, rng);
    if (o) return { ...withNews({ ...s, seed: rng.seed, offers: [o], career: { ...s.career, agent } }, nw(s, 'agent-o', 'transfer', 'Tu representante consigue una oferta', `${o.teamName} quiere hablar contigo.`)) };
  }
  return withNews({ ...s, seed: rng.seed, career: { ...s.career, agent } }, nw(s, 'agent-n', 'system', 'Sin novedades', 'Tu representante no encontró nada por ahora.'));
}

/* ---------- Academia y pilotos jóvenes ---------- */
export function makeYouth(rng: Rng, season: number, id: string): Driver {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(30, 55)])) as Driver['stats'];
  return {
    id, name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, nationality: rng.pick(NATIONALITIES), birthYear: season - rng.int(15, 19),
    number: 60 + rng.int(0, 30), teamId: null, category: 'f4', stats, personality: 'humble', contract: null, fatigue: 0, injuryDays: 0, reputation: 20, potential: rng.int(55, 95),
  };
}
export const createYouth = (rng: Rng, season: number): Driver[] => Array.from({ length: 6 }, (_, i) => makeYouth(rng, season, `y${season}-${i}`));
export function peopleMonthly(s: GameState, rng: Rng): GameState {
  if (!s.ops.academy.length) return s;
  const academy = s.ops.academy.map((d) => {
    const stats = { ...d.stats }, cap = d.potential ?? 99;
    for (let i = 0; i < 2; i++) if (rng.next() < (cap / 100) * 0.6) { const k = rng.pick(STAT_KEYS); stats[k] = Math.max(stats[k], Math.min(cap, stats[k] + 1)); }
    return { ...d, stats };
  });
  return { ...s, ops: { ...s.ops, academy } };
}
export const peopleSeasonEnd = (s: GameState, rng: Rng): GameState => ({ ...s, youth: createYouth(rng, s.season) });

export function signYouth(s: GameState, id: string): GameState {
  const t = myTeam(s), y = s.youth.find((x) => x.id === id);
  if (s.mode !== 'principal' || !t || !y) return s;
  const refuse = (w: string) => withNews(s, nw(s, `yref-${id}`, 'system', 'Academia', w));
  if (s.ops.academy.length >= 3) return refuse('La academia está completa (3 plazas).');
  if (t.budget < 0.5) return refuse('Sin fondos para fichar al joven.');
  return withNews({ ...s, youth: s.youth.filter((x) => x.id !== id), teams: s.teams.map((x) => (x.id === t.id ? { ...x, budget: r2(x.budget - 0.5) } : x)),
    ops: { ...s.ops, academy: [...s.ops.academy, { ...y, teamId: t.id }] } }, nw(s, `ysign-${id}`, 'transfer', `${t.name} ficha a ${y.name}`, 'Entra en la academia del equipo.'));
}
export const releaseYouth = (s: GameState, id: string): GameState => ({ ...s, ops: { ...s.ops, academy: s.ops.academy.filter((x) => x.id !== id) } });
export function promoteYouth(s: GameState, id: string): GameState {
  const t = myTeam(s), y = s.ops.academy.find((x) => x.id === id);
  if (s.mode !== 'principal' || !t || !y) return s;
  const refuse = (w: string) => withNews(s, nw(s, `yp-${id}`, 'system', 'Ascenso no posible', w));
  if (roster(s, t.id).length >= 2) return refuse('Tu equipo ya tiene dos pilotos titulares.');
  if (s.season - y.birthYear < 18 || rating(y) < 60) return refuse(`${y.name} necesita 18 años y nivel 60 (tiene ${s.season - y.birthYear} años y nivel ${rating(y)}).`);
  const promoted: Driver = { ...y, category: 'f1', teamId: t.id, contract: { teamId: t.id, salary: asking(s, y), endSeason: s.season + 2 } };
  return withNews({ ...s, drivers: [...s.drivers, promoted], ops: { ...s.ops, academy: s.ops.academy.filter((x) => x.id !== id) } },
    nw(s, `ypro-${id}`, 'transfer', `${y.name} debuta en la F1 con ${t.name}`, 'Promovido desde la academia.'));
}
