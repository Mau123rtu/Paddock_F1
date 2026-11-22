import type { Category, Driver, GameState, NewsItem, Rival } from '../types';
import { STAT_KEYS } from '../types';
import type { Rng } from './rng';
import { FIRSTS, JUNIOR, LASTS, LEVEL, NATS, PER_TEAM } from '../data/real';
import { AGE_MAX, CAT_LABEL, MIN_AGE, PLAYER_ID, THRESH, ageFactor, makeOffer, playerOf } from './career';
import { rating } from './market';
import { dm } from './difficulty';

type JCat = Exclude<Category, 'f1'>;
const nw = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string, involved: string[]): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved });
const salaryFor = (d: Driver) => Math.round(Math.max(1, (rating(d) - 50) * 0.25) * 10) / 10;
function addDays(iso: string, days: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
const NEXT: Record<JCat, Category> = { karting: 'f4', f4: 'f3', f3: 'f2', f2: 'f1' };
const AGE_RANGE: Record<JCat, [number, number]> = { karting: [10, 13], f4: [15, 16], f3: [16, 18], f2: [18, 21] };

/** Cada mes: rumores de fichajes que luego se confirman o se desmienten, movimientos reales a mitad de año y contactos de equipos contigo. */
export function worldMonthly(s: GameState, rng: Rng): { state: GameState; news: NewsItem[] } {
  const out: NewsItem[] = [];
  let st = s;
  const due = st.rumors.filter((r) => r.resolve <= st.date);
  const rumors = st.rumors.filter((r) => r.resolve > st.date);
  for (const r of due) {
    const d = st.drivers.find((x) => x.id === r.driverId), dest = st.teams.find((t) => t.id === r.toTeam);
    if (!d || !dest || d.teamId === dest.id) continue;
    if (!r.real) { out.push(nw(st, `deny-${r.id}`, 'transfer', `${dest.name} desmiente el interés en ${d.name}`, 'Los rumores no se confirman.', [d.name, dest.name])); continue; }
    const roster = st.drivers.filter((x) => x.teamId === dest.id), mates = roster.filter((x) => x.id !== PLAYER_ID).sort((a, b) => rating(a) - rating(b));
    const old = st.teams.find((t) => t.id === d.teamId);
    let weak: Driver | null = null;
    if (roster.length >= 2) { weak = mates[0] ?? null; if (!weak || rating(weak) >= rating(d)) continue; }
    const swap = !!weak && !!old && rng.next() < 0.5;
    const end = st.season + rng.int(1, 2);
    st = { ...st, drivers: st.drivers.map((x) => {
      if (x.id === d.id) return { ...x, teamId: dest.id, contract: { teamId: dest.id, salary: salaryFor(x), endSeason: end } };
      if (weak && x.id === weak.id) return swap && old ? { ...x, teamId: old.id, contract: { teamId: old.id, salary: salaryFor(x), endSeason: end } } : { ...x, teamId: null, contract: null };
      return x;
    }) };
    out.push(nw(st, `official-${r.id}`, 'transfer', `Oficial: ${d.name} ficha por ${dest.name}`,
      weak ? (swap ? `${weak.name} hace el camino inverso hacia ${old?.name}.` : `${weak.name} pierde su asiento y queda libre.`) : 'Ocupa el asiento que estaba libre.', [d.name, dest.name]));
  }
  const live = [...rumors];
  if (live.length < 2 && rng.next() < 0.6) {
    const stars = st.drivers.filter((x) => x.category === 'f1' && x.teamId && x.id !== PLAYER_ID && rating(x) >= 75);
    if (stars.length) {
      const target = rng.pick(stars);
      const dests = st.teams.filter((t) => t.entered && t.id !== target.teamId && t.id !== st.player.teamId
        && Math.min(...st.drivers.filter((x) => x.teamId === t.id && x.id !== PLAYER_ID).map(rating), 99) < rating(target) - 2);
      if (dests.length) {
        const dest = rng.pick(dests);
        live.push({ id: `ru${rng.int(0, 99999)}`, driverId: target.id, toTeam: dest.id, resolve: addDays(st.date, 30), real: rng.next() < 0.55 });
        out.push(nw(st, `rumor-${target.id}`, 'transfer', `Rumor: ${target.name} podría fichar por ${dest.name}`, 'Fuentes del paddock aseguran que hay conversaciones avanzadas.', [target.name, dest.name]));
      }
    }
  }
  if (rng.next() < 0.12) {
    const t = rng.pick(st.teams.filter((x) => x.entered && x.id !== st.player.teamId));
    if (t) out.push(nw(st, `princ-${t.id}`, 'system', `${t.name} destituye a su jefe de equipo`, 'La dirección busca un nuevo rumbo tras los últimos resultados.', [t.name]));
  }
  const p = playerOf(st);
  if (st.mode === 'driver' && p && !st.legacy.retired && st.offers.length === 0 && rng.next() < ((st.career.reserve ? 0.3 : 0.12) + (st.career.reserve ? st.legacy.impression / 600 : 0)) * dm(st).scout * ageFactor(st, p)) {
    const o = makeOffer(st, p, rng);
    if (o) {
      st = { ...st, offers: [o] };
      out.push(nw(st, 'contact', 'transfer', `${o.teamName} te contacta`, o.academy ? `Quieren que entres en ${o.academy}.` : 'Quieren hablar contigo sobre un contrato.', [st.player.name, o.teamName]));
    }
  }
  return { state: { ...st, rumors: live }, news: out };
}


/** Fin de temporada: los rivales de karting a F2 envejecen, mejoran, ascienden, se retiran y son sustituidos; los campeones y los graduados de F2 son noticia. */
export function worldSeasonEnd(s: GameState, ended: number, rng: Rng): { state: GameState; news: NewsItem[] } {
  const news: NewsItem[] = [];
  const cats: JCat[] = ['f2', 'f3', 'f4', 'karting'];
  let seq = s.rivalSeq, drivers = s.drivers;
  const kept: Record<JCat, Rival[]> = { karting: [], f4: [], f3: [], f2: [] }, incoming: Record<JCat, Rival[]> = { karting: [], f4: [], f3: [], f2: [] };
  const names = new Set<string>([...s.drivers.map((d) => d.name), ...cats.flatMap((c) => s.rivals[c].map((r) => r.name))]);
  const fresh = (cat: JCat): Rival => {
    let name = '';
    do { name = `${rng.pick(FIRSTS)} ${rng.pick(LASTS)}`; } while (names.has(name));
    names.add(name);
    const r = LEVEL[cat] + rng.int(-8, 8);
    return { id: `rv${seq++}`, name, nationality: rng.pick(NATS), birthYear: s.season - rng.int(AGE_RANGE[cat][0], AGE_RANGE[cat][1]), rating: r, potential: Math.min(99, r + rng.int(5, 25)), team: '', cat };
  };
  for (const cat of cats) {
    const pts = new Map<string, number>();
    s.results.filter((r) => r.season === ended && r.category === cat).forEach((r) => r.entries.forEach((e) => pts.set(e.id, (pts.get(e.id) ?? 0) + e.pts)));
    const list = [...s.rivals[cat]].sort((a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0) || b.rating - a.rating);
    if (list[0] && (pts.get(list[0].id) ?? 0) > 0) news.push(nw(s, `champ-${cat}`, 'race', `${list[0].name} gana el campeonato de ${CAT_LABEL[cat]}`, `Se proclama campeón en ${list[0].team}.`, [list[0].name, list[0].team]));
    const next = NEXT[cat], maxUp = cat === 'f2' ? 1 : 2;
    let up = 0;
    const leaving: Rival[] = [];
    list.forEach((r, i) => {
      const age = s.season - r.birthYear;
      if (i < 4 && up < maxUp && age >= MIN_AGE[next] && r.rating >= THRESH[next] - 5) {
        up++;
        if (next === 'f1') {
          const rt = Math.min(99, r.rating + 6);
          const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.min(99, Math.max(30, rt + rng.int(-5, 5)))])) as Driver['stats'];
          drivers = [...drivers, { id: `g${seq++}`, name: r.name, nationality: r.nationality, birthYear: r.birthYear, number: 60 + rng.int(0, 30), teamId: null, category: 'f1', stats, personality: 'humble', contract: null, fatigue: 0, injuryDays: 0, reputation: 45, potential: r.potential }];
          news.push(nw(s, `grad-${r.id}`, 'transfer', `${r.name} salta de la F2 al mercado de la F1`, 'Busca un asiento tras destacar en la categoría.', [r.name]));
        } else incoming[next as JCat].push({ ...r, cat: next as JCat });
        return;
      }
      if (age > AGE_MAX[cat] + 2 || (i >= list.length - 2 && age >= AGE_MAX[cat])) { leaving.push(r); return; }
      const d = age <= 17 ? rng.int(1, 4) : age <= 20 ? rng.int(0, 3) : age <= 24 ? rng.int(-1, 2) : rng.int(-2, 1);
      kept[cat].push({ ...r, rating: Math.max(25, Math.min(r.potential, r.rating + d)) });
    });
    leaving.sort((a, b) => b.rating - a.rating).slice(0, 2).forEach((r) => news.push({ ...nw(s, `retire-${r.id}`, 'transfer', `${r.name} anuncia su retirada de ${CAT_LABEL[cat]}`, `Deja la competición a los ${s.season - r.birthYear} años.`, [r.name]), important: false }));
  }
  const rivals = {} as Record<JCat, Rival[]>;
  for (const cat of cats) {
    const list = [...kept[cat]], count: Record<string, number> = {};
    list.forEach((r) => { count[r.team] = (count[r.team] ?? 0) + 1; });
    const vacancies: string[] = [];
    JUNIOR[cat].forEach((t) => { for (let k = count[t] ?? 0; k < PER_TEAM[cat]; k++) vacancies.push(t); });
    for (const r of incoming[cat]) { const v = vacancies.splice(rng.int(0, Math.max(0, vacancies.length - 1)), 1)[0]; if (v) list.push({ ...r, team: v }); }
    for (const v of vacancies) list.push({ ...fresh(cat), team: v });
    rivals[cat] = list;
  }
  return { state: { ...s, rivals, rivalSeq: seq, drivers }, news };
}
