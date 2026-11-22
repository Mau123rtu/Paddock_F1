import type { Career, GameState, Interview, InterviewOption, NewsItem, Personality, RaceEntry, SponsorDeal } from '../types';
import { Rng } from './rng';
import { playerOf } from './career';
import { dm } from './difficulty';
import { rating } from './market';
import { defaultLife } from './life';
import { CATEGORIES } from './career';
import { GLOBAL_BRANDS, SPONSORS, clash } from '../data/sponsors';
import type { Brand } from '../data/sponsors';

export const newCareer = (): Career => ({
  training: null, contract: null, points: 0, races: 0, popularity: 10, relations: { team: 50, media: 50, rivals: 50 },
  sponsors: [], money: 0, setup: { aero: 50, suspension: 50, brakes: 50 },
  academy: null, candidacies: [], cooldown: {}, slPoints: [], history: [], stats: { wins: 0, podiums: 0, races: 0, dnfs: 0, poles: 0 }, objective: null, camp: null, life: defaultLife(), skillPoints: 0, reserve: null,
  agent: { hired: false, nextAsk: '' }, engineer: ['Marco Bellini', 'Hana Ito', 'Diego Ferrer'][Math.floor(Math.random() * 3)],
});
const clamp = (v: number) => Math.min(100, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const NAMES = ['Vertex Energy', 'Lumina Telecom', 'Atlas Bank', 'Nova Fuels', 'Kiro Watches', 'Polar Drinks', 'Zenith Air'];
const CAT_PAY: Record<string, number> = { karting: 0.01, f4: 0.03, f3: 0.1, f2: 0.3, f1: 1.2 };
const mk = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved: [s.player.name] });

/** Ajuste del monoplaza: el ideal depende del circuito; el ingeniero acierta más cuanto más experiencia tengas. */
export const idealSetup = (i: number) => { const r = new Rng(i * 977 + 13); return { aero: r.int(25, 75), suspension: r.int(25, 75), brakes: r.int(25, 75) }; };
export const setupBonus = (a: Career['setup'], b: Career['setup']) => {
  const d = (Math.abs(a.aero - b.aero) + Math.abs(a.suspension - b.suspension) + Math.abs(a.brakes - b.brakes)) / 3;
  return Math.round(Math.max(-3, 2 - d / 12) * 10) / 10;
};
export function recommendSetup(i: number, experience: number): Career['setup'] {
  const id = idealSetup(i), r = new Rng(i * 31 + experience), n = Math.round((100 - experience) / 6);
  return { aero: clamp(id.aero + r.int(-n, n)), suspension: clamp(id.suspension + r.int(-n, n)), brakes: clamp(id.brakes + r.int(-n, n)) };
}
export const setSetup = (s: GameState, setup: Career['setup']): GameState => (s.mode === 'driver' ? { ...s, career: { ...s.career, setup } } : s);

