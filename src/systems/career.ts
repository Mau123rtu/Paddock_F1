import type { Camp, Candidacy, Category, Driver, GameState, NewsItem, Offer, StatKey, TrainingId } from '../types';
import type { Rng } from './rng';
import { Rng as RngClass } from './rng';
import { askingSalary, rating, roster } from './market';
import { dm } from './difficulty';
import { ACADEMIES, FIRSTS, JUNIOR, LASTS, LEVEL, partnerTeam, teamStrength } from '../data/real';

export const PLAYER_ID = 'player';
export const CATEGORIES: Category[] = ['karting', 'f4', 'f3', 'f2', 'f1'];
export const CAT_LABEL: Record<Category, string> = { karting: 'Karting', f4: 'Fórmula 4', f3: 'Fórmula 3', f2: 'Fórmula 2', f1: 'Fórmula 1' };
export const THRESH: Record<Category, number> = { karting: 0, f4: 45, f3: 55, f2: 65, f1: 75 };
export const MIN_AGE: Record<Category, number> = { karting: 8, f4: 15, f3: 16, f2: 17, f1: 18 };
/** Edad hasta la que los equipos te consideran una promesa en cada categoría. */
export const AGE_MAX: Record<Category, number> = { karting: 15, f4: 18, f3: 20, f2: 22, f1: 99 };
export const FIELD: Record<Category, number> = { karting: 42, f4: 50, f3: 58, f2: 66, f1: 76 };
const BASE_SALARY: Record<Category, number> = { karting: 0.02, f4: 0.05, f3: 0.15, f2: 0.5, f1: 1 };
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
/** Puntos de superlicencia por puesto final (como en la FIA): se necesitan 40 en las últimas 3 temporadas para la F1. */
const SL_TABLE: Partial<Record<Category, number[]>> = { f2: [40, 40, 30, 20, 10, 8, 6, 4, 3, 2], f3: [30, 25, 20, 15, 10, 7, 5, 3, 2, 1], f4: [12, 10, 8, 6, 4, 3, 2, 1] };
export const TRAININGS: Record<TrainingId, { label: string; stat: StatKey; gain: number; fatigue: number; risk: number; desc: string }> = {
  simulator: { label: 'Simulador', stat: 'cornering', gain: 0.35, fatigue: 10, risk: 0, desc: 'Mejora la trazada.' },
  fitness: { label: 'Preparación física', stat: 'consistency', gain: 0.3, fatigue: 18, risk: 0.01, desc: 'Mejora la consistencia; es la más agotadora.' },
  reflexes: { label: 'Reflejos', stat: 'braking', gain: 0.3, fatigue: 12, risk: 0, desc: 'Mejora la frenada.' },
  focus: { label: 'Concentración', stat: 'focus', gain: 0.3, fatigue: 8, risk: 0, desc: 'Mejora la concentración.' },
  telemetry: { label: 'Análisis de telemetría', stat: 'adaptability', gain: 0.25, fatigue: 5, risk: 0, desc: 'Mejora la adaptabilidad con poco desgaste.' },
  mental: { label: 'Preparación mental', stat: 'pressure', gain: 0.25, fatigue: 6, risk: 0, desc: 'Mejora el rendimiento bajo presión.' },
};
const clamp = (v: number) => Math.min(100, Math.max(0, v));
export const playerOf = (s: GameState) => s.drivers.find((d) => d.id === PLAYER_ID);
export const ageOf = (s: GameState, d: Driver) => s.season - d.birthYear;
const mk = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved: [s.player.name] });
function addDays(iso: string, days: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
const junior = (cat: Category): string[] => (cat === 'f1' ? [] : JUNIOR[cat]);

export const slTotal = (s: GameState) => s.career.slPoints.filter((x) => x.season > s.season - 4).reduce((a, x) => a + x.pts, 0);
/** Los equipos pierden interés cuanto más te pasas de la edad esperada para tu categoría. */
export const ageFactor = (s: GameState, p: Driver) => Math.max(0.2, 1 - Math.max(0, ageOf(s, p) - AGE_MAX[p.category]) * 0.3);

/** Mejor categoría a la que puede aspirar; saltarse una exige +8 sobre el umbral; la F1 exige superlicencia (40 pts) o un nivel excepcional. */
export function bestCategory(s: GameState, p: Driver): Category {
  const r = rating(p), a = ageOf(s, p), cur = CATEGORIES.indexOf(p.category);
  let best = cur;
  for (let i = cur + 1; i <= Math.min(cur + 2, 4); i++) {
    const cat = CATEGORIES[i];
    const licence = cat !== 'f1' || slTotal(s) >= 40 || r >= 85 || (!!s.career.reserve && r >= 72);
    if (r >= THRESH[cat] + (i === cur + 2 ? 8 : 0) && a >= MIN_AGE[cat] && licence) best = i;
  }
  return CATEGORIES[best];
}

const prestige = (s: GameState, cat: Category, name: string) => {
  if (cat === 'f1') return s.teams.find((t) => t.name === name)?.carPerf ?? 60;
  const l = junior(cat);
  return teamStrength(cat, Math.max(0, l.indexOf(name)), l.length);
};
/** Probabilidad de que un equipo o academia acepte tu solicitud: nivel, reputación, popularidad y edad contra su exigencia. */
export function acceptProb(s: GameState, kind: Candidacy['kind'], cat: Category, name: string): number {
  const p = playerOf(s);
  if (!p) return 0;
  const over = Math.max(0, ageOf(s, p) - AGE_MAX[cat]);
  const score = rating(p) * 0.7 + p.reputation * 0.2 + s.career.popularity * 0.1 - over * 6 + (s.career.agent.hired ? 4 : 0);
  let need: number;
  if (kind === 'academy') {
    const ac = ACADEMIES.find((a) => a.name === name);
    need = 40 + ((s.teams.find((t) => t.id === ac?.teamId)?.carPerf ?? 60) - 52) * 0.5;
  } else if (cat === 'f1') need = 50 + (prestige(s, cat, name) - 52) * 1.1;
  else need = 28 + (prestige(s, cat, name) - (LEVEL[cat] - 8)) * 1.2;
  return Math.min(0.95, Math.max(0.05, (0.5 + (score - need) / 30) * Math.min(1.3, dm(s).scout)));
}
export function scoutingTargets(s: GameState) {
  const p = playerOf(s);
  if (!p) return null;
  const cat = bestCategory(s, p);
  const blocked = (n: string) => { const d = s.career.cooldown[n]; return d && s.date < d ? d : null; };
  const names = cat === 'f1' ? s.teams.filter((t) => t.entered).map((t) => t.name) : junior(cat);
  const teams = names.map((n) => ({ name: n, prob: acceptProb(s, 'team', cat, n), blocked: blocked(n) }));
  const academies = !s.career.academy && CATEGORIES.indexOf(cat) <= 2 ? ACADEMIES.map((a) => ({ name: a.name, prob: acceptProb(s, 'academy', cat, a.name), blocked: blocked(a.name) })) : [];
  return { cat, teams, academies };
}

/** Crea una oferta concreta. En F1, si el equipo está completo, sustituye a su piloto más flojo (solo si tú eres mejor). */
export function offerFor(s: GameState, p: Driver, rng: Rng, cat: Category, teamName: string, academy?: string): Offer | null {
  let teamId: string | undefined, replaces: string | undefined;
  if (cat === 'f1') {
    const t = s.teams.find((x) => x.name === teamName);
    if (!t) return null;
    const r = roster(s, t.id);
    if (r.length >= 2) {
      const worst = [...r].sort((a, b) => rating(a) - rating(b))[0];
      if (rating(worst) >= rating(p) + 2) return null;
      replaces = worst.id;
    }
    teamId = t.id;
  }
  const base = cat === 'f1' ? askingSalary(p) : Math.round(BASE_SALARY[cat] * (0.8 + rating(p) / 100) * 100) / 100;
  const salary = s.career.agent.hired ? Math.round(base * 110) / 100 : base;
  return { id: `o-${s.date}-${rng.int(0, 999)}`, category: cat, teamName, teamId, salary, years: rng.int(1, 3), academy, replaces };
}
/** Oferta espontánea de un ojeador: los mejores equipos solo se fijan en ti si tu nivel es alto; a veces es una academia. */
export function makeOffer(s: GameState, p: Driver, rng: Rng): Offer | null {
  const cat = bestCategory(s, p);
  if (cat === 'f1') {
    const cands = s.teams.filter((t) => t.entered && (roster(s, t.id).length < 2 || Math.min(...roster(s, t.id).map(rating)) < rating(p) + 2));
    const rt = s.career.reserve ? cands.find((t) => t.name === s.career.reserve?.team) : undefined;
    return cands.length ? offerFor(s, p, rng, cat, (rt ?? rng.pick(cands)).name) : null;
  }
  const ro = reserveOffer(s, p, rng, 0.35);
  if (ro) return ro;
  if (!s.career.academy && CATEGORIES.indexOf(cat) <= 2 && rng.next() < 0.3 * ageFactor(s, p)) {
    const ac = rng.pick(ACADEMIES);
    return offerFor(s, p, rng, cat, partnerTeam(ac.name, cat), ac.name);
  }
  const l = junior(cat), q = Math.min(1, Math.max(0, (rating(p) - THRESH[cat]) / 25));
  return offerFor(s, p, rng, cat, l[rng.int(Math.round((1 - q) * (l.length - 1)), l.length - 1)]);
}

export function applyTo(s: GameState, target: string, kind: Candidacy['kind'], pitch?: string): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p) return s;
  const cat = bestCategory(s, p);
  const refuse = (m: string): GameState => ({ ...s, news: [mk(s, `aref-${target}`, 'system', 'Solicitud no enviada', m), ...s.news] });
  if (s.career.candidacies.filter((c) => c.kind !== 'sponsor').length >= 2) return refuse('Ya tienes 2 solicitudes pendientes.');
  const cd = s.career.cooldown[target];
  if (cd && s.date < cd) return refuse(`${target} no volverá a valorarte hasta el ${cd}.`);
  if (kind === 'academy' && (s.career.academy || CATEGORIES.indexOf(cat) > 2)) return refuse('Ya estás en una academia o tu categoría no permite entrar en una.');
  const rng = new RngClass(s.seed), reply = addDays(s.date, 7 + rng.int(0, 7));
  const c: Candidacy = { id: `c${rng.int(0, 9999)}`, target, kind, category: cat, reply, pitch };
  return { ...s, seed: rng.seed, career: { ...s.career, candidacies: [...s.career.candidacies, c] },
    news: [mk(s, `aok-${target}`, 'transfer', 'Solicitud enviada', `${target} responderá hacia el ${reply}.`), ...s.news] };
}

