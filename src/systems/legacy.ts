import type { Category, ChampionRec, RegEra, Compound, Driver, FPRun, GameState, HallEntry, Legacy, NewsItem, RaceResult, Rival, SeasonSummary } from '../types';
import { STAT_KEYS } from '../types';
import { Rng } from './rng';
import { askingSalary, rating } from './market';
import { CAT_LABEL, CATEGORIES, PLAYER_ID, ageOf, playerOf, slTotal } from './career';
import { buildCategoryField, practiceTime, qualiAttempt } from './race';
import type { Participant } from './race';
import { teamFavor } from './orders';
import { BASE_LOGS, RECORD_DEFS, REAL_CHAMPIONS, REAL_LAST_SEASON } from '../data/history';

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const nw = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string, involved: string[]): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved });

/* ───────────── Reglamento técnico ───────────── */
const MAJOR: Pick<RegEra, 'name' | 'desc'>[] = [
  { name: 'Nueva fórmula de motores', desc: 'Unidades de potencia rediseñadas: los equipos parten casi de cero y el orden competitivo se reinicia.' },
  { name: 'Nuevo reglamento aerodinámico', desc: 'Coches totalmente rediseñados: quien acierte con el concepto manda, quien falle se hunde.' },
  { name: 'Revolución de chasis y efecto suelo', desc: 'Cambia la filosofía del coche: las jerarquías de los últimos años dejan de valer.' },
];
const MINOR: Pick<RegEra, 'name' | 'desc'>[] = [
  { name: 'Nuevo tope de costes', desc: 'Se aprieta el presupuesto: los equipos punteros pierden ventaja y el pelotón se acerca.' },
  { name: 'Neumáticos de nueva generación', desc: 'Compuestos distintos: algunos coches se adaptan mejor que otros.' },
  { name: 'Directiva técnica sobre suelos y alerones', desc: 'La FIA limita soluciones del paddock: ligero reajuste entre equipos.' },
];
export const makeEra = (start: number, kind: RegEra['kind']): RegEra => {
  const list = kind === 'major' ? MAJOR : MINOR;
  return { start, kind, ...list[start % list.length] };
};
export const initRegs = (season: number): Pick<Legacy, 'regs' | 'nextRegs'> => ({
  regs: [{ start: season, kind: 'major', name: season === 2026 ? 'Reglamento 2026: motores nuevos y aerodinámica activa' : 'Reglamento vigente', desc: 'Era técnica actual de la F1.' }],
  nextRegs: makeEra(season + 2, 'minor'),
});
export const currentEra = (l: Legacy) => l.regs[l.regs.length - 1];

export const newLegacy = (startSeason: number, tutorialDone: boolean, ratingStart = 0): Legacy => ({
  hier: 'even', ...initRegs(startSeason),
  startSeason, tutorialDone, champions: [], constructors: [], logs: {},
  records: RECORD_DEFS.map((d) => ({ key: d.key, holder: d.baseHolder, value: d.baseValue, season: d.baseSeason, real: true })),
  trophies: [], seen: [], summaries: [], pendingSummary: null, celebrations: [],
  fp: null, fpDone: 0, fpSeason: { season: startSeason, n: 0 }, impression: 0, fpBest: null, retired: null, hall: [], ratingStart, f1Age: null,
});

/* ───────────── Historial y marcas ───────────── */
const baseOf = (l: Legacy, name: string) => (l.startSeason > REAL_LAST_SEASON ? BASE_LOGS[name] : undefined) ?? { wins: 0, poles: 0, podiums: 0 };
export function careerLog(l: Legacy, name: string) {
  const g = l.logs[name], b = baseOf(l, name);
  return { wins: b.wins + (g?.wins ?? 0), poles: b.poles + (g?.poles ?? 0), podiums: b.podiums + (g?.podiums ?? 0), races: g?.races ?? 0, firstWin: g?.firstWin };
}
const realBefore = (l: Legacy) => REAL_CHAMPIONS.filter((c) => c.season < l.startSeason && c.season <= REAL_LAST_SEASON);
export const titlesOf = (l: Legacy, name: string) => realBefore(l).filter((c) => c.driver === name).length + l.champions.filter((c) => c.category === 'f1' && c.driver === name).length;
const birthOf = (s: GameState, name: string): number | null =>
  s.drivers.find((d) => d.name === name)?.birthYear ?? (Object.values(s.rivals).flat() as Rival[]).find((r) => r.name === name)?.birthYear ?? null;

export interface WorldChampion { name: string; titles: number; years: { season: number; team: string; rating?: number; pts?: number; age?: number }[]; status: 'activo' | 'sin equipo' | 'retirado' | 'histórico'; team: string | null; level: number | null; age: number | null; wins: number; poles: number; podiums: number; }
/** Vitrina de campeones del mundo: títulos reales hasta 2025 más los que se ganen en tu partida. */
export function worldChampions(s: GameState): WorldChampion[] {
  const l = s.legacy, map = new Map<string, WorldChampion['years']>();
  realBefore(l).forEach((c) => map.set(c.driver, [...(map.get(c.driver) ?? []), { season: c.season, team: c.team }]));
  l.champions.filter((c) => c.category === 'f1').forEach((c) => map.set(c.driver, [...(map.get(c.driver) ?? []), { season: c.season, team: c.team, rating: c.rating, pts: c.pts, age: c.age }]));
  const retired = new Set(l.hall.map((h) => h.name));
  return [...map.entries()].map(([name, years]) => {
    const d = s.drivers.find((x) => x.name === name && (x.category === 'f1' || x.id === PLAYER_ID));
    const log = careerLog(l, name);
    return {
      name, years: years.sort((a, b) => a.season - b.season), titles: years.length,
      status: d ? (d.teamId ? 'activo' : 'sin equipo') : retired.has(name) ? 'retirado' : 'histórico',
      team: d ? s.teams.find((t) => t.id === d.teamId)?.name ?? null : null, level: d ? rating(d) : null, age: d ? ageOf(s, d) : null,
      wins: log.wins, poles: log.poles, podiums: log.podiums,
    } as WorldChampion;
  }).map((c) => {
    // Campeones ya retirados antes de que empiece tu partida: mostrar su carrera real completa.
    const full = BASE_LOGS[c.name];
    return c.status === 'histórico' && full && l.startSeason <= REAL_LAST_SEASON ? { ...c, wins: full.wins, poles: full.poles, podiums: full.podiums } : c;
  }).sort((a, b) => b.titles - a.titles || b.years[b.years.length - 1].season - a.years[a.years.length - 1].season);
}

