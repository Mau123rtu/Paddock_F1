import type { GameState, NewsItem } from '../../types';
import { SCHEMA_VERSION } from '../gameEngine';
import { Rng } from '../../systems/rng';
import { newCareer } from '../../systems/extras';
import { initRivals } from '../../data/real';
import { defaultLife } from '../../systems/life';
import { createOps, createPool } from '../../systems/team';
import { newLegacy, initRegs } from '../../systems/legacy';
import { rating } from '../../systems/market';
import { buildCalendar } from '../../data/world';

const DB = 'f1-career-sim', STORE = 'saves';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Cadena de migraciones: añade aquí la migración de vN a vN+1 cuando cambie el esquema. */
const MIGRATIONS: Record<number, (s: GameState) => GameState> = {
  15: (s) => {
    // Calendario por categoría con circuitos reales y de rotación. Se conserva lo ya disputado (fechas pasadas) y se descarta una carrera pendiente del calendario antiguo.
    const calendar = buildCalendar(s.season, s.seed, false).map((e) => ({ ...e, done: e.date <= s.date }));
    return { ...s, calendar, pendingRace: null };
  },
  13: (s) => {
    // Novedades para partidas ya creadas: retiros pasados de la F1 (del Salón de la Fama).
    const have = new Set(s.news.map((n) => n.id));
    const past: NewsItem[] = s.legacy.hall.filter((h) => !h.player).map((h) => ({
      id: `retire-hall-${h.name}-${h.season}`, date: `${h.season + 1}-01-01`, category: 'transfer' as const, headline: `${h.name} anuncia su retirada de la F1`,
      body: `Deja la categoría a los ${h.age} años con ${h.titles} título(s) y ${h.wins} victoria(s).`, involved: [h.name],
    })).filter((n) => !have.has(n.id) && !s.news.some((o) => o.headline === n.headline));
    const news = [...s.news, ...past].sort((a, b) => b.date.localeCompare(a.date));
    return { ...s, news: news.slice(0, 500) };
  },
  14: (s) => ({ ...s, news: s.news.filter((n) => n.id !== 'upd-14') }),
  12: (s) => ({ ...s, legacy: { ...s.legacy, hier: 'even', ...initRegs(s.season) } }),
  11: (s) => { const p = s.drivers.find((d) => d.id === 'player'); return { ...s, legacy: newLegacy(s.season, true, p ? rating(p) : 0) }; },
  1: (s) => ({
    ...s, offers: [], career: newCareer(),
    drivers: s.drivers.map((d) => ({ ...d, fatigue: 0, injuryDays: 0, reputation: 40 })),
  }),
  10: (s) => ({ ...s, career: { ...s.career, skillPoints: 0, reserve: null } }),
  9: (s) => ({ ...s, lifeEvent: null, career: { ...s.career, camp: null, life: defaultLife() } }),
  8: (s) => ({ ...s, career: { ...s.career, stats: { ...s.career.stats, poles: 0 } } }),
  7: (s) => ({ ...s, rivals: initRivals(s.season, new Rng(s.seed)), rivalSeq: 1000, rumors: [], career: { ...s.career, history: [], stats: { wins: 0, podiums: 0, races: 0, dnfs: 0, poles: 0 }, objective: null } }),
  6: (s) => ({ ...s, alerts: [], career: { ...s.career, academy: null, candidacies: [], cooldown: {}, slPoints: [] } }),
  5: (s) => ({ ...s, application: null, principal: null, bonds: {}, youth: [], teams: s.teams.map((t) => ({ ...t, entered: true })), career: { ...s.career, agent: { hired: false, nextAsk: '' }, engineer: 'Marco Bellini' } }),
  4: (s) => ({ ...s, interview: null, career: { ...s.career, ...newCareer(), training: s.career.training, contract: s.career.contract, points: s.career.points, races: s.career.races }, ops: { ...s.ops, devSpent: 0, academy: [] } }),
  3: (s) => ({ ...s, pendingRace: null, results: [] }),
  2: (s) => {
    const rng = new Rng(s.seed);
    const team = s.teams.find((t) => t.id === s.player.teamId);
    return {
      ...s, teams: s.teams.map((t) => ({ ...t, carPerf: Math.round(40 + t.reputation * 0.5) })),
      ops: s.mode === 'principal' && team ? createOps(rng, team, s.season) : { staff: [], car: [], projects: [], sponsors: [], ledger: [], devSpent: 0, academy: [] },
      staffPool: createPool(rng, 12, 'st0'), sponsorOffers: [],
    };
  },
};
export function migrate(save: GameState): GameState {
  let s = save;
  while (s.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[s.schemaVersion];
    if (!step) throw new Error(`Sin migración desde v${s.schemaVersion}`);
    s = { ...step(s), schemaVersion: s.schemaVersion + 1 };
  }
  return s;
}

export const saveGame = (s: GameState) => run('readwrite', (st) => st.put(s));
export const deleteGame = (id: string) => run('readwrite', (st) => st.delete(id));
export const listGames = async () =>
  (await run<GameState[]>('readonly', (st) => st.getAll())).sort((a, b) => b.date.localeCompare(a.date));
export const loadGame = async (id: string) => {
  const s = await run<GameState | undefined>('readonly', (st) => st.get(id));
  return s ? migrate(s) : null;
};