/** Un día de carrera del piloto: fatiga, entrenamiento, lesiones y respuestas de los equipos a tus solicitudes. */
export function careerStep(s: GameState, rng: Rng, raceToday: boolean, raceName: string) {
  const out: NewsItem[] = [];
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p) return { state: s, news: out };
  let { fatigue, injuryDays, reputation } = p;
  let stats = p.stats;
  const career = { ...s.career };
  if (injuryDays > 0) {
    injuryDays -= 1; fatigue = clamp(fatigue - 4);
    if (injuryDays === 0) out.push(mk(s, 'recov', 'system', 'Alta médica', 'Puedes volver a entrenar y competir.'));
  } else if (career.training) {
    const T = TRAININGS[career.training];
    fatigue = clamp(fatigue + T.fatigue);
    if (rng.next() < T.gain * 1.4 * dm(s).train * (career.life.services.coach ? 1.25 : 1) * (career.life.mood >= 70 ? 1.1 : career.life.mood < 30 ? 0.7 : 1) * (0.6 + stats.focus / 200) * (1 - fatigue / 200)) stats = { ...stats, [T.stat]: Math.min(99, stats[T.stat] + 1) };
    if (rng.next() < (T.risk + Math.max(0, fatigue - 70) / 150) * (career.life.services.physio ? 0.5 : 1)) {
      injuryDays = rng.int(7, 28); career.training = null;
      out.push(mk(s, 'inj', 'system', 'Lesión por exceso de carga', `Estarás ${injuryDays} días fuera de entrenamientos y carreras.`));
    }
  } else fatigue = clamp(fatigue - 8);
  if (raceToday) {
    if (injuryDays > 0) out.push(mk(s, 'dns', 'race', 'Baja por lesión', `No participas en ${raceName}.`));
    else if (p.category !== 'karting' && !career.contract) out.push(mk(s, 'noseat', 'race', 'Sin asiento', `No tienes equipo en ${CAT_LABEL[p.category]} y te pierdes ${raceName}.`));
  }
  let offers = s.offers;
  const due = career.candidacies.filter((c) => c.reply <= s.date && c.kind !== 'sponsor');
  career.candidacies = career.candidacies.filter((c) => c.reply > s.date || c.kind === 'sponsor');
  for (const c of due) {
    if (c.kind === 'academy') {
      const prob = Math.min(0.95, Math.max(0.05, acceptProb(s, 'academy', c.category, c.target) + pitchBonus(s, c.pitch)));
      if (!career.camp && rng.next() < prob) {
        career.camp = makeCamp(s, c, rng);
        out.push(mk(s, `cand-${c.id}`, 'transfer', `${c.target} te invita a su campamento`, 'Tendrás que demostrar tu nivel ante otros aspirantes. Entra en Equipos y contratos.'));
      } else {
        career.cooldown = { ...career.cooldown, [c.target]: addDays(s.date, 90) };
        out.push(mk(s, `cand-${c.id}`, 'transfer', `${c.target} rechaza tu solicitud`, 'No te consideran por ahora. No volverán a valorarte en 90 días.'));
      }
      continue;
    }
    const team = c.target;
    const o = rng.next() < acceptProb(s, c.kind, c.category, c.target) ? offerFor(s, p, rng, c.category, team) : null;
    if (o) { offers = [...offers, o]; out.push(mk(s, `cand-${c.id}`, 'transfer', `${c.target} acepta tu solicitud`, 'Te ofrecen un contrato.')); }
    else {
      career.cooldown = { ...career.cooldown, [c.target]: addDays(s.date, 90) };
      out.push(mk(s, `cand-${c.id}`, 'transfer', `${c.target} rechaza tu solicitud`, 'Por ahora no encajas. No volverán a valorarte en 90 días.'));
    }
  }
  const state: GameState = { ...s, career, offers, drivers: s.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, fatigue, injuryDays, reputation, stats } : d)) };
  return { state, news: out };
}