/* ───────────── Logros ───────────── */
export interface Achievement { id: string; label: string; desc: string; icon: string; check: (s: GameState) => boolean; progress?: (s: GameState) => [number, number]; }
const me = (s: GameState) => playerOf(s);
const pTitles = (s: GameState, cat?: Category) => s.legacy.champions.filter((c) => c.player && (!cat || c.category === cat)).length;
const reached = (s: GameState, cat: Category) => { const p = me(s); return !!p && CATEGORIES.indexOf(p.category) >= CATEGORIES.indexOf(cat); };
const st = (s: GameState) => s.career.stats;
const F1 = (s: GameState) => s.legacy.logs[s.player.name];
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'debut', label: 'Debut', desc: 'Disputa tu primera carrera.', icon: 'flag', check: (s) => st(s).races >= 1 },
  { id: 'races50', label: 'Veterano', desc: 'Disputa 50 carreras.', icon: 'gauge', check: (s) => st(s).races >= 50, progress: (s) => [Math.min(50, st(s).races), 50] },
  { id: 'races150', label: 'Curtido en mil batallas', desc: 'Disputa 150 carreras.', icon: 'cog', check: (s) => st(s).races >= 150, progress: (s) => [Math.min(150, st(s).races), 150] },
  { id: 'podium1', label: 'Primer podio', desc: 'Termina entre los tres primeros.', icon: 'medal', check: (s) => st(s).podiums >= 1 },
  { id: 'win1', label: 'Primera victoria', desc: 'Gana una carrera.', icon: 'trophy', check: (s) => st(s).wins >= 1 },
  { id: 'win10', label: 'Ganador en serie', desc: 'Consigue 10 victorias.', icon: 'flame', check: (s) => st(s).wins >= 10, progress: (s) => [Math.min(10, st(s).wins), 10] },
  { id: 'win25', label: 'Máquina de ganar', desc: 'Consigue 25 victorias.', icon: 'zap', check: (s) => st(s).wins >= 25, progress: (s) => [Math.min(25, st(s).wins), 25] },
  { id: 'pole1', label: 'Primera pole', desc: 'Sal desde la pole position.', icon: 'timer', check: (s) => st(s).poles >= 1 },
  { id: 'pole10', label: 'Rey de la vuelta lanzada', desc: 'Consigue 10 poles.', icon: 'rocket', check: (s) => st(s).poles >= 10, progress: (s) => [Math.min(10, st(s).poles), 10] },
  { id: 'reach-f4', label: 'Salto a monoplazas', desc: 'Llega a la Fórmula 4.', icon: 'car', check: (s) => reached(s, 'f4') },
  { id: 'reach-f3', label: 'Escalando posiciones', desc: 'Llega a la Fórmula 3.', icon: 'trend', check: (s) => reached(s, 'f3') },
  { id: 'reach-f2', label: 'La antesala', desc: 'Llega a la Fórmula 2.', icon: 'door', check: (s) => reached(s, 'f2') },
  { id: 'reach-f1', label: 'Piloto de F1', desc: 'Llega a la Fórmula 1.', icon: 'globe', check: (s) => reached(s, 'f1') },
  { id: 'prodigy', label: 'Joven promesa', desc: 'Llega a la F1 con 19 años o menos.', icon: 'sparkles', check: (s) => s.legacy.f1Age !== null && s.legacy.f1Age <= 19 },
  { id: 'superlicence', label: 'Superlicencia', desc: 'Reúne 40 puntos de superlicencia.', icon: 'scroll', check: (s) => slTotal(s) >= 40, progress: (s) => [Math.min(40, slTotal(s)), 40] },
  { id: 'academy', label: 'Fichado por una academia', desc: 'Entra en una academia de pilotos.', icon: 'grad', check: (s) => !!s.career.academy },
  { id: 'reserve', label: 'Piloto de pruebas', desc: 'Sé nombrado piloto de reserva de un equipo de F1.', icon: 'flask', check: (s) => !!s.career.reserve },
  { id: 'fp-debut', label: 'Primera vez en un F1', desc: 'Participa en unas prácticas libres oficiales de F1.', icon: 'wrench', check: (s) => s.legacy.fpDone >= 1 },
  { id: 'fp-fast', label: 'El más rápido del viernes', desc: 'Marca el mejor tiempo en unas prácticas libres de F1.', icon: 'timer', check: (s) => s.legacy.fpBest === 1 },
  { id: 'champ-karting', label: 'Campeón de karting', desc: 'Gana el campeonato de karting.', icon: 'trophy', check: (s) => pTitles(s, 'karting') > 0 },
  { id: 'champ-f4', label: 'Campeón de F4', desc: 'Gana el campeonato de Fórmula 4.', icon: 'trophy', check: (s) => pTitles(s, 'f4') > 0 },
  { id: 'champ-f3', label: 'Campeón de F3', desc: 'Gana el campeonato de Fórmula 3.', icon: 'trophy', check: (s) => pTitles(s, 'f3') > 0 },
  { id: 'champ-f2', label: 'Campeón de F2', desc: 'Gana el campeonato de Fórmula 2.', icon: 'trophy', check: (s) => pTitles(s, 'f2') > 0 },
  { id: 'f1-points', label: 'Puntúa en F1', desc: 'Termina en zona de puntos en un GP de F1.', icon: 'target', check: (s) => s.results.some((r) => r.category === 'f1' && r.entries.some((e) => e.id === PLAYER_ID && e.pts > 0)) },
  { id: 'f1-podium', label: 'Podio en F1', desc: 'Sube al podio de un Gran Premio.', icon: 'party', check: (s) => (F1(s)?.podiums ?? 0) >= 1 },
  { id: 'f1-win', label: 'Ganador de un Gran Premio', desc: 'Gana un GP de F1.', icon: 'trophy', check: (s) => (F1(s)?.wins ?? 0) >= 1 },
  { id: 'f1-title', label: 'Campeón del mundo', desc: 'Gana el campeonato mundial de F1.', icon: 'crown', check: (s) => pTitles(s, 'f1') >= 1 },
  { id: 'f1-title3', label: 'Tricampeón', desc: 'Gana 3 campeonatos mundiales.', icon: 'crown', check: (s) => pTitles(s, 'f1') >= 3, progress: (s) => [Math.min(3, pTitles(s, 'f1')), 3] },
  { id: 'f1-title5', label: 'Pentacampeón', desc: 'Gana 5 campeonatos mundiales.', icon: 'crown', check: (s) => pTitles(s, 'f1') >= 5, progress: (s) => [Math.min(5, pTitles(s, 'f1')), 5] },
  { id: 'f1-title8', label: 'Más grande que nadie', desc: 'Gana 8 campeonatos mundiales y supera el récord histórico.', icon: 'gem', check: (s) => pTitles(s, 'f1') >= 8, progress: (s) => [Math.min(8, pTitles(s, 'f1')), 8] },
  { id: 'record', label: 'Rompe récords', desc: 'Bate un récord histórico de la F1.', icon: 'chart', check: (s) => s.legacy.records.some((r) => r.holder === s.player.name && !r.real) },
  { id: 'seasons10', label: 'Una década en la pista', desc: 'Completa 10 temporadas.', icon: 'calendar', check: (s) => s.career.history.length >= 10, progress: (s) => [Math.min(10, s.career.history.length), 10] },
  { id: 'hall', label: 'Salón de la Fama', desc: 'Retírate y entra en el Salón de la Fama.', icon: 'landmark', check: (s) => !!s.legacy.retired },
];

