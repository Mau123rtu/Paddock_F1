import type { Category, GameState, NewsItem, Rival } from '../types';
import { JUNIOR } from '../data/real';
import { playerOf } from './career';
import { rating } from './market';
import { titlesOf } from './legacy';

const SERIES_HINTS: [RegExp, Category][] = [
  [/\bF1\b|Fórmula 1|Gran Premio|mundial de F1/i, 'f1'], [/Fórmula 2|\bF2\b/i, 'f2'], [/Fórmula 3|\bF3\b/i, 'f3'], [/Fórmula 4|\bF4\b/i, 'f4'], [/karting/i, 'karting'],
];
const BIG = /campe[óo]n del mundo|r[ée]cord|reglament|Salón de la Fama|anuncia su retirada|FIA|tope de costes|normativa/i;

/** Deduce a qué categorías pertenece una noticia y si es importante para todo el mundo. */
export function inferMeta(s: GameState, n: NewsItem): { series: Category[]; important: boolean } {
  const set = new Set<Category>(n.series ?? []);
  const p = playerOf(s), rivals = (Object.entries(s.rivals) as [Category, Rival[]][]).flatMap(([c, l]) => l.map((r) => ({ name: r.name, category: c })));
  let star = false;
  for (const name of n.involved) {
    if (name === s.player.name) { if (p) set.add(p.category); continue; }
    const d = s.drivers.find((x) => x.name === name);
    if (d) { set.add('f1'); if (rating(d) >= 85 || titlesOf(s.legacy, name) > 0) star = true; continue; }
    const r = rivals.find((x) => x.name === name);
    if (r) { set.add(r.category); continue; }
    if (s.teams.some((t) => t.name === name)) { set.add('f1'); continue; }
    (Object.keys(JUNIOR) as Exclude<Category, 'f1'>[]).forEach((c) => { if (JUNIOR[c].includes(name)) set.add(c); });
  }
  if (set.size === 0) SERIES_HINTS.forEach(([re, c]) => { if (re.test(n.headline)) set.add(c); });
  const important = n.important ?? (BIG.test(n.headline) || (n.category === 'transfer' && star) || n.id.startsWith('rookie-'));
  return { series: [...set], important };
}

/** Etiqueta las noticias recién creadas (las nuevas van delante de la lista). */
export function tagNews(s: GameState): GameState {
  let i = s.news.findIndex((n) => n.series !== undefined);
  if (i === -1) i = Math.min(s.news.length, 60);
  if (i <= 0) return s;
  const news = s.news.slice();
  for (let k = 0; k < i; k++) news[k] = { ...news[k], ...inferMeta(s, news[k]) };
  return { ...s, news };
}