export function seasonRank(s: GameState, season: number, cat: Category): number | null {
  const pts = new Map<string, number>();
  s.results.filter((r) => r.season === season && r.category === cat).forEach((r) => r.entries.forEach((e) => pts.set(e.id, (pts.get(e.id) ?? 0) + e.pts)));
  if (!pts.has(PLAYER_ID)) return null;
  const mine = pts.get(PLAYER_ID) ?? 0;
  return 1 + [...pts.values()].filter((v) => v > mine).length;
}

/** Fin de temporada: puesto final y superlicencia, evaluación de la academia (en karting y F4 te mantienen en el equipo aunque te saquen), contratos y nuevas ofertas. */
export function seasonEnd(s: GameState, ended: number, rng: Rng) {
  const out: NewsItem[] = [];
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p) return { state: s, news: out };
  const old = s.career, rank = seasonRank(s, ended, p.category);
  const slAdd = rank ? SL_TABLE[p.category]?.[rank - 1] ?? 0 : 0;
  const career = { ...old, points: 0, races: 0, slPoints: slAdd ? [...old.slPoints, { season: ended, pts: slAdd }] : old.slPoints };
  if (rank) out.push(mk(s, 'rank', 'race', `Terminas P${rank} del campeonato`, `${CAT_LABEL[p.category]} ${ended}.${slAdd ? ` Sumas ${slAdd} puntos de superlicencia (${slTotal({ ...s, career })}/40).` : ''}`));
  const ageNow = ageOf(s, p), gainPts = (ageNow <= 19 ? 8 : ageNow <= 23 ? 6 : 4) + (rank && rank <= 3 ? 3 : rank && rank <= 10 ? 1 : 0);
  career.skillPoints = old.skillPoints + gainPts;
  out.push(mk(s, 'skillpts', 'race', `Subes de nivel: ${gainPts} puntos de habilidad`, 'Repártelos en Mi rendimiento para mejorar tus estadísticas.'));
  career.history = [...old.history, { season: ended, category: p.category, team: old.contract?.teamName ?? 'Independiente', rank, points: old.points }];
  if (rank && old.objective) {
    const met = rank <= old.objective.rank;
    career.relations = { ...career.relations, team: clamp(career.relations.team + (met ? 5 : -5)) };
    out.push(mk(s, 'obj', 'race', met ? 'Objetivo cumplido' : 'Objetivo fallido', `Se esperaba P${old.objective.rank} o mejor y terminaste P${rank}.`));
  }
  let drivers = s.drivers, contract = old.contract;
  const release = () => { drivers = drivers.map((d) => (d.id === PLAYER_ID ? { ...d, teamId: null, contract: null } : d)); };
  const isJunior = p.category === 'karting' || p.category === 'f4';
  const poor = rank !== null && (rank > 10 || !!(old.objective && !isJunior && rank > old.objective.rank + 8) || (old.points < dm(s).fire && old.races >= 3 && p.reputation < 40 && old.relations.team < 65));
  const tooOld = ageOf(s, p) > AGE_MAX[p.category] + 1;
  if (old.academy && (poor || tooOld)) {
    out.push(mk(s, 'acad-out', 'transfer', `${old.academy} te saca de su academia`, tooOld ? 'Ya eres demasiado mayor para su programa.' : 'Los resultados no cumplieron sus expectativas.'));
    career.academy = null;
    if (!isJunior && contract) { out.push(mk(s, 'fired', 'transfer', `Despedido de ${contract.teamName}`, 'Sin el respaldo de la academia, el equipo no cuenta contigo.')); contract = null; release(); }
    else if (contract) out.push(mk(s, 'stay', 'system', 'Sigues en el equipo', `${contract.teamName} te mantiene en ${CAT_LABEL[p.category]}.`));
  } else if (contract && !isJunior && poor) {
    out.push(mk(s, 'fired', 'transfer', `Despedido de ${contract.teamName}`, 'Los resultados fueron muy flojos.')); contract = null; release();
  }
  if (contract && contract.endSeason <= ended) {
    if (career.academy) { contract = { ...contract, endSeason: s.season }; out.push(mk(s, 'renew', 'transfer', `Renuevas con ${contract.teamName}`, 'Tu academia asegura tu continuidad.')); }
    else { out.push(mk(s, 'end', 'transfer', 'Contrato finalizado', `Tu contrato con ${contract.teamName} terminó.`)); contract = null; release(); }
  }
  career.contract = contract;
  const next: GameState = { ...s, drivers, career };
  const cur = playerOf(next) as Driver;
  career.objective = objectiveFor(next, cur);
  const offer = !contract || bestCategory(next, cur) !== cur.category ? makeOffer(next, cur, rng) : null;
  if (offer) out.push(mk(s, 'offer', 'transfer', `${offer.teamName} te contacta`, `Te ofrece un puesto en ${CAT_LABEL[offer.category]}${offer.academy ? ` (${offer.academy})` : ''}.`));
  return { state: { ...next, offers: offer ? [offer] : [] }, news: out };
}

