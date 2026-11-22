import type { Category, Compound, GameState, NewsItem, RaceEntry, RaceResult, StatKey } from '../types';
import { Rng } from './rng';
import { eventHasCat } from '../data/circuits';
import { favorCarBonus, teamFavor } from './orders';
import { JUNIOR, teamStrength } from '../data/real';
import { STAT_KEYS, STAT_LABELS } from '../types';
import { PLAYER_ID, POINTS, ageFactor, makeOffer } from './career';
import { rating } from './market';
import { dm } from './difficulty';
import { friends, principalBonds, raceBonds } from './people';
import { idealSetup, makeInterview, setupBonus } from './extras';

export interface Participant {
  adapt: number; over: number;
  id: string; name: string; team: string; color: string; number: number; mine: boolean;
  driverRating: number; carPerf: number; reliability: number; tyreMgmt: number; focus: number; consistency: number;
}
export type Mode = 'push' | 'normal' | 'save';
export interface Plan { start: Compound; stopLap: number; next: Compound; }
export type Decision = { lap: number; id: string } & (
  | { kind: 'pit'; compound: Compound; delta?: number } | { kind: 'attack' } | { kind: 'mode'; mode: Mode }
  | { kind: 'orders'; hold: boolean } | { kind: 'swap' } | { kind: 'retire' });
export interface Weather { chance: number; rainStart: number; rainEnd: number; }
export interface Trace { id: string; cum: number[]; lapTimes: number[]; tyres: Compound[]; ages: number[]; dmgs: number[]; out: boolean; best: number; stops: number; }
export interface RaceSim {
  laps: number; traces: Trace[]; events: { lap: number; text: string }[]; scLaps: number[]; vscLaps: number[]; redLaps: number[];
  weather: Weather; result: RaceEntry[]; total: number;
}

export const LAPS: Record<Category, number> = { karting: 10, f4: 12, f3: 14, f2: 16, f1: 20 };
const PRIZE = [6, 4.5, 3.5, 3, 2.5, 2, 1.5, 1, 0.8, 0.5];
const COLORS = ['#e8002d', '#00a3e0', '#f2a900', '#6ac04a', '#b36cff', '#ff7a45', '#2ec4b6', '#c9c9c9', '#f25fa6', '#9bd13c', '#4f7cff', '#e0c341'];
export const TYRE: Record<Compound, { p: number; d: number; wear: number }> = {
  S: { p: -0.7, d: 0.11, wear: 7 }, M: { p: 0, d: 0.06, wear: 4 }, H: { p: 0.5, d: 0.035, wear: 2.5 }, W: { p: 0, d: 0.03, wear: 3 },
};
const COMPS: Compound[] = ['S', 'M', 'H'];