/* ───────────── Actualización tras cada acción ───────────── */
const pushCel = (l: Legacy, c: Legacy['celebrations'][number]): Legacy => ({ ...l, celebrations: [...l.celebrations.filter((x) => x.id !== c.id), c].slice(-8) });

/** Procesa resultados nuevos (marcas, récords, celebraciones) y desbloquea logros. */
export function updateLegacy(s0: GameState): GameState {
  if (!s0.legacy) return s0;
  let s = s0, l: Legacy = { ...s0.legacy, logs: { ...s0.legacy.logs }, records: [...s0.legacy.records] };
  const news: NewsItem[] = [];
  const fresh = s.results.filter((r) => !l.seen.includes(r.id)).sort((a, b) => a.date.localeCompare(b.date));
  const setRecord = (key: string, holder: string, value: number, season: number) => {
    const def = RECORD_DEFS.find((d) => d.key === key), cur = l.records.find((r) => r.key === key);
    if (!def || !cur) return;
    if (!(def.lower ? value < cur.value : value > cur.value)) return;
    if (cur.holder === holder && cur.value === value) return;
    l.records = l.records.map((r) => (r.key === key ? { key, holder, value, season, real: false } : r));
    news.push(nw(s, `rec-${key}-${holder.replace(/\W/g, '')}-${value}`, 'race', `Nuevo récord: ${def.label}`, `${holder} lo deja en ${value}${def.unit} (${season}). Anterior: ${cur.holder}, ${cur.value}${def.unit}.`, [holder]));
    if (holder === s.player.name) l = pushCel(l, { id: `rec-${key}-${value}`, kind: 'record', title: '¡Récord histórico!', sub: `${def.label}: ${value}${def.unit}` });
  };
  const touched = new Set<string>();
  for (const r of fresh) {
    const f1 = r.category === 'f1';
    for (const e of r.entries) {
      const fin = e.status === 'finished', win = fin && e.pos === 1, pod = fin && e.pos <= 3, pole = r.pole === e.id;
      const birth = birthOf(s, e.name), age = birth ? r.season - birth : null;
      if (f1) {
        const g = l.logs[e.name] ?? { wins: 0, poles: 0, podiums: 0, races: 0, titles: 0, birthYear: birth ?? 0 };
        l.logs[e.name] = { ...g, races: g.races + 1, wins: g.wins + (win ? 1 : 0), podiums: g.podiums + (pod ? 1 : 0), poles: g.poles + (pole ? 1 : 0),
          firstWin: g.firstWin ?? (win && age ? { season: r.season, age } : undefined) };
        touched.add(e.name);
      }
      if (win && age) setRecord(`youngWin-${r.category}`, e.name, age, r.season);
    }
    const my = r.entries.find((e) => e.id === PLAYER_ID);
    if (my && s.mode === 'driver') {
      if (my.status === 'finished' && my.pos === 1) l = pushCel(l, { id: `win-${r.id}`, kind: 'win', title: '¡VICTORIA!', sub: `${r.name} · ${CAT_LABEL[r.category]} · ${my.team}` });
      else if (r.pole === PLAYER_ID) l = pushCel(l, { id: `pole-${r.id}`, kind: 'pole', title: 'POLE POSITION', sub: `${r.name} · ${CAT_LABEL[r.category]}` });
    }
  }
  for (const name of touched) {
    const c = careerLog(l, name);
    setRecord('wins', name, c.wins, s.season); setRecord('poles', name, c.poles, s.season); setRecord('podiums', name, c.podiums, s.season);
  }
  for (const r of fresh) {
    const w = r.entries.find((e) => e.status === 'finished' && e.pos === 1);
    if (!w || w.id === PLAYER_ID) continue;
    const pod = r.entries.filter((e) => e.status === 'finished' && e.pos <= 3).map((e) => e.name).join(', ');
    news.push({ ...nw(s, `rw-${r.id}`, 'race', `${w.name} gana el ${r.name} de ${CAT_LABEL[r.category]}`, `Podio: ${pod}. Victoria para ${w.team}.`, [w.name, w.team]), date: r.date, series: [r.category], important: false });
  }
  if (fresh.length) l.seen = [...l.seen, ...fresh.map((r) => r.id)].slice(-600);
  const p = playerOf(s);
  if (p && p.category === 'f1' && l.f1Age === null) l.f1Age = ageOf(s, p);
  s = { ...s, legacy: l };
  if (s.mode === 'driver' && p && !l.retired && fresh.some((r) => r.entries.some((e) => e.id === PLAYER_ID))) {
    const st = teamFavor(s, undefined, l.hier);
    if (st.hier !== l.hier) {
      if (st.races >= 3 && st.mate) {
        const mate = st.mate, team = [...fresh].reverse().find((r) => r.entries.some((e) => e.id === PLAYER_ID))?.entries.find((e) => e.id === PLAYER_ID)?.team ?? 'tu equipo';
        const [h, b] = st.hier === 'me' ? [`${team} te declara piloto prioritario`, `Tus resultados superan a los de ${mate} (${st.myPts} frente a ${st.matePts} puntos): recibirás las mejoras antes y, si hace falta, él cederá posiciones.`]
          : st.hier === 'mate' ? [`${mate} pasa a ser el piloto prioritario de ${team}`, `Va por delante de ti en el campeonato (${st.matePts} frente a ${st.myPts} puntos): el equipo podría pedirte que le dejes pasar si va más rápido.`]
          : [`${team} deja de tener un piloto prioritario`, `Los resultados de ${mate} y los tuyos están igualados: se os dejará correr con libertad.`];
        news.push({ ...nw(s, `hier-${st.hier}`, 'race', h, b, [s.player.name, mate, team]), series: p.category === 'f1' ? ['f1'] : [p.category], important: false });
      }
      s = { ...s, legacy: { ...s.legacy, hier: st.hier } };
      l = s.legacy;
    }
  }
  if (s.mode === 'driver' && p) {
    const have = new Set(l.trophies.map((t) => t.id)), got: Achievement[] = [];
    for (const a of ACHIEVEMENTS) if (!have.has(a.id)) { try { if (a.check(s)) got.push(a); } catch { /* sin datos */ } }
    if (got.length) {
      let l2: Legacy = { ...l, trophies: [...l.trophies, ...got.map((a) => ({ id: a.id, season: s.season, date: s.date }))] };
      got.slice(0, 3).forEach((a) => { l2 = pushCel(l2, { id: `tr-${a.id}`, kind: 'trophy', icon: a.icon, title: 'Logro desbloqueado', sub: `${a.label}: ${a.desc}` }); });
      got.forEach((a) => news.push(nw(s, `ach-${a.id}`, 'system', `Logro: ${a.label}`, a.desc, [s.player.name])));
      s = { ...s, legacy: l2 };
    }
  }
  return news.length ? { ...s, news: [...news, ...s.news].slice(0, 500) } : s;
}

