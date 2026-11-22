import type { Category, Difficulty, GameState, NewGameSetup, Stats } from '../types';
import { STAT_KEYS } from '../types';
import { createGame, fpAuto, reduce } from '../services/gameEngine';
import { autoRace } from './race';
import { CATEGORIES, ageOf, playerOf } from './career';

export interface BotRun { final: Category; reached: Partial<Record<Category, number>>; fired: number; academy: boolean; }

/** Un piloto "robot" juega una carrera completa: entrena con descanso, acepta la mejor oferta y resuelve las carreras en automático. */
export function playBot(difficulty: Difficulty, seasons: number): BotRun {
  const setup: NewGameSetup = {
    mode: 'driver', firstName: 'Bot', lastName: 'Piloto', nationality: 'México', age: 13, season: 2026, difficulty, personality: 'professional',
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 43])) as Stats, teamId: 'cadillac', teamMode: 'existing',
    profile: { experience: 30, reputation: 30, management: 30, technical: 30 }, newTeam: { name: '', color: '#e8002d', philosophy: 'Técnica', logo: '◆', budget: 90 },
  };
  let s: GameState = createGame(setup);
  const end = s.season + seasons, reached: BotRun['reached'] = {};
  let fired = 0, academy = false, guard = 0;
  while (s.season < end && guard++ < 30000) {
    const p = playerOf(s);
    if (p) { if (reached[p.category] === undefined) reached[p.category] = ageOf(s, p); if (s.career.academy) academy = true; }
    if (s.alerts.length) { if (/Despedido/.test(s.alerts[0].title)) fired++; s = reduce(s, { type: 'DISMISS_ALERT' }); continue; }
    if (s.interview) { s = reduce(s, { type: 'ANSWER_INTERVIEW', index: 0 }); continue; }
    if (s.lifeEvent) { s = reduce(s, { type: 'ANSWER_LIFE', index: 0 }); continue; }
    if (s.legacy.fp) { s = fpAuto(s); continue; }
    if (s.pendingRace) { const n = autoRace(s); if (n === s) break; s = n; continue; }
    if (s.career.camp) { s = reduce(s, { type: 'CAMP_TEST', approach: 1 }); continue; }
    if (s.offers.length) {
      const best = [...s.offers].sort((a, b) => CATEGORIES.indexOf(b.category) - CATEGORIES.indexOf(a.category))[0];
      s = reduce(s, { type: 'ACCEPT_OFFER', offerId: best.id, salary: null });
      continue;
    }
    if (p) {
      if (p.fatigue > 60 && s.career.training) s = reduce(s, { type: 'SET_TRAINING', plan: null });
      else if (p.fatigue < 35 && !s.career.training && p.injuryDays === 0) s = reduce(s, { type: 'SET_TRAINING', plan: 'simulator' });
    }
    s = reduce(s, { type: 'ADVANCE_DAYS', days: 4 });
  }
  return { final: playerOf(s)?.category ?? 'karting', reached, fired, academy };
}
export async function runBalance(n: number, seasons: number, difficulty: Difficulty, onProgress: (done: number) => void): Promise<BotRun[]> {
  const out: BotRun[] = [];
  for (let i = 0; i < n; i++) {
    out.push(playBot(difficulty, seasons));
    onProgress(i + 1);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}