/** Parrilla de una categoría. F1: pilotos reales del mundo; resto: rivales persistentes. withPlayer=false simula la carrera sin ti. */
/** Variación de forma determinista por temporada (sin guardar estado): un piloto o un coche rinde algo mejor o peor cada año. */
export function seasonForm(key: string, season: number, amp: number): number {
  let h = 2166136261;
  for (const ch of `${key}|${season}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((((h >>> 0) % 1000) / 999) * 2 - 1) * amp;
}
export function buildCategoryField(s: GameState, cat: Category, evIdx: number, withPlayer: boolean): Participant[] {
  const bonus = setupBonus(s.career.setup, idealSetup(evIdx));
  const me = s.drivers.find((d) => d.id === PLAYER_ID);
  if (cat === 'f1') {
    return s.drivers.filter((d) => d.category === 'f1' && d.teamId && (withPlayer || d.id !== PLAYER_ID) && s.teams.find((x) => x.id === d.teamId)?.entered !== false).map((d) => {
      const t = s.teams.find((x) => x.id === d.teamId) ?? s.teams[0];
      const own = s.mode === 'principal' && t.id === s.player.teamId && s.ops.car.length > 0;
      const rel = own ? s.ops.car.reduce((a, c) => a + c.reliability, 0) / s.ops.car.length : 78;
      return {
        id: d.id, name: d.name, team: t.name, color: t.color, number: d.number, driverRating: rating(d) + (d.id === PLAYER_ID ? 0 : seasonForm(d.name, s.season, 1.6)),
        carPerf: t.carPerf + seasonForm(t.id, s.season, 1.6) + (s.mode === 'driver' && d.id === PLAYER_ID ? bonus : 0), reliability: rel,
        tyreMgmt: d.stats.tyreManagement, focus: d.stats.focus, consistency: d.stats.consistency, adapt: d.stats.adaptability, over: d.stats.overtaking,
        mine: withPlayer && (s.mode === 'driver' ? d.id === PLAYER_ID : t.id === s.player.teamId),
      };
    });
  }
  const jc = cat as Exclude<Category, 'f1'>, teams = JUNIOR[jc];
  let rivals = s.rivals[jc];
  const teamName = s.career.contract?.teamName;
  if (withPlayer && me && me.category === jc && teamName) {
    const mates = rivals.filter((r) => r.team === teamName).sort((a, b) => a.rating - b.rating);
    if (mates.length) rivals = rivals.filter((r) => r.id !== mates[0].id);
  }
  const field: Participant[] = [];
  if (withPlayer && me && me.category === jc) {
    const i = teamName ? teams.indexOf(teamName) : -1;
    field.push({
      id: me.id, name: me.name, team: teamName ?? 'Independiente', color: COLORS[0], number: me.number, mine: true, driverRating: rating(me),
      carPerf: (i >= 0 ? teamStrength(jc, i, teams.length) : teamStrength(jc, teams.length - 1, teams.length) - 6) + bonus,
      reliability: 85, tyreMgmt: me.stats.tyreManagement, focus: me.stats.focus, consistency: me.stats.consistency, adapt: me.stats.adaptability, over: me.stats.overtaking,
    });
  }
  rivals.forEach((r, n) => {
    const ti = Math.max(0, teams.indexOf(r.team));
    field.push({
      id: r.id, name: r.name, team: r.team, color: COLORS[(ti + 1) % COLORS.length], number: n + 2, mine: false, driverRating: r.rating,
      carPerf: teamStrength(jc, ti, teams.length), reliability: 70 + ((r.birthYear * 7 + r.rating) % 21),
      tyreMgmt: 40 + ((r.rating * 3) % 40), focus: 40 + ((r.rating * 5) % 40), consistency: 40 + ((r.rating * 7) % 40), adapt: 40 + ((r.rating * 11) % 40), over: 40 + ((r.rating * 13) % 40),
    });
  });
  return field;
}
export function buildField(s: GameState, _rng: Rng, evIdx = 0): Participant[] {
  const me = s.drivers.find((d) => d.id === PLAYER_ID);
  const cat: Category = s.mode === 'principal' || !me ? 'f1' : me.category;
  const field = buildCategoryField(s, cat, evIdx, true);
  if (s.mode !== 'driver' || !me || me.category !== cat) return field;
  const st = teamFavor(s), b = favorCarBonus(st.favor);
  if (!st.mate || !b) return field;
  return field.map((p) => (p.mine ? { ...p, carPerf: p.carPerf + b } : p.name === st.mate ? { ...p, carPerf: p.carPerf - b } : p));
}

export function qualify(parts: Participant[], rng: Rng): { id: string; time: number }[] {
  return parts.map((p) => ({ id: p.id, time: 95 - ((p.driverRating + p.carPerf) / 2) * 0.12 - 0.5 + (rng.next() - 0.5) * 0.9 * (1.4 - p.consistency / 100) }))
    .sort((a, b) => a.time - b.time);
}
export function defaultPlan(rng: Rng, laps: number): Plan {
  const start = rng.pick(COMPS);
  return { start, stopLap: rng.int(Math.floor(laps * 0.35), Math.floor(laps * 0.65)), next: rng.pick(COMPS.filter((c) => c !== start)) };
}

const hash = (a: number, b: number, c: number) => (a ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b)) | 0;
const MODE: Record<Mode, { pace: number; deg: number; risk: number }> = {
  push: { pace: -0.35, deg: 1.4, risk: 1.5 }, normal: { pace: 0, deg: 1, risk: 1 }, save: { pace: 0.45, deg: 0.6, risk: 0.6 },
};
export function makeWeather(rng: Rng, laps: number): Weather {
  const chance = rng.int(5, 60), rain = rng.next() < chance / 100, start = rng.int(3, Math.max(3, laps - 6));
  return { chance, rainStart: rain ? start : 0, rainEnd: rain ? Math.min(laps, start + rng.int(4, 8)) : 0 };
}

/**
 * Simula la carrera completa vuelta a vuelta. Cada coche y vuelta usa su propia semilla, así que las vueltas anteriores
 * a una decisión salen idénticas al re-simular: el jugador pausa, decide, y solo cambia el futuro.
 */
export function simulateRace(parts: Participant[], grid: string[], plans0: Record<string, Plan>, laps: number, base: number, weather: Weather, decisions: Decision[], starts: Record<string, number> = {}): RaceSim {
  const plans: Record<string, Plan> = Object.fromEntries(Object.entries(plans0).map(([k, v]) => [k, { ...v }]));
  const cars = parts.map((p, idx) => ({
    p, idx, cur: plans[p.id].start, age: 0, alive: true, yieldNow: false, pitDelta: 0, attackNow: false, cause: undefined as RaceEntry['cause'], stops: 0, best: Infinity, mode: 'normal' as Mode, hold: false, retire: false, dmg: 0,
    pitNow: null as Compound | null,
    t: { id: p.id, cum: [grid.indexOf(p.id) * 0.35 + (starts[p.id] ?? 0)], lapTimes: [], tyres: [], ages: [], dmgs: [], out: false, best: 0, stops: 0 } as Trace,
  }));
  const events: RaceSim['events'] = [], scLaps: number[] = [], vscLaps: number[] = [], redLaps: number[] = [];
  let scLeft = 0, vscLeft = 0;
  for (let lap = 1; lap <= laps; lap++) {
    const wet = weather.rainStart > 0 && lap >= weather.rainStart && lap <= weather.rainEnd;
    if (lap === weather.rainStart) events.push({ lap, text: 'Empieza a llover' });
    if (weather.rainStart > 0 && lap === weather.rainEnd + 1) events.push({ lap, text: 'Deja de llover; la pista se seca' });
    const sc = scLeft > 0, vsc = vscLeft > 0;
    if (sc) scLaps.push(lap);
    if (vsc) vscLaps.push(lap);
    for (const d of decisions) {
      if (d.lap !== lap) continue;
      const car = cars.find((c) => c.p.id === d.id);
      if (!car) continue;
      if (d.kind === 'pit') { car.pitNow = d.compound; car.pitDelta = d.delta ?? 0; }
      else if (d.kind === 'attack') car.attackNow = true;
      else if (d.kind === 'mode') car.mode = d.mode;
      else if (d.kind === 'retire') car.retire = true;
      else if (d.kind === 'swap') car.yieldNow = true;
      else cars.filter((c) => c.p.team === car.p.team).forEach((c) => { c.hold = d.hold; });
    }
    let newSc = false, newVsc = false, newRed = false;
    const front = new Map<string, number>();
    const run = cars.filter((c) => c.alive).sort((a, b) => a.t.cum[a.t.cum.length - 1] - b.t.cum[b.t.cum.length - 1]);
    run.forEach((c, i) => { if (i > 0) front.set(c.p.id, c.t.cum[c.t.cum.length - 1] - run[i - 1].t.cum[run[i - 1].t.cum.length - 1]); });
    for (const c of cars) {
      const rg = new Rng(hash(base, lap, c.idx));
      const noise = rg.next(), r = rg.next(), r2 = rg.next(), r3 = rg.next(), r4 = rg.next();
      if (!c.alive) continue;
      const p = c.p, plan = plans[p.id];
      if (c.retire) { c.alive = false; c.cause = 'retired'; events.push({ lap, text: `${p.name} se retira de la carrera` }); continue; }
      if (!p.mine) {
        if (wet && lap === weather.rainStart + 1 && c.cur !== 'W' && r3 < 0.8) c.pitNow = 'W';
        if (weather.rainStart > 0 && lap === weather.rainEnd + 1 && c.cur === 'W') c.pitNow = 'M';
      }
      const base0 = 95 - ((p.driverRating + p.carPerf) / 2) * 0.12;
      const loss = sc ? 11 : vsc ? 15 : 22;
      let pitLoss = 0;
      if (c.pitNow) { c.cur = c.pitNow; c.age = 0; c.stops++; pitLoss = loss + c.pitDelta; c.pitDelta = 0; events.push({ lap, text: `${p.name} entra a boxes (${c.cur})` }); c.pitNow = null; }
      c.age++;
      c.t.tyres.push(c.cur); c.t.ages.push(c.age); c.t.dmgs.push(c.dmg);
      const M = MODE[c.mode];
      const atk = c.attackNow; c.attackNow = false;
      const gap = front.get(p.id) ?? 9;
      const dirty = sc || vsc ? 0 : gap < 1 ? (1 - gap) * 0.3 * (1 - p.over / 150) : 0;
      const tyreP = c.cur === 'W' ? (wet ? 0 : 6) : wet ? 9 : TYRE[c.cur].p;
      const dr = c.cur === 'W' && !wet ? 0.25 : TYRE[c.cur].d;
      let lt = base0 + tyreP + dr * c.age * M.deg * (1 + (100 - p.tyreMgmt) / 200) + 0.03 * (laps - lap) + M.pace + c.dmg
        + (noise - 0.5) * 0.8 * (1.4 - p.consistency / 100) + (wet ? 6 - p.adapt / 40 : 0) + dirty - (atk ? 0.6 : 0);
      if (sc) lt = base0 * 1.35; else if (vsc) lt *= 1.25;
      if (!sc) {
        const crash = 0.004 * (1 + (100 - p.focus) / 100) * M.risk * (atk ? 2 : 1) * (wet ? (c.cur === 'W' ? 1.5 : 3) : 1);
        const mech = ((100 - p.reliability) / 100) * 0.012 * (c.mode === 'push' ? 1.4 : 1);
        if (r < crash) {
          if (r2 < 0.35) { c.dmg += 0.3 + r3 * 0.5; events.push({ lap, text: `${p.name} sufre daños leves tras un toque` }); }
          else {
            c.alive = false; c.cause = 'accident'; events.push({ lap, text: `${p.name} sufre un accidente` });
            if (r3 < 0.5) newSc = true; else if (r3 > 0.92) newRed = true;
            continue;
          }
        } else if (r < crash + mech) {
          c.alive = false; c.cause = 'mechanical'; events.push({ lap, text: `${p.name} abandona por una avería` });
          if (r2 < 0.4) newVsc = true;
          continue;
        }
      }
      if (c.yieldNow) { lt += 3; c.yieldNow = false; events.push({ lap, text: `${p.name} deja pasar a su compañero por órdenes del equipo` }); }
      if (!sc && !vsc && r4 > (c.mode === 'push' ? 0.985 : 0.997)) { lt += 5; events.push({ lap, text: `Sanción de 5 s para ${p.name} por conducción peligrosa` }); }
      lt += pitLoss;
      if (pitLoss === 0 && c.stops === 0 && lap === plan.stopLap && lap < laps) {
        lt += loss; c.cur = plan.next; c.age = 0; c.stops++; events.push({ lap, text: `${p.name} entra a boxes (${plan.next})` });
      } else if (!sc && pitLoss === 0) c.best = Math.min(c.best, lt);
      c.t.lapTimes.push(lt); c.t.cum.push(c.t.cum[c.t.cum.length - 1] + lt);
    }
    const live = () => cars.filter((c) => c.alive).sort((a, b) => a.t.cum[lap] - b.t.cum[lap]);
    if (!sc && !vsc) {
      const roll = new Rng(hash(base, lap, 9999)).next();
      const order = live();
      for (const team of new Set(order.filter((c) => c.p.mine).map((c) => c.p.team))) {
        const mates = order.filter((c) => c.p.team === team);
        if (mates.length < 2) continue;
        const [a, b] = mates;
        if (a.hold) { if (b.t.cum[lap] < a.t.cum[lap] + 0.3) b.t.cum[lap] = a.t.cum[lap] + 0.3; }
        else if (b.t.cum[lap] - a.t.cum[lap] < 0.4 && roll < 0.03) { b.t.cum[lap] += 6; events.push({ lap, text: `Contacto entre compañeros de ${team}: ${b.p.name} pierde tiempo` }); }
      }
    }
    if (sc) {
      const l = live();
      l.forEach((c, i) => { c.t.cum[lap] = l[0].t.cum[lap] + i * 0.8; });
      scLeft--;
      if (scLeft === 0) events.push({ lap, text: 'La Safety Car vuelve a boxes' });
    }
    if (vsc) { vscLeft--; if (vscLeft === 0) events.push({ lap, text: 'Fin del Virtual Safety Car' }); }
    if (newRed) {
      redLaps.push(lap);
      const l = live();
      l.forEach((c, i) => { c.t.cum[lap] = l[0].t.cum[lap] + i; c.age = 0; if (!c.p.mine && wet && c.cur !== 'W') c.cur = 'W'; });
      events.push({ lap, text: 'Bandera roja: carrera suspendida; se reanuda con neumáticos nuevos' });
    } else if (newSc && scLeft === 0) { scLeft = 3; events.push({ lap, text: 'Safety Car en pista' }); }
    else if (newVsc && vscLeft === 0 && scLeft === 0) { vscLeft = 2; events.push({ lap, text: 'Virtual Safety Car' }); }
  }
  const fin = cars.filter((c) => c.alive).sort((a, b) => a.t.cum[laps] - b.t.cum[laps]);
  const dnf = cars.filter((c) => !c.alive).sort((a, b) => b.t.cum.length - a.t.cum.length);
  const result: RaceEntry[] = [...fin, ...dnf].map((c, i) => ({
    id: c.p.id, name: c.p.name, team: c.p.team, color: c.p.color, pos: i + 1, pts: c.alive ? POINTS[i] ?? 0 : 0,
    status: c.alive ? 'finished' : 'dnf', cause: c.cause, best: Number.isFinite(c.best) ? Math.round(c.best * 1000) / 1000 : 0, stops: c.stops,
  }));
  cars.forEach((c) => { c.t.out = !c.alive; c.t.stops = c.stops; c.t.best = c.best; });
  return { laps, traces: cars.map((c) => c.t), events, scLaps, vscLaps, redLaps, weather, result, total: fin.length ? fin[fin.length - 1].t.cum[laps] : 0 };
}

/** Sanciones de la carrera convertidas en noticia (máx. 2 por carrera para no saturar). */
function penaltyNews(result: RaceResult, date: string): NewsItem[] {
  return (result.penalties ?? []).slice(0, 2).map((text, i) => {
    const who = result.entries.find((e) => text.includes(e.name));
    return { id: `pen${i}-${result.id}`, date, category: 'race' as const, headline: who ? `Sanción para ${who.name} en ${result.name}` : `Sanción en ${result.name}`,
      body: `${text}.`, involved: who ? [who.name, who.team] : [] };
  });
}

/** Aplica el resultado: clasificación, noticias, carrera del piloto (puntos, reputación, fatiga, ojeadores) y premios del equipo. */
export function finishRace(s: GameState, result: RaceResult): GameState {
  if (!s.pendingRace) return s;
  const rng = new Rng(s.seed);
  const mine = (e: RaceEntry) => (s.mode === 'driver' ? e.id === PLAYER_ID : s.drivers.find((d) => d.id === e.id)?.teamId === s.player.teamId);
  const mk = (id: string, category: NewsItem['category'], headline: string, body: string, involved: string[]): NewsItem =>
    ({ id: `${id}-${result.id}`, date: s.date, category, headline, body, involved });
  const out: NewsItem[] = [...penaltyNews(result, s.date)];
  const w = result.entries[0];
  if (w) out.push(mk('win', 'race', `${w.name} gana ${result.name}`, `${w.team} se lleva la victoria.`, [w.name, w.team]));
  let st: GameState = { ...s, calendar: s.calendar.map((e) => (e.id === s.pendingRace ? { ...e, done: true } : e)), pendingRace: null, results: [...s.results, result].slice(-400) };
  const me = st.drivers.find((d) => d.id === PLAYER_ID);
  const my = result.entries.find((e) => e.id === PLAYER_ID);
  if (s.mode === 'driver' && me && my) {
    const rep = Math.min(100, Math.max(0, me.reputation + (my.pos <= 3 ? 3 : my.pos <= 6 ? 1 : my.pos > 9 ? -1 : 0)));
    const age = s.season - me.birthYear, learn = age <= 19 ? 0.75 : age <= 23 ? 0.5 : 0.3;
    const grow: Partial<Record<StatKey, number>> = {}, stats = { ...me.stats };
    const up = (k: StatKey) => { stats[k] = Math.min(99, stats[k] + 1); grow[k] = (grow[k] ?? 0) + 1; };
    if (rng.next() < 0.9) up('experience');
    if (rng.next() < learn + (my.pos <= 3 ? 0.2 : 0)) up(rng.pick(STAT_KEYS.filter((k) => k !== 'experience')));
    const gains = (Object.entries(grow) as [StatKey, number][]).map(([k, v]) => `${STAT_LABELS[k]} +${v}`).join(', ');
    out.push(mk('me', 'race', my.status === 'dnf' ? 'Abandonas' : `Terminas P${my.pos}`, `${result.name}: ${my.pts} puntos.${gains ? ` Mejoras: ${gains}.` : ''}`, [s.player.name]));
    st = { ...st, career: { ...st.career, points: st.career.points + my.pts, races: st.career.races + 1, life: { ...st.career.life, mood: Math.min(100, Math.max(0, st.career.life.mood + (my.status === 'dnf' ? -4 : my.pos <= 3 ? 4 : my.pos > 10 ? -2 : 0))) }, stats: { wins: st.career.stats.wins + (my.pos === 1 && my.status === 'finished' ? 1 : 0), podiums: st.career.stats.podiums + (my.pos <= 3 && my.status === 'finished' ? 1 : 0), races: st.career.stats.races + 1, dnfs: st.career.stats.dnfs + (my.status === 'dnf' ? 1 : 0), poles: st.career.stats.poles + (result.pole === PLAYER_ID ? 1 : 0) }, popularity: Math.min(100, st.career.popularity + (my.pos === 1 ? 6 : my.pos <= 3 ? 3 : my.pos <= 6 ? 1 : 0)) },
      drivers: st.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, reputation: rep, fatigue: Math.min(100, d.fatigue + 10), stats } : d)) };
    const ord = result.orders;
    if (ord && (ord.accepted || ord.rejected)) {
      const t0 = st.career.relations.team;
      st = { ...st, career: { ...st.career, relations: { ...st.career.relations, team: Math.min(100, Math.max(0, t0 + 2 * ord.accepted - 6 * ord.rejected)) } } };
      out.push(ord.rejected ? mk('ordno', 'race', 'Ignoras las órdenes del equipo', 'Tu relación con el equipo empeora.', [s.player.name]) : mk('ordok', 'race', 'Obedeces las órdenes del equipo', 'Tu relación con el equipo mejora.', [s.player.name]));
    }
    if (result.pole === PLAYER_ID) out.push(mk('pole', 'race', 'Pole position', `Saliste primero en ${result.name}.`, [s.player.name]));
    if (my.cause === 'accident' && rng.next() < 0.3) {
      const days = rng.int(7, 30);
      st = { ...st, drivers: st.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, injuryDays: days } : d)), career: { ...st.career, training: null } };
      out.push(mk('crashinj', 'system', 'Lesión tras el accidente', `Estarás ${days} días de baja.`, [s.player.name]));
    }
    if (my.pos <= 3 && st.offers.length === 0 && rng.next() < 0.3 * dm(st).scout * (1 + 0.25 * friends(st)) * (st.career.agent.hired ? 1.3 : 1) * ageFactor(st, me)) {
      const o = makeOffer(st, me, rng);
      if (o) { st = { ...st, offers: [o] }; out.push(mk('scout', 'transfer', `${o.teamName} te contacta`, o.academy ? `Quieren que entres en ${o.academy}.` : 'Quieren ficharte para su equipo.', [o.teamName, s.player.name])); }
    }
  }
  if (s.mode === 'principal' && result.entries.some(mine)) {
    const prize = result.entries.filter(mine).reduce((a, e) => a + (PRIZE[e.pos - 1] ?? 0), 0);
    const pts = result.entries.filter(mine).reduce((a, e) => a + e.pts, 0);
    st = { ...st, teams: st.teams.map((t) => (t.id === s.player.teamId ? { ...t, budget: Math.round((t.budget + prize) * 100) / 100 } : t)) };
    out.push(mk('team', 'race', `Tu equipo suma ${pts} puntos`, `Premios de carrera: ${prize} M.`, [s.player.name]));
  }
  st = s.mode === 'driver' ? raceBonds(st, result) : principalBonds(st, result);
  const near = my ? result.entries.filter((e) => e.id !== PLAYER_ID && Math.abs(e.pos - my.pos) <= 2).map((e) => e.name) : [];
  return { ...st, interview: s.mode === 'driver' && my && rng.next() < (my.status === 'dnf' ? 0.7 : my.pos === 1 ? 1 : my.pos <= 3 ? 0.8 : 0.35) ? makeInterview(my, result.name, near, rng, me?.personality ?? 'professional') : null, seed: rng.seed, news: [...out, ...st.news].slice(0, 500) };
}

/** Carrera sin intervención del jugador (por ejemplo, un equipo aún no admitido en la F1): se simula y se aplica el resultado. */
export function autoRace(s: GameState): GameState {
  const ev = s.calendar.find((e) => e.id === s.pendingRace);
  if (!ev) return s;
  const me0 = s.drivers.find((d) => d.id === PLAYER_ID), cat0: Category = s.mode === 'principal' || !me0 ? 'f1' : me0.category;
  const idx = ev.cn, base = s.seed ^ (idx * 7919), laps = LAPS[cat0];
  const parts = buildField(s, new Rng(base), idx), quali = qualify(parts, new Rng(base + 1));
  const r = new Rng(base + 2);
  const plans = Object.fromEntries(parts.map((p) => [p.id, defaultPlan(r, laps)]));
  const sim = simulateRace(parts, quali.map((q) => q.id), plans, laps, base, makeWeather(new Rng(base + 4), laps), []);
  return finishRace(s, { id: `${s.season}-${ev.id}`, season: s.season, date: s.date, name: ev.name, category: cat0, entries: sim.result, pole: quali[0]?.id, penalties: sim.events.filter((e) => e.text.startsWith('Sanción')).map((e) => e.text) });
}

/** Simula en segundo plano las demás categorías el mismo día de carrera, para tener sus clasificaciones. */
export function simulateOthers(s: GameState, evId: string): GameState {
  const ev = s.calendar.find((e) => e.id === evId);
  if (!ev) return s;
  const idx = ev.cn, me = s.drivers.find((d) => d.id === PLAYER_ID);
  const interactive: Category | null = s.pendingRace === evId ? (s.mode === 'driver' ? me?.category ?? null : 'f1') : null;
  const out: RaceResult[] = [], pen: NewsItem[] = [];
  for (const cat of ['karting', 'f4', 'f3', 'f2', 'f1'] as Category[]) {
    if (!eventHasCat(ev, cat) || cat === interactive || s.results.some((r) => r.date === s.date && r.category === cat)) continue;
    const base = s.seed ^ (idx * 7919) ^ (cat.length * 131) ^ cat.charCodeAt(1), laps = LAPS[cat];
    const parts = buildCategoryField(s, cat, idx, false);
    if (parts.length < 2) continue;
    const quali = qualify(parts, new Rng(base + 1)), r = new Rng(base + 2);
    const plans = Object.fromEntries(parts.map((p) => [p.id, defaultPlan(r, laps)]));
    const sim = simulateRace(parts, quali.map((q) => q.id), plans, laps, base, makeWeather(new Rng(base + 4), laps), []);
    out.push({ id: `${s.season}-${ev.id}-${cat}`, season: s.season, date: s.date, name: ev.name, category: cat, entries: sim.result, pole: quali[0]?.id });
    if (cat === 'f1') pen.push(...penaltyNews({ ...out[out.length - 1], penalties: sim.events.filter((e) => e.text.startsWith('Sanción')).map((e) => e.text) }, s.date));
  }
  return { ...s, results: [...s.results, ...out].slice(-400), news: [...pen, ...s.news] };
}

export type QMode = 'normal' | 'push' | 'risk';
const QTYRE: Record<Compound, number> = { S: -0.25, M: 0, H: 0.3, W: 0 };
/** Una vuelta lanzada de clasificación. Mojado: todos son más lentos y solo el neumático de lluvia funciona. null = vuelta anulada. */
export function qualiAttempt(p: Participant, tyre: Compound, mode: QMode, seed: number, confidenceRuns: number, fatigue: number, wet = false, damage = 0): number | null {
  const r = new Rng(seed ^ (p.number * 7919));
  const pace = 95 - ((p.driverRating + p.carPerf) / 2) * 0.12 - 0.5;
  const risk = { normal: 0.02, push: 0.08, risk: 0.2 }[mode] * (wet ? (tyre === 'W' ? 1.5 : 3) : 1), delta = { normal: 0.15, push: 0, risk: -0.2 }[mode];
  const surface = (wet ? 6 : 0) + (wet ? (tyre === 'W' ? 0 : 9) : tyre === 'W' ? 6 : 0);
  let t = pace + surface + QTYRE[tyre] + delta + (r.next() - 0.5) * 0.9 * (1.4 - p.consistency / 100) - confidenceRuns * 0.06 + fatigue * 0.004 + damage;
  if (r.next() < risk) { if (r.next() < 0.35) return null; t += 0.5 + r.next(); }
  return Math.round(t * 1000) / 1000;
}
/** Tiempo de prácticas con combustible de carrera; cuantas más tandas, menos ruido en la estimación. */
export function practiceTime(p: Participant, seed: number, runs: number): number {
  const r = new Rng(seed ^ (p.number * 104729));
  return 95 - ((p.driverRating + p.carPerf) / 2) * 0.12 + 0.9 + ((r.next() - 0.5) * 0.8) / (1 + runs * 0.2);
}
