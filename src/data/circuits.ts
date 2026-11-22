import type { CalendarEvent, Category } from '../types';
import { Rng } from '../systems/rng';

export interface Circuit { id: string; name: string; gp: string; venue: string; country: string; real: boolean; f4?: boolean; kart?: boolean; }
const C = (id: string, name: string, gp: string, venue: string, country: string, real: boolean, extra: Partial<Circuit> = {}): Circuit => ({ id, name, gp, venue, country, real, ...extra });
/** Los 24 circuitos reales del calendario de F1 (en orden de calendario), luego circuitos de rotación y, al final, kartódromos. El índice es el "número" estable del circuito. */
export const CIRCUITS: Circuit[] = [
  C('albert-park', 'Albert Park (Melbourne)', 'GP de Australia', 'Melbourne', 'Australia', true),
  C('shanghai', 'Shanghai International', 'GP de China', 'Shanghái', 'China', true),
  C('suzuka', 'Suzuka', 'GP de Japón', 'Suzuka', 'Japón', true),
  C('sakhir', 'Bahrain International', 'GP de Baréin', 'Sakhir', 'Baréin', true),
  C('jeddah', 'Jeddah Corniche', 'GP de Arabia Saudí', 'Yeda', 'Arabia Saudí', true),
  C('miami', 'Miami International Autodrome', 'GP de Miami', 'Miami', 'Estados Unidos', true),
  C('montreal', 'Gilles Villeneuve', 'GP de Canadá', 'Montreal', 'Canadá', true),
  C('monaco', 'Circuit de Monaco', 'GP de Mónaco', 'Montecarlo', 'Mónaco', true),
  C('barcelona', 'Barcelona-Catalunya', 'GP de Barcelona-Cataluña', 'Montmeló', 'España', true, { f4: true }),
  C('spielberg', 'Red Bull Ring', 'GP de Austria', 'Spielberg', 'Austria', true, { f4: true }),
  C('silverstone', 'Silverstone', 'GP de Gran Bretaña', 'Silverstone', 'Reino Unido', true),
  C('spa', 'Spa-Francorchamps', 'GP de Bélgica', 'Spa', 'Bélgica', true),
  C('hungaroring', 'Hungaroring', 'GP de Hungría', 'Budapest', 'Hungría', true, { f4: true }),
  C('zandvoort', 'Zandvoort', 'GP de los Países Bajos', 'Zandvoort', 'Países Bajos', true, { f4: true }),
  C('monza', 'Monza', 'GP de Italia', 'Monza', 'Italia', true),
  C('madrid', 'Madring (Madrid)', 'GP de Madrid', 'Madrid', 'España', true),
  C('baku', 'Baku City Circuit', 'GP de Azerbaiyán', 'Bakú', 'Azerbaiyán', true),
  C('marina-bay', 'Marina Bay', 'GP de Singapur', 'Singapur', 'Singapur', true),
  C('cota', 'Circuit of the Americas', 'GP de Estados Unidos', 'Austin', 'Estados Unidos', true),
  C('mexico', 'Autódromo Hermanos Rodríguez', 'GP de México', 'Ciudad de México', 'México', true),
  C('interlagos', 'Interlagos', 'GP de Brasil', 'São Paulo', 'Brasil', true),
  C('las-vegas', 'Las Vegas Strip Circuit', 'GP de Las Vegas', 'Las Vegas', 'Estados Unidos', true),
  C('lusail', 'Lusail International', 'GP de Catar', 'Lusail', 'Catar', true),
  C('yas-marina', 'Yas Marina', 'GP de Abu Dabi', 'Abu Dabi', 'Emiratos Árabes Unidos', true),
  // Circuitos de rotación: pueden entrar en el calendario de F1 y son los habituales de la F4.
  C('imola', 'Autodromo Enzo e Dino Ferrari', 'GP de Emilia-Romaña', 'Imola', 'Italia', false, { f4: true }),
  C('portimao', 'Autódromo do Algarve', 'GP de Portugal', 'Portimão', 'Portugal', false, { f4: true }),
  C('paul-ricard', 'Paul Ricard', 'GP de Francia', 'Le Castellet', 'Francia', false, { f4: true }),
  C('nurburgring', 'Nürburgring', 'GP de Eifel', 'Nürburg', 'Alemania', false, { f4: true }),
  C('hockenheim', 'Hockenheimring', 'GP de Alemania', 'Hockenheim', 'Alemania', false, { f4: true }),
  C('mugello', 'Mugello', 'GP de la Toscana', 'Scarperia', 'Italia', false, { f4: true }),
  C('estambul', 'Istanbul Park', 'GP de Turquía', 'Estambul', 'Turquía', false),
  C('kyalami', 'Kyalami', 'GP de Sudáfrica', 'Johannesburgo', 'Sudáfrica', false),
  C('sepang', 'Sepang International', 'GP de Malasia', 'Sepang', 'Malasia', false),
  C('yeongam', 'Korea International', 'GP de Corea', 'Yeongam', 'Corea del Sur', false),
  C('buenos-aires', 'Autódromo Óscar y Juan Gálvez', 'GP de Argentina', 'Buenos Aires', 'Argentina', false),
  C('kart-lonato', 'Kartódromo South Garda', 'Trofeo de Lonato', 'Lonato', 'Italia', false, { kart: true }),
  C('kart-genk', 'Kartodrome Genk', 'Trofeo de Genk', 'Genk', 'Bélgica', false, { kart: true }),
  C('kart-sarno', 'Circuito Internazionale Napoli', 'Trofeo de Sarno', 'Sarno', 'Italia', false, { kart: true }),
  C('kart-lemans', 'Circuit Alain Prost', 'Trofeo de Le Mans', 'Le Mans', 'Francia', false, { kart: true }),
  C('kart-kristianstad', 'Kristianstad Kartbana', 'Trofeo de Kristianstad', 'Kristianstad', 'Suecia', false, { kart: true }),
  C('kart-zuera', 'Kartódromo de Zuera', 'Trofeo de Zuera', 'Zuera', 'España', false, { kart: true }),
  C('kart-wackersdorf', 'Kartbahn Wackersdorf', 'Trofeo de Wackersdorf', 'Wackersdorf', 'Alemania', false, { kart: true }),
  C('kart-adria', 'Adria Karting Raceway', 'Trofeo de Adria', 'Adria', 'Italia', false, { kart: true }),
];
export const circuitNo = (id: string) => Math.max(0, CIRCUITS.findIndex((c) => c.id === id));
const F1_REAL = CIRCUITS.filter((c) => c.real), F1_EXTRA = CIRCUITS.filter((c) => !c.real && !c.kart), KART = CIRCUITS.filter((c) => c.kart), F4_POOL = CIRCUITS.filter((c) => c.f4);
/** Fechas base de los 24 fines de semana de F1 (mes-día). */
const SLOTS = ['03-08', '03-15', '03-29', '04-12', '04-19', '05-03', '05-24', '06-07', '06-14', '06-28', '07-05', '07-19', '07-26', '08-23', '09-06', '09-13', '09-26', '10-11', '10-25', '11-01', '11-08', '11-21', '11-29', '12-06'];
const shift = (date: string, days: number) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const shuffle = <T,>(a: readonly T[], r: Rng) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = r.int(0, i); [o[i], o[j]] = [o[j], o[i]]; } return o; };