export function setTraining(s: GameState, plan: TrainingId | null): GameState {
  const p = playerOf(s);
  return !p || p.injuryDays > 0 ? s : { ...s, career: { ...s.career, training: plan } };
}
export const declineOffer = (s: GameState, id: string): GameState => ({ ...s, offers: s.offers.filter((o) => o.id !== id) });

/** Aceptar (salary=null) o contraofertar: hasta +10 % se acepta; hasta +30 % depende de la reputación; más, retiran la oferta. */
export function respondOffer(s: GameState, offerId: string, salary: number | null): GameState {
  const o = s.offers.find((x) => x.id === offerId), p = playerOf(s);
  if (!o || !p || s.mode !== 'driver') return s;
  if (o.reserve) return { ...s, offers: s.offers.filter((x) => x.id !== o.id), career: { ...s.career, reserve: { team: o.teamName, since: s.season } },
    news: [mk(s, 'reserve', 'transfer', `Te nombran piloto de pruebas de ${o.teamName}`, 'Harás sesiones de pruebas con su monoplaza y serás el primero en la fila si queda un asiento libre.'), ...s.news] };
  const rng = new RngClass(s.seed);
  let final = o.salary;
  if (salary !== null && salary > o.salary * 1.001) {
    const ratio = salary / o.salary, tol = s.career.agent.hired ? 0.1 : 0;
    if (ratio <= 1.1 + tol || (ratio <= 1.3 + tol && rng.next() < p.reputation / 100)) final = salary;
    else return { ...s, seed: rng.seed, offers: s.offers.filter((x) => x.id !== o.id), news: [mk(s, 'wd', 'transfer', 'Oferta retirada', `${o.teamName} retira su oferta tras tu contrapropuesta.`), ...s.news] };
  }
  if (o.teamId && !o.replaces && roster(s, o.teamId).length >= 2)
    return { ...s, offers: [], news: [mk(s, 'full', 'transfer', 'Asiento ocupado', `${o.teamName} cubrió el asiento antes de que respondieras.`), ...s.news] };
  const endSeason = s.season + o.years - 1;
  const news: NewsItem[] = [mk(s, 'signed', 'transfer', 'Nuevo contrato', `Firmas con ${o.teamName} para ${CAT_LABEL[o.category]} hasta ${endSeason}${o.academy ? ` y entras en ${o.academy}` : ''}.`)];
  let drivers = s.drivers;
  if (o.replaces) {
    const out = drivers.find((d) => d.id === o.replaces);
    drivers = drivers.map((d) => (d.id === o.replaces ? { ...d, teamId: null, contract: null } : d));
    if (out) news.push(mk(s, 'replaced', 'transfer', `${out.name} pierde su asiento`, `${o.teamName} lo sustituye por ti.`));
  }
  const signed: GameState = {
    ...s, seed: rng.seed, offers: [], career: { ...s.career, academy: o.academy ?? s.career.academy, contract: { teamName: o.teamName, category: o.category, salary: final, endSeason } },
    drivers: drivers.map((d) => (d.id === PLAYER_ID
      ? { ...d, category: o.category, teamId: o.teamId ?? null, contract: o.teamId ? { teamId: o.teamId, salary: final, endSeason } : null } : d)),
    news: [...news, ...s.news],
  };
  return { ...signed, career: { ...signed.career, objective: objectiveFor(signed, playerOf(signed) as Driver) } };
}

