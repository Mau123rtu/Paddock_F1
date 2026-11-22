import type { GameState, Rival } from '../types';
import { PLAYER_ID, playerOf } from './career';
import { rating } from './market';

/** Quién es el piloto prioritario del equipo: 'me' = tú, 'mate' = tu compañero, 'even' = sin jerarquía clara. */
export type Hier = 'me' | 'even' | 'mate';
export interface TeamStanding { mate: string | null; favor: number; hier: Hier; myPts: number; matePts: number; myWins: number; mateWins: number; races: number; }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Histéresis: el estatus solo cambia cuando la diferencia es clara, para que no oscile carrera a carrera. */
export const hierFrom = (favor: number, prev: Hier): Hier => {
  if (prev === 'me') return favor < -0.3 ? 'mate' : favor < 0.12 ? 'even' : 'me';
  if (prev === 'mate') return favor > 0.3 ? 'me' : favor > -0.12 ? 'even' : 'mate';
  return favor >= 0.28 ? 'me' : favor <= -0.28 ? 'mate' : 'even';
};

const ratingOfName = (s: GameState, name: string): number | null => {
  const d = s.drivers.find((x) => x.name === name);
  if (d) return rating(d);
  return (Object.values(s.rivals).flat() as Rival[]).find((r) => r.name === name)?.rating ?? null;
};

/** Nombre del compañero de equipo del jugador (según el último resultado de su categoría). */
export function mateOf(s: GameState): string | null {
  const p = playerOf(s);
  if (!p || s.mode !== 'driver') return null;
  if (p.category === 'f1') return s.drivers.find((d) => d.teamId === p.teamId && d.id !== PLAYER_ID && d.category === 'f1')?.name ?? null;
  const r = [...s.results].reverse().find((x) => x.category === p.category && x.entries.some((e) => e.id === PLAYER_ID));
  const team = r?.entries.find((e) => e.id === PLAYER_ID)?.team ?? s.career.contract?.teamName;
  // en categorías inferiores hay equipos de 3 coches: el "compañero de referencia" es el de más nivel
  const mates = (s.rivals[p.category as Exclude<typeof p.category, 'f1'>] ?? []).filter((x) => x.team === team).sort((a, b) => b.rating - a.rating);
  return mates[0]?.name ?? r?.entries.find((e) => e.team === team && e.id !== PLAYER_ID)?.name ?? null;
}

/**
 * Favoritismo del equipo hacia ti, de −1 (favorecen a tu compañero) a +1 (te favorecen a ti).
 * Se calcula con los puntos y victorias de esta temporada (y algo de la anterior), el nivel de ambos y,
 * al principio del año, con una estimación previa: así la jerarquía cambia con los resultados.
 */
export function teamFavor(s: GameState, mateName?: string | null, prev: Hier = s.legacy?.hier ?? 'even'): TeamStanding {
  const p = playerOf(s), mate = mateName === undefined ? mateOf(s) : mateName;
  const none: TeamStanding = { mate, favor: 0, hier: 'even', myPts: 0, matePts: 0, myWins: 0, mateWins: 0, races: 0 };
  if (!p || !mate || s.mode !== 'driver') return none;
  const rs = s.results.filter((r) => r.category === p.category && r.entries.some((e) => e.id === PLAYER_ID));
  const myTeam = [...rs].reverse()[0]?.entries.find((e) => e.id === PLAYER_ID)?.team;
  let myPts = 0, matePts = 0, myWins = 0, mateWins = 0, races = 0;
  for (const r of rs) {
    const w = r.season === s.season ? 1 : r.season === s.season - 1 ? 0.4 : 0;
    if (!w) continue;
    const me = r.entries.find((e) => e.id === PLAYER_ID), m = r.entries.find((e) => e.name === mate);
    if (!me || !m || me.team !== m.team || (r.season !== s.season && me.team !== myTeam)) continue;
    myPts += w * me.pts; matePts += w * m.pts;
    if (me.status === 'finished' && me.pos === 1) myWins += w;
    if (m.status === 'finished' && m.pos === 1) mateWins += w;
    if (r.season === s.season) races++;
  }
  const rm = ratingOfName(s, mate) ?? rating(p), rd = clamp((rating(p) - rm) / 20, -1, 1);
  const prior = clamp(rd * 0.8 - (s.career.history.length === 0 || s.career.history[s.career.history.length - 1].team !== myTeam ? 0.15 : 0), -1, 1);
  const share = (myPts - matePts) / Math.max(8, myPts + matePts), wins = clamp((myWins - mateWins) / 3, -1, 1);
  const data = clamp(0.6 * share + 0.4 * wins, -1, 1), trust = clamp(races / 4, 0, 1);
  const favor = clamp(trust * (0.85 * data + 0.15 * rd) + (1 - trust) * prior, -1, 1);
  return { mate, favor, hier: hierFrom(favor, prev), myPts: Math.round(myPts), matePts: Math.round(matePts), myWins: Math.round(myWins), mateWins: Math.round(mateWins), races };
}