export const ALL_CATS: Category[] = ['karting', 'f4', 'f3', 'f2', 'f1'];
export const eventHasCat = (e: CalendarEvent, cat: Category) => (e.cats ?? ['f1']).includes(cat);
/**
 * Calendario de la temporada, uno por categoría:
 *  - F1: los 24 circuitos reales; en temporadas posteriores puede cambiar 1–3 circuitos por otros de rotación y, a veces, tener 22–23 carreras.
 *  - F2 (13–15 citas) y F3 (9–11) corren en fines de semana de F1 (F3 dentro de los de F2).
 *  - F4 (7–9) y karting (5–7) tienen sus propios circuitos y fechas.
 */
export function buildSeasonCalendar(season: number, seed: number, rotate: boolean): CalendarEvent[] {
  const r = new Rng((seed ^ Math.imul(season, 2654435761)) | 0);
  let f1 = F1_REAL.map((c, i) => ({ c, md: SLOTS[i] }));
  if (rotate) {
    const x = r.next(), swaps = x < 0.4 ? 0 : x < 0.7 ? 1 : x < 0.9 ? 2 : 3;
    const extras = shuffle(F1_EXTRA, r);
    shuffle(f1.map((_, i) => i), r).slice(0, swaps).forEach((i, k) => { f1[i] = { ...f1[i], c: extras[k] }; });
    if (r.next() < 0.25) { const drop = r.int(1, 2); shuffle(f1.map((_, i) => i), r).slice(0, drop).forEach((i) => { f1[i] = null as never; }); f1 = f1.filter(Boolean); }
  }
  const ev = new Map<string, CalendarEvent>();
  const add = (date: string, c: Circuit, cat: Category) => {
    const cur = ev.get(date);
    if (cur) { cur.cats = [...cur.cats, cat]; return; }
    ev.set(date, { id: '', date, name: c.gp, kind: 'race', done: false, circuit: c.id, cn: circuitNo(c.id), cats: [cat] });
  };
  f1.forEach(({ c, md }) => add(`${season}-${md}`, c, 'f1'));
  const f2 = shuffle(f1, r).slice(0, r.int(13, 15)); f2.forEach(({ c, md }) => add(`${season}-${md}`, c, 'f2'));
  shuffle(f2, r).slice(0, r.int(9, 11)).forEach(({ c, md }) => add(`${season}-${md}`, c, 'f3'));
  const slots = shuffle(SLOTS, r), nF4 = r.int(7, 9), nK = r.int(5, 7);
  shuffle(F4_POOL, r).slice(0, nF4).forEach((c, i) => add(shift(`${season}-${slots[i]}`, -3), c, 'f4'));
  shuffle(KART, r).slice(0, nK).forEach((c, i) => add(shift(`${season}-${slots[nF4 + i]}`, -4), c, 'karting'));
  return [...ev.values()].sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => ({ ...e, id: `r${i + 1}`, cats: ALL_CATS.filter((k) => e.cats.includes(k)) }));
}

