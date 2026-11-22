import type { GameState, NewsItem, Stats } from '../types';
import { Rng } from './rng';
import { partnerTeam } from '../data/real';
import { offerFor, playerOf } from './career';

export const CAMP_STEPS: { id: string; label: string; desc: string; stats: (keyof Stats)[] }[] = [
  { id: 'sim', label: 'Simulador', desc: 'Vueltas en simulador con el coche de la academia.', stats: ['cornering', 'braking'] },
  { id: 'fitness', label: 'Prueba física', desc: 'Resistencia y concentración bajo fatiga.', stats: ['consistency', 'focus'] },
  { id: 'track', label: 'Pruebas en pista', desc: 'Ritmo, adelantamientos y cuidado del neumático.', stats: ['speed', 'overtaking', 'tyreManagement'] },
  { id: 'interview', label: 'Entrevista con los técnicos', desc: 'Madurez, presión y adaptación al equipo.', stats: ['pressure', 'adaptability'] },
];
const APPROACHES = [{ label: 'Conservador', m: 0, v: 6 }, { label: 'Equilibrado', m: 3, v: 14 }, { label: 'Agresivo', m: 6, v: 26 }];
export const APPROACH_LABELS = APPROACHES.map((a) => a.label);
const mk = (s: GameState, id: string, headline: string, body: string): NewsItem => ({ id: `${id}-${s.date}`, date: s.date, category: 'transfer', headline, body, involved: [s.player.name] });
const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const sponsorBonus = (s: GameState) => Math.min(20, s.career.sponsors.length * 8);

/** Cada prueba del campamento: tu nivel en las habilidades pedidas, tu forma y el enfoque que elijas (más riesgo = más varianza) contra los demás aspirantes. */
export function campTest(s: GameState, approach: number): GameState {
  const camp = s.career.camp, p = playerOf(s);
  if (!camp || !p) return s;
  const rng = new Rng(s.seed), step = CAMP_STEPS[camp.step], ap = APPROACHES[approach] ?? APPROACHES[1];
  const avg = step.stats.reduce((a, k) => a + p.stats[k], 0) / step.stats.length;
  const extra = step.id === 'fitness' ? (100 - p.fatigue) * 0.1 : step.id === 'interview' ? s.career.relations.media * 0.1 : 0;
  const score = Math.round(avg + extra + ap.m + (rng.next() - 0.5) * ap.v);
  const candidates = camp.candidates.map((c) => ({ ...c, score: c.score + Math.round(camp.level + rng.int(-12, 12)) }));
  const scores = [...camp.scores, score], next = camp.step + 1;
  const mine = scores.reduce((a, b) => a + b, 0), rank = 1 + candidates.filter((c) => c.score > mine).length;
  if (next < CAMP_STEPS.length) {
    return { ...s, seed: rng.seed, career: { ...s.career, camp: { ...camp, step: next, scores, candidates } },
      news: [mk(s, `camp${next}`, `Campamento: ${step.label}`, `Obtienes ${score} puntos. Llevas P${rank} de ${candidates.length + 1} aspirantes.`), ...s.news] };
  }
  const total = mine + sponsorBonus(s) * CAMP_STEPS.length / 2;
  const finalRank = 1 + candidates.filter((c) => c.score > total).length;
  const base = { ...s, seed: rng.seed, career: { ...s.career, camp: null } };
  if (finalRank <= camp.spots) {
    const o = offerFor(s, p, rng, camp.category, partnerTeam(camp.academy, camp.category), camp.academy);
    return { ...base, offers: o ? [...s.offers, o] : s.offers,
      news: [mk(s, 'camp-ok', `Entras en ${camp.academy}`, `Terminas P${finalRank} entre ${candidates.length + 1} aspirantes${s.career.sponsors.length ? ' y tus patrocinadores pesaron a tu favor' : ''}. Revisa su oferta en Equipos y contratos.`), ...s.news] };
  }
  return { ...base, career: { ...base.career, cooldown: { ...s.career.cooldown, [camp.academy]: addDays(s.date, 120) } },
    news: [mk(s, 'camp-no', `No entras en ${camp.academy}`, `Terminas P${finalRank}; solo ${camp.spots} plazas.${s.career.sponsors.length ? '' : ' Contar con patrocinadores habría ayudado.'} No volverán a valorarte en 120 días.`), ...s.news] };
}