/* ───────────── Fin de temporada ───────────── */
interface Stand { id: string; name: string; team: string; pts: number; wins: number }
function standings(results: RaceResult[], season: number, cat: Category): Stand[] {
  const m = new Map<string, Stand>();
  results.filter((r) => r.season === season && r.category === cat).forEach((r) => r.entries.forEach((e) => {
    const x = m.get(e.id) ?? { id: e.id, name: e.name, team: e.team, pts: 0, wins: 0 };
    m.set(e.id, { ...x, team: e.team, pts: x.pts + e.pts, wins: x.wins + (e.status === 'finished' && e.pos === 1 ? 1 : 0) });
  }));
  return [...m.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}
const ratingOfName = (s: GameState, name: string, id: string) => {
  const d = s.drivers.find((x) => x.id === id);
  if (d) return rating(d);
  return (Object.values(s.rivals).flat() as Rival[]).find((r) => r.name === name)?.rating ?? 50;
};

function buildSummary(s: GameState, ended: number): SeasonSummary | null {
  const p = playerOf(s), h = s.career.history.find((x) => x.season === ended);
  if (s.mode !== 'driver' || !p || !h) return null;
  const rs = s.results.filter((r) => r.season === ended && r.category === h.category).sort((a, b) => a.date.localeCompare(b.date));
  if (!rs.length) return null;
  const cum = new Map<string, number>(), races: SeasonSummary['races'] = [];
  let wins = 0, podiums = 0, poles = 0, dnfs = 0;
  rs.forEach((r) => {
    r.entries.forEach((e) => cum.set(e.id, (cum.get(e.id) ?? 0) + e.pts));
    const my = r.entries.find((e) => e.id === PLAYER_ID);
    if (my) { if (my.status === 'finished' && my.pos === 1) wins++; if (my.status === 'finished' && my.pos <= 3) podiums++; if (my.status === 'dnf') dnfs++; }
    if (r.pole === PLAYER_ID) poles++;
    races.push({ name: r.name.replace(/^GP de /, ''), pos: my ? (my.status === 'dnf' ? null : my.pos) : null, pts: my?.pts ?? 0, cum: cum.get(PLAYER_ID) ?? 0, leaderCum: Math.max(...cum.values()) });
  });
  const table = standings(s.results, ended, h.category), champ = table[0];
  const rank = h.rank, top = table.slice(0, 5).map((x) => ({ name: x.name, pts: x.pts, me: x.id === PLAYER_ID }));
  if (!top.some((x) => x.me)) { const mine = table.find((x) => x.id === PLAYER_ID); if (mine) top.push({ name: mine.name, pts: mine.pts, me: true }); }
  const headline = rank === 1 ? `¡Campeón de ${CAT_LABEL[h.category]}!` : rank && rank <= 3 ? `Podio del campeonato de ${CAT_LABEL[h.category]}` : rank && rank <= 10 ? `Zona de puntos en ${CAT_LABEL[h.category]}` : `Una temporada de aprendizaje en ${CAT_LABEL[h.category]}`;
  return { season: ended, category: h.category, team: h.team, rank, points: h.points, wins, podiums, poles, dnfs, races, table: top, ratingStart: s.legacy.ratingStart || rating(p), ratingEnd: rating(p), champion: champ?.name ?? '—', headline };
}

/** Los pilotos de F1 envejecen, mejoran o declinan y se retiran; los coches cambian de nivel y entran jóvenes promesas de F2. */
function evolveF1(s: GameState, rng: Rng): { state: GameState; news: NewsItem[]; hall: HallEntry[] } {
  const news: NewsItem[] = [], hall: HallEntry[] = [];
  let seq = s.rivalSeq;
  let drivers: Driver[] = s.drivers.map((d) => {
    if (d.category !== 'f1' || d.id === PLAYER_ID) return d;
    const age = ageOf(s, d), r0 = rating(d);
    let delta = age <= 22 ? rng.int(1, 3) : age <= 26 ? rng.int(0, 2) : age <= 29 ? rng.int(-1, 1) : age <= 32 ? rng.int(-2, 0) : age <= 36 ? rng.int(-3, -1) : rng.int(-4, -2);
    if (delta > 0 && r0 > 84) delta = Math.round(delta * Math.max(0, 1 - (r0 - 84) / 9));   // techo de talento: los muy buenos casi no mejoran más
    if (r0 > 88) delta -= Math.round((r0 - 88) * 0.4);                                            // y los que se salen del techo bajan
    const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, clamp(d.stats[k] + delta + rng.int(-1, 1), 35, 95)])) as Driver['stats'];
    return { ...d, stats };
  });
  const retiring: Driver[] = [];
  drivers = drivers.filter((d) => {
    if (d.category !== 'f1' || d.id === PLAYER_ID) return true;
    const age = ageOf(s, d), r = rating(d);
    const p = age >= 45 ? 1 : age >= 40 ? 0.55 : age >= 37 && r < 80 ? 0.45 : age >= 41 ? 0.5 : !d.teamId && age >= 31 && r < 70 ? 0.5 : 0;
    if (p > 0 && rng.next() < p) { retiring.push(d); return false; }
    return true;
  });
  const ended = s.season - 1;
  for (const d of retiring) {
    const log = careerLog(s.legacy, d.name), titles = titlesOf(s.legacy, d.name);
    news.push(nw(s, `retire-${d.id}`, 'transfer', `${d.name} anuncia su retirada de la F1`, `Deja la categoría a los ${ageOf(s, d)} años con ${titles} título(s) y ${log.wins} victoria(s).`, [d.name]));
    if (titles > 0 || log.wins >= 5 || log.podiums >= 20)
      hall.push({ name: d.name, season: ended, age: ageOf(s, d), titles, wins: log.wins, podiums: log.podiums, poles: log.poles, peak: rating(d), verdict: titles >= 3 ? 'Leyenda de la F1' : titles >= 1 ? 'Campeón del mundo' : 'Ganador de Grandes Premios' });
  }
  const rivals = { ...s.rivals, f2: [...s.rivals.f2] };
  const entered = s.teams.filter((t) => t.entered && t.id !== s.player.teamId);
  const seats = entered.reduce((a, t) => a + Math.max(0, 2 - drivers.filter((d) => d.teamId === t.id).length), 0);
  const avail = drivers.filter((d) => d.category === 'f1' && d.teamId === null && d.id !== PLAYER_ID).length;
  for (let k = avail; k < seats; k++) {
    const pick = [...rivals.f2].filter((r) => s.season - r.birthYear >= 18).sort((a, b) => b.rating - a.rating)[0];
    if (!pick) break;
    rivals.f2 = rivals.f2.filter((r) => r.id !== pick.id);
    const rt = Math.min(99, pick.rating + 6);
    const stats = Object.fromEntries(STAT_KEYS.map((q) => [q, clamp(rt + rng.int(-5, 5), 30, 99)])) as Driver['stats'];
    const nums = new Set(drivers.map((d) => d.number));
    let number = 60 + rng.int(0, 35); while (nums.has(number)) number++;
    drivers = [...drivers, { id: `g${seq++}`, name: pick.name, nationality: pick.nationality, birthYear: pick.birthYear, number, teamId: null, category: 'f1', stats, personality: 'humble', contract: null, fatigue: 0, injuryDays: 0, reputation: 45, potential: pick.potential }];
    news.push(nw(s, `rookie-${pick.id}`, 'transfer', `${pick.name} debutará en la F1`, 'Da el salto desde la Fórmula 2 y busca asiento.', [pick.name]));
  }
  for (const t of [...entered].sort((a, b) => b.carPerf - a.carPerf)) {
    while (drivers.filter((d) => d.teamId === t.id).length < 2) {
      const free = drivers.filter((d) => d.category === 'f1' && !d.teamId && d.id !== PLAYER_ID).sort((a, b) => rating(b) - rating(a))[0];
      if (!free) break;
      const years = rng.int(1, 3), salary = askingSalary(free);
      drivers = drivers.map((d) => (d.id === free.id ? { ...d, teamId: t.id, contract: { teamId: t.id, salary, endSeason: s.season + years - 1 } } : d));
      news.push(nw(s, `sign-${free.id}`, 'transfer', `${t.name} ficha a ${free.name}`, `Contrato de ${years} temporada(s) por ${salary} M anuales.`, [t.name, free.name]));
    }
  }
  const avg = entered.reduce((a, t) => a + t.carPerf, 0) / Math.max(1, entered.length);
  const teams = s.teams.map((t) => (t.entered && t.id !== s.player.teamId ? { ...t, carPerf: Math.round(clamp(t.carPerf + rng.int(-4, 4) + (avg - t.carPerf) * 0.22, 40, 98)) } : t));
  return { state: { ...s, drivers, teams, rivals, rivalSeq: seq }, news, hall };
}