/** ¿Hay carrera interactiva hoy? El jefe de equipo siempre; el piloto solo si está sano y tiene asiento (o está en karting). */
export function canRace(s: GameState): boolean {
  if (s.mode === 'principal') return true;
  if (s.legacy.retired) return false;
  const p = playerOf(s);
  return !!p && p.injuryDays === 0 && (p.category === 'karting' || !!s.career.contract);
}

/** Objetivo de temporada que te marca tu equipo según su fuerza dentro de la categoría. */
export function objectiveFor(s: GameState, p: Driver): { rank: number } {
  const cat = p.category, team = s.career.contract?.teamName;
  const n = (cat === 'f1' ? 22 : s.rivals[cat].length) + 1;
  let frac = 0.3;
  if (cat === 'f1') { const t = [...s.teams].sort((a, b) => b.carPerf - a.carPerf), i = t.findIndex((x) => x.name === team); frac = i < 0 ? 0.3 : 1 - i / Math.max(1, t.length - 1); }
  else if (team) { const l = JUNIOR[cat], i = l.indexOf(team); frac = i < 0 ? 0.4 : 1 - i / Math.max(1, l.length - 1); }
  return { rank: Math.max(1, Math.round(1 + (1 - frac) * n * 0.6)) };
}

export const PITCHES: Record<string, { label: string; desc: string }> = {
  results: { label: 'Mis resultados', desc: 'Presumes tu último campeonato (pesa si terminaste en el top 5).' },
  talent: { label: 'Mi talento', desc: 'Demuestras tu nivel actual (pesa si tu nivel es alto).' },
  potential: { label: 'Mi potencial', desc: 'Apuestas por tu edad y margen de mejora (pesa si eres joven para tu categoría).' },
  sponsors: { label: 'Mi respaldo económico', desc: 'Ofreces patrocinadores que financian tu plaza (pesa si ya tienes alguno).' },
};
/** Cuánto ayuda tu argumento frente a los otros aspirantes. */
export function pitchBonus(s: GameState, pitch?: string): number {
  const p = playerOf(s);
  if (!p || !pitch) return 0;
  const last = s.career.history[s.career.history.length - 1];
  if (pitch === 'results') return last?.rank && last.rank <= 5 ? 0.15 : -0.05;
  if (pitch === 'talent') return rating(p) >= 60 ? 0.12 : rating(p) >= 50 ? 0.03 : -0.05;
  if (pitch === 'potential') return ageOf(s, p) <= AGE_MAX[p.category] - 2 ? 0.12 : -0.05;
  return s.career.sponsors.length ? 0.15 : -0.1;
}
/** Campamento de la academia: tú contra 5 aspirantes generados; solo entran 2. */
export function makeCamp(s: GameState, c: Candidacy, rng: Rng): Camp {
  const ac = ACADEMIES.find((a) => a.name === c.target);
  const level = 42 + ((s.teams.find((t) => t.id === ac?.teamId)?.carPerf ?? 60) - 52) * 0.45;
  const names = new Set<string>();
  const candidates = Array.from({ length: 5 }, () => {
    let name = '';
    do { name = `${rng.pick(FIRSTS)} ${rng.pick(LASTS)}`; } while (names.has(name));
    names.add(name);
    return { name, score: 0 };
  });
  return { academy: c.target, category: c.category, pitch: c.pitch ?? 'talent', step: 0, level, scores: [], candidates, spots: 2 };
}
/** Tu compañero de equipo: en F1 el otro piloto del equipo; en categorías inferiores el rival más fuerte de tu escudería. */
export function teammateOf(s: GameState): { name: string; rating: number; age: number } | null {
  const p = playerOf(s), team = s.career.contract?.teamName;
  if (s.mode !== 'driver' || !p || !team) return null;
  if (p.category === 'f1') {
    const t = s.teams.find((x) => x.name === team), m = t ? roster(s, t.id).find((d) => d.id !== PLAYER_ID) : undefined;
    return m ? { name: m.name, rating: rating(m), age: ageOf(s, m) } : null;
  }
  const m = [...s.rivals[p.category]].filter((r) => r.team === team).sort((a, b) => b.rating - a.rating)[0];
  return m ? { name: m.name, rating: m.rating, age: s.season - m.birthYear } : null;
}