export interface Track { name: string; d: string; pts: [number, number][]; curv: number[]; }
const SHAPES: { name: string; pts: [number, number][] }[] = [
  { name: 'Circuito de la Costa', pts: [[20, 70], [18, 45], [30, 25], [55, 18], [80, 25], [88, 45], [75, 55], [60, 50], [50, 65], [62, 82], [40, 85]] },
  { name: 'Circuito de la Montaña', pts: [[15, 50], [25, 25], [50, 15], [75, 22], [85, 40], [70, 48], [85, 62], [70, 82], [45, 78], [35, 60], [20, 75]] },
  { name: 'Circuito Urbano', pts: [[12, 60], [22, 30], [45, 20], [48, 40], [62, 28], [85, 30], [90, 55], [72, 70], [60, 60], [50, 80], [28, 85]] },
  { name: 'Circuito del Lago', pts: [[20, 55], [30, 30], [52, 22], [70, 30], [82, 50], [72, 70], [50, 78], [35, 72], [28, 64]] },
  { name: 'Circuito del Desierto', pts: [[15, 30], [40, 15], [70, 18], [88, 35], [80, 55], [60, 60], [70, 78], [40, 85], [20, 70], [28, 50]] },
];
const cache: Record<number, Track> = {};
/** Forma base de cada circuito: una de las 5 plantillas, girada/espejada y retocada de forma estable según el circuito (es estilizada, no el trazado real). */
function shapeFor(n: number): [number, number][] {
  const r = new Rng(n * 7919 + 101), base = SHAPES[n % SHAPES.length].pts, rot = r.int(0, 3), flip = r.next() < 0.5;
  const clamp = (v: number) => Math.min(92, Math.max(8, v));
  return base.map(([x0, y0]) => {
    let x = flip ? 100 - x0 : x0, y = y0;
    for (let k = 0; k < rot; k++) [x, y] = [100 - y, x];
    return [clamp(x + (r.next() - 0.5) * (n < 24 ? 8 : 12)), clamp(y + (r.next() - 0.5) * (n < 24 ? 8 : 12))] as [number, number];
  });
}
/** Spline Catmull-Rom cerrada muestreada; la curvatura local alimenta la telemetría derivada. `i` es el número de circuito del catálogo. */
export function getTrack(i: number): Track {
  const k = ((i % CIRCUITS.length) + CIRCUITS.length) % CIRCUITS.length;
  if (cache[k]) return cache[k];
  const P = shapeFor(k), n = P.length, pts: [number, number][] = [];
  for (let j = 0; j < n; j++) {
    const [p0, p1, p2, p3] = [P[(j + n - 1) % n], P[j], P[(j + 1) % n], P[(j + 2) % n]];
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const m = pts.length;
  const raw = pts.map((_, i) => {
    const a = pts[(i - 4 + m) % m], b = pts[i], c = pts[(i + 4) % m];
    let d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  const mx = Math.max(...raw) || 1;
  cache[k] = { name: CIRCUITS[k].name, pts, curv: raw.map((v) => v / mx), d: 'M' + pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L') + 'Z' };
  return cache[k];
}