/** Anuncia el próximo cambio de reglamento un año antes y lo aplica al empezar la temporada. */
function applyRegs(s: GameState, rng: Rng): { state: GameState; news: NewsItem[] } {
  const l = s.legacy, next = l.nextRegs, news: NewsItem[] = [];
  if (!next) return { state: s, news };
  const tag = { series: ['f1'] as Category[], important: true };
  if (next.start === s.season + 1 && !next.announced) {
    news.push({ ...nw(s, `regs-ann-${next.start}`, 'system', `La FIA aprueba cambios de reglamento para ${next.start}`, `${next.name}. ${next.desc} Los equipos ya trabajan en el nuevo coche.`, []), ...tag });
    return { state: { ...s, legacy: { ...l, nextRegs: { ...next, announced: true } } }, news };
  }
  if (next.start !== s.season) return { state: s, news };
  const entered = s.teams.filter((t) => t.entered), mean = entered.reduce((a, t) => a + t.carPerf, 0) / Math.max(1, entered.length);
  const rep = entered.reduce((a, t) => a + t.reputation, 0) / Math.max(1, entered.length);
  const teams = s.teams.map((t) => {
    if (!t.entered) return t;
    const c = next.kind === 'major'
      ? mean + (t.carPerf - mean) * 0.3 + (t.reputation - rep) * 0.08 + rng.int(-10, 10)
      : next.name === 'Nuevo tope de costes' ? mean + (t.carPerf - mean) * 0.72 + rng.int(-2, 2) : t.carPerf + rng.int(-4, 4);
    return { ...t, carPerf: Math.round(clamp(c, 45, 96)) };
  });
  const changed = s.teams.filter((t) => t.entered).map((t) => ({ t, d: (teams.find((x) => x.id === t.id)?.carPerf ?? t.carPerf) - t.carPerf }));
  const up = changed.sort((a, b) => b.d - a.d)[0], down = changed.sort((a, b) => a.d - b.d)[0];
  const body = `${next.desc}${next.kind === 'major' && up && down ? ` ${up.t.name} parece haber acertado más (${up.d >= 0 ? '+' : ''}${up.d} de rendimiento) y ${down.t.name} sufre (${down.d}).` : ''}`;
  news.push({ ...nw(s, `regs-${next.start}`, 'system', `Entra en vigor: ${next.name}`, body, up && down ? [up.t.name, down.t.name] : []), ...tag });
  const nextEra = makeEra(s.season + (next.kind === 'major' ? rng.int(2, 3) : rng.int(3, 4)), next.kind === 'major' ? 'minor' : 'major');
  return { state: { ...s, teams, legacy: { ...l, regs: [...l.regs, { ...next, announced: true }], nextRegs: nextEra } }, news };
}