export function reserveOffer(s: GameState, p: Driver, rng: Rng, prob: number): Offer | null {
  const ac = ACADEMIES.find((a) => a.name === s.career.academy), t = ac ? s.teams.find((x) => x.id === ac.teamId) : undefined;
  if (!t || s.career.reserve || CATEGORIES.indexOf(p.category) < 2 || rating(p) < 58 || ageOf(s, p) < 17 || rng.next() >= prob * ageFactor(s, p)) return null;
  return { id: `o-res-${s.date}`, category: p.category, teamName: t.name, salary: 0.1, years: 1, reserve: true };
}
/** Pides a tu academia ser su piloto de pruebas: depende de tu nivel y edad. */
export function requestReserve(s: GameState): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p) return s;
  const rng = new RngClass(s.seed), o = reserveOffer(s, p, rng, Math.min(0.8, 0.2 + (rating(p) - 55) / 40));
  const n = o ? mk(s, 'reqres', 'transfer', `${o.teamName} te ofrece ser su piloto de pruebas`, 'Revisa la oferta en Equipos y contratos.') : mk(s, 'reqres-no', 'transfer', 'Piloto de pruebas: aún no', 'Tu academia todavía no te considera listo (nivel, edad o categoría).');
  return { ...s, seed: rng.seed, offers: o ? [...s.offers, o] : s.offers, news: [n, ...s.news] };
}
export function spendPoint(s: GameState, stat: StatKey): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p || s.career.skillPoints <= 0 || p.stats[stat] >= 99) return s;
  return { ...s, career: { ...s.career, skillPoints: s.career.skillPoints - 1 }, drivers: s.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, stats: { ...d.stats, [stat]: d.stats[stat] + 1 } } : d)) };
}