export const hierLabel = (h: Hier) => (h === 'me' ? 'Eres el piloto prioritario' : h === 'mate' ? 'Tu compañero es el prioritario' : 'Sin jerarquía clara');

/* ───────────── Decisión de órdenes en carrera ───────────── */
export interface OrderCtx {
  favor: number;          // −1..+1 (a tu favor)
  lapsLeft: number;
  meAhead: boolean;       // tú vas por delante de tu compañero
  gap: number;            // segundos entre ambos
  paceEdge: number;       // s/vuelta que el de atrás es más rápido que el de delante (negativo = más lento)
  gapAheadOfFront: number | null; // s del de delante de los dos hasta el coche que tiene delante (null = lidera)
  frontPos: number;       // posición del más adelantado de los dos
  mate: string;
}
export type OrderPlan =
  | { kind: 'none' }
  | { kind: 'swap-me'; text: string }      // te piden dejar pasar (puedes aceptar o rechazar)
  | { kind: 'hold-me'; text: string }      // te piden no atacar / mantener posiciones (puedes aceptar o rechazar)
  | { kind: 'yield-mate'; text: string; refuseP: number }  // le piden a tu compañero que te deje pasar (te lo comunican)
  | { kind: 'hold-mate'; text: string };   // le ordenan a tu compañero no atacarte (te lo comunican)

/**
 * Órdenes realistas: solo existen si tu compañero está cerca, hay carrera por delante y hay algo que ganar.
 * Quien va peor en la jerarquía del equipo es quien cede, y el equipo nunca pide dejar pasar a un coche lejano o último.
 */
export function decideOrder(c: OrderCtx): OrderPlan {
  if (c.gap > 3 || c.lapsLeft < 5) return { kind: 'none' };
  const fm = c.favor, near = c.gap <= 2.2, fast = c.paceEdge >= 0.25, evenOk = Math.abs(fm) <= 0.15;
  if (c.meAhead) {
    // tu compañero va detrás de ti
    if (near && fast && c.lapsLeft >= 8) {
      const target = c.gapAheadOfFront !== null && c.gapAheadOfFront <= 6;
      if (-fm > 0.15 && (target || -fm > 0.5)) return { kind: 'swap-me', text: `El equipo te pide que dejes pasar a ${c.mate}: va más rápido, es el piloto prioritario y puede atacar al coche de delante.` };
      if (evenOk && c.paceEdge >= 0.6 && target) return { kind: 'swap-me', text: `El equipo te pide que dejes pasar a ${c.mate}: tiene un ritmo claramente mejor y hay un coche al que cazar.` };
      if (fm > 0.15) return { kind: 'hold-mate', text: `Mensaje de equipo: a ${c.mate} le ordenan mantener la posición y no atacarte. Te consideran prioritario.` };
    }
    if (c.gap < 1.5 && c.frontPos <= 8 && !fast) return { kind: 'hold-me', text: `El equipo pide mantener posiciones con ${c.mate} para asegurar los puntos y evitar un toque.` };
    return { kind: 'none' };
  }
  // tu compañero va delante de ti
  if (near && fast) {
    if (fm > 0.15 || (evenOk && c.paceEdge >= 0.6)) return { kind: 'yield-mate', refuseP: fm > 0.4 ? 0.1 : 0.25, text: `El equipo pide a ${c.mate} que te deje pasar: vas más rápido${fm > 0.15 ? ' y eres el piloto prioritario' : ''}.` };
    if (fm < -0.15) return { kind: 'hold-me', text: `El equipo te pide no atacar a ${c.mate}: es el piloto prioritario y asegurar el doblete es lo importante.` };
  }
  if (c.gap < 1.5 && c.frontPos <= 8) return { kind: 'hold-me', text: `El equipo pide mantener posiciones con ${c.mate}: no arriesguéis un toque entre compañeros.` };
  return { kind: 'none' };
}

/** Efecto deportivo de la jerarquía: el piloto prioritario recibe antes las mejoras del coche (±1,5 puntos de coche). */
export const favorCarBonus = (favor: number) => Math.round(clamp(favor, -1, 1) * 1.5);