export function legacySeasonEnd(s0: GameState, ended: number, rng: Rng): { state: GameState; news: NewsItem[] } {
  let s = s0, l: Legacy = { ...s0.legacy, logs: { ...s0.legacy.logs }, records: [...s0.legacy.records] };
  const news: NewsItem[] = [];
  const setRecord = (key: string, holder: string, value: number, season: number) => {
    const def = RECORD_DEFS.find((d) => d.key === key), cur = l.records.find((r) => r.key === key);
    if (!def || !cur || !(def.lower ? value < cur.value : value > cur.value)) return;
    l.records = l.records.map((r) => (r.key === key ? { key, holder, value, season, real: false } : r));
    news.push(nw(s, `rec-${key}-${season}`, 'race', `Nuevo récord: ${def.label}`, `${holder} lo deja en ${value}${def.unit} (${season}). Anterior: ${cur.holder}, ${cur.value}${def.unit}.`, [holder]));
    if (holder === s.player.name) l = pushCel(l, { id: `rec-${key}-${value}`, kind: 'record', title: '¡Récord histórico!', sub: `${def.label}: ${value}${def.unit}` });
  };
  for (const cat of [...CATEGORIES].reverse()) {
    const table = standings(s.results, ended, cat), c = table[0];
    if (!c || c.pts <= 0 || l.champions.some((x) => x.season === ended && x.category === cat)) continue;
    const birth = birthOf(s, c.name), age = birth ? ended - birth : 0, isMe = c.id === PLAYER_ID;
    const rec: ChampionRec = { season: ended, category: cat, driver: c.name, team: c.team, pts: c.pts, wins: c.wins, rating: ratingOfName(s, c.name, c.id), age, player: isMe || undefined };
    l.champions = [...l.champions, rec];
    if (cat === 'f1') {
      const g = l.logs[c.name] ?? { wins: 0, poles: 0, podiums: 0, races: 0, titles: 0, birthYear: birth ?? 0 };
      l.logs[c.name] = { ...g, titles: g.titles + 1 };
      const t = titlesOf({ ...l }, c.name);
      setRecord('titles', c.name, t, ended);
      if (age) setRecord('youngChamp-f1', c.name, age, ended);
      const top = table.reduce((b, x) => (x.wins > b.wins ? x : b), table[0]);
      setRecord('seasonWins', top.name, top.wins, ended);
      const tm = new Map<string, number>();
      s.results.filter((r) => r.season === ended && r.category === 'f1').forEach((r) => r.entries.forEach((e) => tm.set(e.team, (tm.get(e.team) ?? 0) + e.pts)));
      const best = [...tm.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) l.constructors = [...l.constructors, { season: ended, team: best[0], pts: best[1] }];
      news.push(nw(s, `wchamp-${ended}`, 'race', `${c.name} es campeón del mundo de F1 ${ended}`, `${t}º título para el piloto de ${c.team} con ${c.pts} puntos.`, [c.name, c.team]));
    }
    if (isMe) l = pushCel(l, { id: `title-${cat}-${ended}`, kind: 'title', title: cat === 'f1' ? '¡CAMPEÓN DEL MUNDO!' : `¡CAMPEÓN DE ${CAT_LABEL[cat].toUpperCase()}!`, sub: `${c.team} · ${ended} · ${c.pts} puntos` });
  }
  const summary = s.legacy.retired ? null : buildSummary(s, ended);
  const p = playerOf(s);
  if (summary) { l.summaries = [...l.summaries, summary].slice(-40); l.pendingSummary = summary; }
  if (p) l.ratingStart = rating(p);
  l.fpSeason = { season: s.season, n: 0 };
  s = { ...s, legacy: l };
  const ev = evolveF1(s, rng);
  s = { ...ev.state, legacy: { ...ev.state.legacy, hall: [...ev.state.legacy.hall, ...ev.hall] } };
  const rg = applyRegs(s, rng);
  return { state: rg.state, news: [...news, ...ev.news, ...rg.news] };
}

/* ───────────── Retiro y Salón de la Fama ───────────── */
export function legacyScore(s: GameState): { score: number; verdict: string } {
  const l = s.legacy, p = playerOf(s), f1 = l.logs[s.player.name], t1 = pTitles(s, 'f1'), lesser = pTitles(s) - t1;
  const recs = l.records.filter((r) => r.holder === s.player.name && !r.real).length;
  const score = t1 * 100 + lesser * 20 + (f1?.wins ?? 0) * 6 + (f1?.podiums ?? 0) * 2 + (f1?.poles ?? 0) * 2 + (p ? CATEGORIES.indexOf(p.category) * 6 : 0) + recs * 25 + l.trophies.length * 2;
  const verdict = t1 >= 3 || score >= 500 ? 'Leyenda de la F1' : t1 >= 1 ? 'Campeón del mundo' : (f1?.wins ?? 0) >= 1 ? 'Ganador de Grandes Premios' : p && p.category === 'f1' || (f1?.races ?? 0) > 0 ? 'Piloto de F1' : p && CATEGORIES.indexOf(p.category) >= 3 ? 'Promesa del automovilismo' : 'Piloto de formación';
  return { score, verdict };
}
export function retirePlayer(s: GameState): GameState {
  const p = playerOf(s);
  if (s.mode !== 'driver' || !p || s.legacy.retired) return s;
  const { score, verdict } = legacyScore(s);
  const l0 = s.legacy, age = ageOf(s, p);
  const teams = [...new Set(s.career.history.map((h) => h.team))].slice(-4).join(', ');
  const entry: HallEntry = { name: s.player.name, season: s.season, age, titles: pTitles(s, 'f1'), wins: s.career.stats.wins, podiums: s.career.stats.podiums, poles: s.career.stats.poles, peak: rating(p), verdict, player: true, teams };
  const l: Legacy = { ...l0, retired: { season: s.season, age, score, verdict }, hall: [...l0.hall, entry], fp: null,
    celebrations: [...l0.celebrations, { id: `hall-${s.season}`, kind: 'hall' as const, title: 'SALÓN DE LA FAMA', sub: `${s.player.name} · ${verdict}` }].slice(-8) };
  const out: NewsItem = nw(s, 'hall', 'system', 'Entras en el Salón de la Fama', `${s.player.name} cuelga el casco a los ${age} años: ${verdict}.`, [s.player.name]);
  return { ...s, legacy: l, offers: [], pendingRace: null, interview: null, lifeEvent: null,
    drivers: s.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, teamId: null, contract: null } : d)),
    career: { ...s.career, training: null, contract: null, candidacies: [], camp: null }, news: [out, ...s.news].slice(0, 500) };
}