/** Ingresos personales mensuales (salario + patrocinios) y renovación anual de patrocinios y relaciones. */
export function extrasStep(s: GameState): GameState {
  if (s.mode !== 'driver') return s;
  const inc = ((s.career.contract?.salary ?? 0) + s.career.sponsors.reduce((a, d) => a + d.pay, 0)) / 12 * (s.career.agent.hired ? 0.9 : 1);
  return { ...s, career: { ...s.career, money: r3(s.career.money + inc) } };
}
export function extrasSeasonEnd(s: GameState, ended: number, rng: Rng) {
  const out: NewsItem[] = [], p = playerOf(s);
  if (s.mode !== 'driver' || !p) return { state: s, news: out };
  const c = s.career;
  const kept = c.sponsors.filter((d) => d.endSeason > ended && p.reputation >= 30);
  c.sponsors.filter((d) => !kept.includes(d)).forEach((d) => out.push(mk(s, `spend-${d.id}`, 'finance', `${d.name} termina su patrocinio`, p.reputation < 30 ? 'Tu baja reputación pesó en la decisión.' : 'El contrato llegó a su fin.')));
  const pay = CAT_PAY[p.category] * (0.5 + p.reputation / 100 + c.popularity / 200) * (0.7 + c.relations.media / 100) * dm(s).offer;
  const offers: SponsorDeal[] = [0, 1].map((i) => ({ id: `pso-${s.season}-${i}`, name: rng.pick(NAMES), endSeason: s.season + rng.int(0, 2), pay: r3(pay * (0.8 + rng.next() * 0.4)) }));
  out.push(mk(s, 'pso', 'finance', 'Marcas interesadas en ti', 'Tienes nuevas ofertas de patrocinio personal.'));
  const drift = (v: number) => Math.round(v + (50 - v) * 0.1);
  const relations = { team: drift(c.relations.team), media: drift(c.relations.media), rivals: drift(c.relations.rivals) };
  return { state: { ...s, sponsorOffers: offers, career: { ...c, sponsors: kept, relations, popularity: clamp(c.popularity - 2) } }, news: out };
}
export function acceptPersonalSponsor(s: GameState, id: string): GameState {
  const o = s.sponsorOffers.find((x) => x.id === id);
  if (s.mode !== 'driver' || !o) return s;
  const rival = clash(o.name, s.career.sponsors.map((x) => x.name));
  if (rival) return { ...s, news: [mk(s, `pclash-${id}`, 'finance', `${o.name} no quiere compartir con ${rival}`, `Son competidores directos. Rescinde con ${rival} o rechaza la oferta.`), ...s.news] };
  return { ...s, sponsorOffers: s.sponsorOffers.filter((x) => x.id !== id), career: { ...s.career, sponsors: [...s.career.sponsors, o] },
    news: [mk(s, `psp-${id}`, 'finance', `${o.name} te patrocina`, `${o.pay} M anuales hasta ${o.endSeason}.`), ...s.news] };
}
export function dropPersonalSponsor(s: GameState, id: string): GameState {
  const d = s.career.sponsors.find((x) => x.id === id);
  if (s.mode !== 'driver' || !d) return s;
  const fee = r3(d.pay * 0.25);
  return { ...s, career: { ...s.career, sponsors: s.career.sponsors.filter((x) => x.id !== id), money: r3(s.career.money - fee), popularity: clamp(s.career.popularity - 2) },
    news: [mk(s, `pdrop-${id}`, 'finance', `Rompes con ${d.name}`, `La penalización cuesta ${fee} M.`), ...s.news] };
}