/* ───────────── Prácticas libres de F1 como piloto de reserva ───────────── */
export const FP_RUNS = 6;
export const PROGRAMS: Record<FPRun['program'], { label: string; desc: string }> = {
  pace: { label: 'Vuelta rápida', desc: 'Una vuelta al límite con poco combustible. Tu tiempo se mide contra toda la parrilla.' },
  long: { label: 'Tanda larga', desc: 'Ritmo de carrera: mide cuánto sufren las gomas.' },
  aero: { label: 'Prueba aerodinámica', desc: 'Prueba piezas nuevas del equipo. Sin tiempo, pero suma.' },
  tyres: { label: 'Test de neumáticos', desc: 'Datos de gomas para Pirelli y el equipo.' },
};
export const GOALS = [
  { id: 'gap', label: 'Terminar a menos de 0,8 s del piloto titular' },
  { id: 'data', label: 'Completar al menos 2 programas de datos (tanda larga, aero o neumáticos)' },
  { id: 'clean', label: 'Sesión limpia: sin salidas de pista' },
] as const;

export function maybeInviteFP(s: GameState, rng: Rng, ev: { id: string; name: string }): { state: GameState; news: NewsItem[] } {
  const p = playerOf(s), l = s.legacy;
  if (s.mode !== 'driver' || !p || l.retired || l.fp || !s.career.reserve || p.injuryDays > 0 || s.career.contract?.category === 'f1') return { state: s, news: [] };
  const n = l.fpSeason.season === s.season ? l.fpSeason.n : 0;
  if (n >= 4 || rng.next() > 0.7) return { state: s, news: [] };
  const team = s.teams.find((t) => t.name === s.career.reserve?.team);
  if (!team) return { state: s, news: [] };
  const regs = s.drivers.filter((d) => d.teamId === team.id && d.category === 'f1' && d.id !== PLAYER_ID).sort((a, b) => rating(a) - rating(b));
  const fp = { id: `fp-${s.season}-${ev.id}`, eventId: ev.id, eventName: ev.name, team: team.name, teamId: team.id, replaces: regs[0]?.name ?? 'el titular', season: s.season, runsLeft: FP_RUNS, log: [], rank: null, summary: null };
  return {
    state: { ...s, legacy: { ...l, fp, fpSeason: { season: s.season, n: n + 1 } } },
    news: [nw(s, `fp-${ev.id}`, 'transfer', `${team.name} te cita en las FP1 del ${ev.name}`, `Te toca el coche de ${fp.replaces} en la primera sesión libre. Entra en «Prácticas F1».`, [s.player.name, team.name])],
  };
}

function fpPlayer(s: GameState): Participant | null {
  const fp = s.legacy.fp, p = playerOf(s);
  if (!fp || !p) return null;
  const idx = s.calendar.find((e) => e.id === fp.eventId)?.cn ?? 0;
  const field = buildCategoryField(s, 'f1', idx, false), tpl = field.find((x) => x.name === fp.replaces) ?? field.find((x) => x.team === fp.team) ?? field[0];
  if (!tpl) return null;
  const rookie = Math.max(0, 6 - s.legacy.fpDone * 1.5);
  return { ...tpl, id: PLAYER_ID, name: p.name, mine: true, number: p.number, driverRating: rating(p) - rookie + p.stats.experience * 0.02, tyreMgmt: p.stats.tyreManagement, focus: p.stats.focus, consistency: p.stats.consistency, adapt: p.stats.adaptability, over: p.stats.overtaking };
}
export interface FPRow { id: string; name: string; team: string; time: number | null; mine: boolean; regular: boolean }
export function fpTable(s: GameState): { rows: FPRow[]; regularTime: number | null; best: number | null } {
  const fp = s.legacy.fp, mine = fpPlayer(s);
  if (!fp || !mine) return { rows: [], regularTime: null, best: null };
  const idx = s.calendar.find((e) => e.id === fp.eventId)?.cn ?? 0, base = s.seed ^ (idx * 7919) ^ 0x51f;
  const rows: FPRow[] = buildCategoryField(s, 'f1', idx, false).map((x, i) => ({ id: x.id, name: x.name, team: x.team, mine: false, regular: x.name === fp.replaces, time: qualiAttempt(x, 'M', 'normal', base + i * 13, 2, 0) ?? practiceTime(x, base, 2) }));
  const regularTime = rows.find((r) => r.regular)?.time ?? null;
  const paceTimes = fp.log.filter((r) => r.program === 'pace' && r.time !== null).map((r) => r.time as number), best = paceTimes.length ? Math.min(...paceTimes) : null;
  const field = rows.filter((r) => !r.regular);
  field.push({ id: PLAYER_ID, name: mine.name, team: fp.team, time: best, mine: true, regular: false });
  return { rows: field.sort((a, b) => (a.time ?? 999) - (b.time ?? 999)), regularTime, best };
}