const O = (label: string, media: number, team: number, rivals: number, rep: number): InterviewOption => ({ label, media, team, rivals, rep });
type Kind = 'win' | 'podium' | 'dnf' | 'crash' | 'mid' | 'bad';
const Q: Record<Kind, ((r: string, pos: number) => string)[]> = {
  win: [(r) => `¡Victoria en ${r}! ¿Cómo te sientes?`, (r) => `Ganas en ${r}. ¿Fue la carrera perfecta?`, (r) => `Primer puesto en ${r}: ¿qué le dices a quienes dudaban de ti?`],
  podium: [(r, p) => `P${p} en ${r}. ¿Qué balance haces?`, (r) => `Subes al podio en ${r}. ¿Te quedas con ganas de más?`, (r) => `Gran carrera en ${r}: ¿cuál fue el momento clave?`],
  dnf: [(r) => `Has abandonado en ${r}. ¿Qué ha pasado?`, (r) => `Fin de carrera prematuro en ${r}: ¿fallo tuyo o del coche?`, (r) => `Otra carrera sin ver la bandera a cuadros en ${r}. ¿Qué piensas?`],
  crash: [(r) => `Un accidente en ${r}. ¿Estás bien? ¿Qué ocurrió?`, (r) => `Impacto fuerte en ${r}: ¿asumes la responsabilidad?`],
  mid: [(r, p) => `P${p} en ${r}. ¿Qué ha faltado?`, (r) => `Carrera discreta en ${r}: ¿qué esperabas?`, (r) => `Terminas en mitad de tabla en ${r}. ¿Cómo valoras el fin de semana?`],
  bad: [(r, p) => `Resultado difícil en ${r} (P${p}). ¿Qué falló?`, (r) => `Un fin de semana complicado en ${r}. ¿Hay presión?`],
};
const POOL: Record<Kind, InterviewOption[]> = {
  win: [O('Gracias al equipo, es un trabajo de todos', 1, 6, 0, 0), O('Mi talento marca la diferencia', 4, -3, -3, 2), O('Respeto a mis rivales, ha sido muy duro', 2, 1, 5, 0), O('Se la dedico a mi familia', 3, 1, 0, 1), O('Aún podemos mejorar mucho', 1, 3, 0, 1)],
  podium: [O('Gracias al equipo por el coche', 1, 5, 0, 0), O('Merecía más: iba a por la victoria', 3, -2, -2, 1), O('Un podio que suma, a seguir', 1, 2, 1, 1), O('Los rivales fueron muy fuertes', 2, 0, 4, 0), O('Hoy el ritmo fue de otro nivel', 3, 0, -1, 1)],
  dnf: [O('Ha sido mi error y lo asumo', 1, 4, 0, 0), O('El coche no estaba a la altura', 2, -6, 0, 0), O('Prefiero no hablar', -3, 0, 0, 0), O('Son cosas de carreras, seguimos', 0, 2, 0, 0), O('Hubo un toque; no fue culpa mía', 1, -2, -4, 0)],
  crash: [O('Estoy bien. Fue un error mío y pido perdón', 1, 5, 0, 0), O('Fue un incidente de carrera', 1, 0, -2, 0), O('Me cerraron la puerta, no pude evitarlo', 2, -1, -5, 0), O('Estoy bien, gracias por preguntar', 2, 1, 0, 0)],
  mid: [O('Hay que analizar los datos y mejorar', 0, 3, 0, 0), O('La próxima atacaré más', 2, 0, -1, 1), O('Los rivales han tenido suerte', -2, -1, -4, 0), O('Faltó ritmo en la segunda parte', 1, 1, 0, 0), O('El equipo debe darme un mejor coche', 1, -4, 0, 0)],
  bad: [O('Fue un fin de semana para olvidar', -1, 1, 0, 0), O('Trabajaremos duro para volver', 1, 3, 0, 1), O('Algo falló en la estrategia', 0, -5, 0, 0), O('No me afecta la presión', 2, 0, 0, 1)],
};
const PERS_OPT: Record<Personality, InterviewOption> = {
  egocentric: O('Soy el mejor de esta parrilla y lo demostraré', 5, -4, -4, 2), humble: O('Todavía tengo mucho que aprender de mis compañeros', 1, 4, 2, 0),
  competitive: O('No me conformo: quiero más y lo voy a conseguir', 3, 0, -1, 2), professional: O('Revisaremos los datos con los ingenieros', 0, 4, 0, 1),
  charismatic: O('Os debo un baile si ganamos la próxima', 5, 1, 1, 0), reserved: O('Prefiero hablar en la pista', -1, 1, 0, 0),
};
/** Pregunta y respuestas distintas según el resultado; dos opciones salen del repertorio y una refleja tu personalidad. */
export function makeInterview(e: RaceEntry, race: string, rivals: string[], rng: Rng, personality: Personality): Interview {
  const kind: Kind = e.status === 'dnf' ? (e.cause === 'accident' ? 'crash' : 'dnf') : e.pos === 1 ? 'win' : e.pos <= 3 ? 'podium' : e.pos <= 10 ? 'mid' : 'bad';
  const qs = Q[kind], pool = [...POOL[kind]];
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const options = [...pool.slice(0, 2), PERS_OPT[personality]];
  for (let i = options.length - 1; i > 0; i--) { const j = rng.int(0, i); [options[i], options[j]] = [options[j], options[i]]; }
  return { rivals, id: `iv-${race}`, question: qs[rng.int(0, qs.length - 1)](race, e.pos), options };
}
export function answerInterview(s: GameState, index: number): GameState {
  const o = s.interview?.options[index], p = playerOf(s);
  if (!o || !p) return s;
  const adj = { media: p.personality === 'charismatic' ? 1 : p.personality === 'reserved' ? -1 : 0, team: p.personality === 'humble' ? 1 : 0, rivals: p.personality === 'egocentric' ? -1 : 0 };
  const c = s.career;
  const bonds = { ...s.bonds };
  for (const n of s.interview?.rivals ?? []) bonds[n] = clamp((bonds[n] ?? 50) + o.rivals);
  return {
    ...s, interview: null, bonds,
    career: { ...c, popularity: clamp(c.popularity + (o.media > 0 ? 1 : 0)),
      relations: { media: clamp(c.relations.media + o.media + adj.media), team: clamp(c.relations.team + o.team + adj.team), rivals: clamp(c.relations.rivals + o.rivals + adj.rivals) } },
    drivers: s.drivers.map((d) => (d.id === p.id ? { ...d, reputation: clamp(d.reputation + o.rep) } : d)),
    news: [mk(s, 'press', 'race', `${s.player.name} habla con la prensa`, `«${o.label}»`), ...s.news],
  };
}

/* ---------- Patrocinadores por país ---------- */
const TIER_NEED = { 1: 22, 2: 42, 3: 62 } as const, TIER_PAY = { 1: 0.8, 2: 1.6, 3: 3 } as const;
const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const brands = (nat: string): (Brand & { local: boolean })[] => [...(SPONSORS[nat] ?? []).map((b) => ({ ...b, local: true })), ...GLOBAL_BRANDS.map((b) => ({ ...b, local: false }))];
function sponsorProb(s: GameState, tier: 1 | 2 | 3, local: boolean): number {
  const p = playerOf(s);
  if (!p) return 0;
  const score = rating(p) * 0.3 + p.reputation * 0.3 + s.career.popularity * 0.4 + CATEGORIES.indexOf(p.category) * 4 + (local ? 8 : 0) + (s.career.agent.hired ? 4 : 0);
  return Math.min(0.95, Math.max(0.05, (0.5 + (score - TIER_NEED[tier]) / 30) * Math.min(1.3, dm(s).offer)));
}
export function sponsorTargets(s: GameState) {
  const p = playerOf(s);
  if (!p) return null;
  return brands(p.nationality).map((b) => {
    const cd = s.career.cooldown[b.name];
    const rival = clash(b.name, s.career.sponsors.map((x) => x.name));
    const blocked = s.career.sponsors.some((x) => x.name === b.name) ? 'Ya te patrocina' : rival ? `No quiere estar con ${rival}` : cd && s.date < cd ? `No antes del ${cd}` : null;
    return { name: b.name, tier: b.tier, local: b.local, prob: sponsorProb(s, b.tier, b.local), blocked };
  });
}
export function applySponsor(s: GameState, name: string): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p) return s;
  if (s.career.candidacies.filter((c) => c.kind === 'sponsor').length >= 2) return { ...s, news: [mk(s, 'spref', 'system', 'Solicitud no enviada', 'Ya tienes 2 propuestas de patrocinio pendientes.'), ...s.news] };
  const rival = clash(name, s.career.sponsors.map((x) => x.name));
  if (rival) return { ...s, news: [mk(s, 'spref', 'system', 'Solicitud no enviada', `${name} no quiere estar con ${rival}.`), ...s.news] };
  const rng = new Rng(s.seed), reply = addDays(s.date, 10 + rng.int(0, 10));
  return { ...s, seed: rng.seed, career: { ...s.career, candidacies: [...s.career.candidacies, { id: `sp${rng.int(0, 9999)}`, target: name, kind: 'sponsor', category: p.category, reply }] },
    news: [mk(s, `spsend-${name}`, 'finance', 'Solicitud de patrocinio enviada', `${name} responderá hacia el ${reply}.`), ...s.news] };
}
/** Respuestas de las marcas: si aceptan, la oferta aparece en Patrocinadores y se avisa en pantalla. */
export function sponsorStep(s: GameState, rng: Rng) {
  const out: NewsItem[] = [], p = playerOf(s);
  const due = s.career.candidacies.filter((c) => c.kind === 'sponsor' && c.reply <= s.date);
  if (s.mode !== 'driver' || !p || !due.length) return { state: s, news: out };
  let offers = s.sponsorOffers, cooldown = s.career.cooldown;
  for (const c of due) {
    const b = brands(p.nationality).find((x) => x.name === c.target);
    const rival = clash(c.target, s.career.sponsors.map((x) => x.name));
    if (rival) { out.push(mk(s, `spclash-${c.id}`, 'finance', `${c.target} rechaza tu propuesta`, `No quieren compartir patrocinio con ${rival}.`)); continue; }
    if (b && rng.next() < sponsorProb(s, b.tier, b.local)) {
      const pay = r3(CAT_PAY[p.category] * TIER_PAY[b.tier] * (0.5 + p.reputation / 100 + s.career.popularity / 200) * (0.7 + s.career.relations.media / 100) * dm(s).offer * (0.8 + rng.next() * 0.4));
      offers = [...offers, { id: `psa-${c.id}`, name: c.target, endSeason: s.season + rng.int(0, 2), pay }];
      out.push(mk(s, `spok-${c.id}`, 'finance', `${c.target} acepta patrocinarte`, `Te ofrecen ${pay} M anuales. Revisa la oferta en Patrocinadores.`));
    } else {
      cooldown = { ...cooldown, [c.target]: addDays(s.date, 90) };
      out.push(mk(s, `spno-${c.id}`, 'finance', `${c.target} rechaza tu propuesta`, 'No volverán a valorarte en 90 días.'));
    }
  }
  return { state: { ...s, sponsorOffers: offers, career: { ...s.career, cooldown, candidacies: s.career.candidacies.filter((c) => !due.includes(c)) } }, news: out };
}