export function fpRun(s: GameState, program: FPRun['program'], tyre: Compound, mode: FPRun['mode']): GameState {
  const fp = s.legacy.fp, p = playerOf(s), mine = fpPlayer(s);
  if (!fp || !p || !mine || fp.runsLeft <= 0) return s;
  const damage = fp.log.filter((r) => r.crashed).length * 0.15, seed = s.seed ^ (fp.log.length * 7919) ^ (program.charCodeAt(0) * 131) ^ (tyre.charCodeAt(0) * 17);
  const r = new Rng(seed);
  const crashP = (program === 'pace' ? { normal: 0.01, push: 0.04, risk: 0.12 }[mode] : 0.01) * (1 + (100 - mine.focus) / 100) * (1 + Math.max(0, 5 - s.legacy.fpDone) * 0.1);
  let time: number | null = null, note = '', crashed = false;
  if (r.next() < crashP) { crashed = true; note = 'Te vas largo y tocas el muro. Los mecánicos se ponen a trabajar.'; }
  else if (program === 'pace') {
    time = qualiAttempt(mine, tyre, mode, seed, fp.log.filter((x) => x.program === 'pace').length, p.fatigue, false, damage);
    note = time === null ? 'Vuelta anulada por pasarte de los límites de pista.' : 'Vuelta completada.';
  } else if (program === 'long') {
    time = Math.round((practiceTime(mine, seed, fp.log.length) + { S: 0.25, M: 0, H: -0.1, W: 0 }[tyre]) * 1000) / 1000;
    const deg = (tyre === 'S' ? 3 : tyre === 'M' ? 2 : 1) - (mine.tyreMgmt - 55) / 40;
    note = deg > 2.4 ? 'Degradación alta: el neumático cae en pocas vueltas.' : deg > 1.4 ? 'Degradación media, ritmo estable.' : 'Degradación baja: buen ritmo sostenido.';
  } else if (program === 'aero') note = 'Pieza probada: el equipo toma nota.';
  else note = 'Gomas probadas: Pirelli y el equipo toman nota.';
  const run: FPRun = { program, tyre, mode, time, crashed, note };
  return { ...s, legacy: { ...s.legacy, fp: { ...fp, log: [...fp.log, run], runsLeft: crashed ? Math.max(0, fp.runsLeft - 2) : fp.runsLeft - 1 } } };
}

export function fpEval(s: GameState): { rank: number | null; goals: boolean[]; score: number; best: number | null; regularGap: number | null } {
  const fp = s.legacy.fp;
  if (!fp) return { rank: null, goals: [false, false, false], score: 0, best: null, regularGap: null };
  const t = fpTable(s), rank = t.best === null ? null : t.rows.findIndex((r) => r.mine) + 1;
  const gap = t.best !== null && t.regularTime !== null ? t.best - t.regularTime : null;
  const crashes = fp.log.filter((r) => r.crashed).length, data = fp.log.filter((r) => r.program !== 'pace' && !r.crashed).length;
  const goals = [gap !== null && gap <= 0.8, data >= 2, crashes === 0];
  const score = clamp(20 + goals.filter(Boolean).length * 15 + (rank === null ? -15 : rank <= 3 ? 25 : rank <= 8 ? 15 : rank <= 14 ? 8 : 0) - crashes * 20 + (t.best === null ? 0 : 5));
  return { rank, goals, score, best: t.best, regularGap: gap };
}

export function fpFinish(s: GameState): GameState {
  const fp = s.legacy.fp, p = playerOf(s);
  if (!fp || !p) return s;
  const ev = fpEval(s), rng = new Rng(s.seed ^ 0xf1f1), good = ev.score >= 70;
  const stats = { ...p.stats };
  stats.experience = Math.min(99, stats.experience + (good ? 2 : 1));
  if (ev.score >= 60) { const k = rng.pick(STAT_KEYS.filter((q) => q !== 'experience')); stats[k] = Math.min(99, stats[k] + 1); }
  const l = s.legacy, best = ev.rank === null ? l.fpBest : l.fpBest === null ? ev.rank : Math.min(l.fpBest, ev.rank);
  const verdict = ev.score >= 80 ? 'Sesión sobresaliente' : ev.score >= 60 ? 'Buena sesión' : ev.score >= 40 ? 'Sesión correcta' : 'Sesión para olvidar';
  const body = `${verdict} (${ev.score}/100). ${ev.rank ? `Terminas P${ev.rank} entre los 21 pilotos en pista.` : 'No dejas tiempo válido.'} ${good ? 'El equipo toma nota: tus opciones de llegar a la F1 suben.' : 'El equipo no cambia de opinión.'}`;
  const out = nw(s, `fpend-${fp.id}`, 'race', `FP1 ${fp.eventName}: ${ev.rank ? `P${ev.rank}` : 'sin tiempo'} con ${fp.team}`, body, [s.player.name, fp.team]);
  return { ...s, news: [out, ...s.news].slice(0, 500),
    drivers: s.drivers.map((d) => (d.id === PLAYER_ID ? { ...d, stats, reputation: clamp(d.reputation + (good ? 3 : ev.score >= 50 ? 1 : -1)), fatigue: clamp(d.fatigue + 8) } : d)),
    career: { ...s.career, popularity: clamp(s.career.popularity + (good ? 2 : 0)), relations: { ...s.career.relations, team: clamp(s.career.relations.team + Math.round((ev.score - 50) / 10)) } },
    legacy: { ...l, fp: null, fpDone: l.fpDone + 1, fpBest: best, impression: clamp(Math.round(l.impression * 0.6 + ev.score * 0.4)) } };
}
export function fpSkip(s: GameState): GameState {
  const fp = s.legacy.fp;
  if (!fp) return s;
  return { ...s, news: [nw(s, `fpskip-${fp.id}`, 'transfer', `Rechazas las FP1 de ${fp.team}`, 'El equipo no está contento con tu decisión.', [s.player.name, fp.team]), ...s.news].slice(0, 500),
    career: { ...s.career, relations: { ...s.career.relations, team: clamp(s.career.relations.team - 4) } }, legacy: { ...s.legacy, fp: null } };
}
/** Resuelve una sesión sin intervención (laboratorio de equilibrio). */
export function fpAuto(s: GameState): GameState {
  let st = s;
  const plan: [FPRun['program'], Compound, FPRun['mode']][] = [['pace', 'M', 'normal'], ['long', 'M', 'normal'], ['aero', 'M', 'normal'], ['pace', 'S', 'push'], ['tyres', 'H', 'normal'], ['pace', 'S', 'push']];
  for (const [a, b, c] of plan) { if (!st.legacy.fp || st.legacy.fp.runsLeft <= 0) break; st = fpRun(st, a, b, c); }
  return fpFinish(st);
}
