import type { Category, Rival } from '../types';
import { Rng } from '../systems/rng';

/** Datos aproximados de equipos y pilotos reales. Las alineaciones cambian cada año: edítalos aquí. */
export interface RealTeam { id: string; name: string; color: string; budget: number; reputation: number; carPerf: number; }
export const F1_TEAMS: RealTeam[] = [
  { id: 'mercedes', name: 'Mercedes', color: '#00d2be', budget: 125, reputation: 90, carPerf: 86 },
  { id: 'ferrari', name: 'Ferrari', color: '#e8002d', budget: 125, reputation: 92, carPerf: 82 },
  { id: 'mclaren', name: 'McLaren', color: '#ff8000', budget: 120, reputation: 90, carPerf: 84 },
  { id: 'redbull', name: 'Red Bull Racing', color: '#3671c6', budget: 125, reputation: 91, carPerf: 80 },
  { id: 'aston', name: 'Aston Martin', color: '#229971', budget: 100, reputation: 70, carPerf: 70 },
  { id: 'williams', name: 'Williams', color: '#005aff', budget: 80, reputation: 66, carPerf: 68 },
  { id: 'racingbulls', name: 'Racing Bulls', color: '#6692ff', budget: 70, reputation: 60, carPerf: 66 },
  { id: 'audi', name: 'Audi', color: '#f50537', budget: 90, reputation: 64, carPerf: 64 },
  { id: 'haas', name: 'Haas', color: '#b6babd', budget: 60, reputation: 55, carPerf: 63 },
  { id: 'alpine', name: 'Alpine', color: '#ff87bc', budget: 85, reputation: 62, carPerf: 62 },
  { id: 'cadillac', name: 'Cadillac', color: '#9aa4b8', budget: 80, reputation: 40, carPerf: 52 },
];
export const F1_DRIVERS: { name: string; nat: string; birth: number; number: number; team: string; rating: number }[] = [
  { name: 'Max Verstappen', nat: 'Países Bajos', birth: 1997, number: 33, team: 'redbull', rating: 95 },
  { name: 'Isack Hadjar', nat: 'Francia', birth: 2004, number: 6, team: 'redbull', rating: 79 },
  { name: 'Charles Leclerc', nat: 'Mónaco', birth: 1997, number: 16, team: 'ferrari', rating: 91 },
  { name: 'Lewis Hamilton', nat: 'Reino Unido', birth: 1985, number: 44, team: 'ferrari', rating: 90 },
  { name: 'George Russell', nat: 'Reino Unido', birth: 1998, number: 63, team: 'mercedes', rating: 89 },
  { name: 'Kimi Antonelli', nat: 'Italia', birth: 2006, number: 12, team: 'mercedes', rating: 82 },
  { name: 'Lando Norris', nat: 'Reino Unido', birth: 1999, number: 4, team: 'mclaren', rating: 92 },
  { name: 'Oscar Piastri', nat: 'Australia', birth: 2001, number: 81, team: 'mclaren', rating: 90 },
  { name: 'Fernando Alonso', nat: 'España', birth: 1981, number: 14, team: 'aston', rating: 86 },
  { name: 'Lance Stroll', nat: 'Canadá', birth: 1998, number: 18, team: 'aston', rating: 76 },
  { name: 'Pierre Gasly', nat: 'Francia', birth: 1996, number: 10, team: 'alpine', rating: 82 },
  { name: 'Franco Colapinto', nat: 'Argentina', birth: 2003, number: 43, team: 'alpine', rating: 76 },
  { name: 'Alexander Albon', nat: 'Tailandia', birth: 1996, number: 23, team: 'williams', rating: 82 },
  { name: 'Carlos Sainz', nat: 'España', birth: 1994, number: 55, team: 'williams', rating: 87 },
  { name: 'Liam Lawson', nat: 'Nueva Zelanda', birth: 2002, number: 30, team: 'racingbulls', rating: 79 },
  { name: 'Arvid Lindblad', nat: 'Reino Unido', birth: 2007, number: 41, team: 'racingbulls', rating: 72 },
  { name: 'Rafael Câmara', nat: 'Brasil', birth: 2005, number: 21, team: 'haas', rating: 72 },
  { name: 'Oliver Bearman', nat: 'Reino Unido', birth: 2005, number: 87, team: 'haas', rating: 78 },
  { name: 'Nico Hülkenberg', nat: 'Alemania', birth: 1987, number: 27, team: 'audi', rating: 81 },
  { name: 'Gabriel Bortoleto', nat: 'Brasil', birth: 2004, number: 5, team: 'audi', rating: 77 },
  { name: 'Sergio Pérez', nat: 'México', birth: 1990, number: 11, team: 'cadillac', rating: 81 },
  { name: 'Valtteri Bottas', nat: 'Finlandia', birth: 1989, number: 77, team: 'cadillac', rating: 80 },
];

/** Equipos reales por categoría, de mejor a peor. Los pilotos rivales de estas categorías se generan cada temporada. */
export const JUNIOR: Record<Exclude<Category, 'f1'>, string[]> = {
  karting: ['Kart Republic', 'Tony Kart', 'CRG', 'Birel ART', 'Sodikart', 'Parolin'],
  f4: ['Prema Racing', 'US Racing', 'Van Amersfoort Racing', 'MP Motorsport', 'R-ace GP', 'Campos Racing', 'ART Grand Prix', 'Rodin Motorsport', 'Hitech', 'Jenzer Motorsport'],
  f3: ['PREMA Racing', 'TRIDENT', 'MP Motorsport', 'ART Grand Prix', 'Hitech', 'Campos Racing', 'Van Amersfoort Racing', 'Rodin Motorsport', 'AIX Racing', 'DAMS Lucas Oil'],
  f2: ['PREMA Racing', 'Invicta Racing', 'MP Motorsport', 'Hitech', 'DAMS Lucas Oil', 'ART Grand Prix', 'Campos Racing', 'TRIDENT', 'Rodin Motorsport', 'Van Amersfoort Racing', 'AIX Racing'],
};
export const PER_TEAM: Record<Category, number> = { karting: 2, f4: 2, f3: 3, f2: 2, f1: 2 };
export const LEVEL: Record<Category, number> = { karting: 42, f4: 50, f3: 58, f2: 66, f1: 76 };
export const teamStrength = (cat: Category, i: number, n: number) => LEVEL[cat] + 8 - (n > 1 ? (i * 16) / (n - 1) : 0);

export const ACADEMIES = [
  { teamId: 'ferrari', name: 'Ferrari Driver Academy' }, { teamId: 'mercedes', name: 'Mercedes Junior Team' },
  { teamId: 'redbull', name: 'Red Bull Junior Team' }, { teamId: 'mclaren', name: 'McLaren Driver Development' },
  { teamId: 'alpine', name: 'Alpine Academy' }, { teamId: 'williams', name: 'Williams Driver Academy' },
  { teamId: 'aston', name: 'Aston Martin Driver Development' },
];
/** Equipo de la categoría que acoge a los pilotos de una academia: las más fuertes colocan en los mejores equipos. */
export function partnerTeam(academy: string, cat: Category): string {
  if (cat === 'f1') return academy;
  const list = JUNIOR[cat], ai = Math.max(0, ACADEMIES.findIndex((a) => a.name === academy));
  return list[Math.min(list.length - 1, ai < 4 ? ai % 3 : 3 + (ai % 3))];
}

export const FIRSTS = ['Mateo', 'Lukas', 'Ethan', 'Hugo', 'Tomás', 'Kenji', 'Rafael', 'Niklas', 'Leo', 'Noah', 'Mattia', 'Théo', 'Jonas', 'Santiago', 'Arthur', 'Felix', 'Dario', 'Emilio', 'Kaito', 'Victor', 'Oscar', 'Gabriel', 'Luca', 'Marcos', 'Ivan', 'Tobias', 'Andrés', 'Pietro', 'Yuki', 'Samuel'];
export const LASTS = ['Varga', 'Moreau', 'Salvatore', 'Lindqvist', 'Okafor', 'Reyes', 'Brandt', 'Tanaka', 'Duval', 'Rossi', 'Kowalski', 'Almeida', 'Hartmann', 'Ferreira', 'Novak', 'Ibáñez', 'Bianchi', 'Olsen', 'Vidal', 'Mercier', 'Sato', 'Costa', 'Lehmann', 'Aguilar', 'Petrov', 'Marchetti', 'Soto', 'Keller', 'Navarro', 'Wolff'];
const CAT_IDX: Record<Category, number> = { karting: 0, f4: 1, f3: 2, f2: 3, f1: 4 };
export interface JuniorDriver { id: string; name: string; team: string; teamIdx: number; strength: number; rating: number; reliability: number; tyreMgmt: number; focus: number; consistency: number; number: number; }
/** Parrilla rival determinista por temporada y categoría: los nombres se mantienen en todas las carreras del año. */
export function juniorField(season: number, cat: Exclude<Category, 'f1'>): JuniorDriver[] {
  const list = JUNIOR[cat], out: JuniorDriver[] = [], seen = new Set<string>();
  list.forEach((team, i) => {
    const strength = teamStrength(cat, i, list.length);
    for (let k = 0; k < PER_TEAM[cat]; k++) {
      const r = new Rng(season * 1009 + CAT_IDX[cat] * 97 + i * 13 + k * 3 + 7);
      let name = '';
      do { name = `${r.pick(FIRSTS)} ${r.pick(LASTS)}`; } while (seen.has(name));
      seen.add(name);
      out.push({ id: `j-${cat}-${i}-${k}`, name, team, teamIdx: i, strength, number: i * 3 + k + 2,
        rating: Math.round(LEVEL[cat] + r.int(-8, 8) + (strength - LEVEL[cat]) * 0.25), reliability: r.int(70, 90), tyreMgmt: r.int(40, 80), focus: r.int(40, 80), consistency: r.int(40, 80) });
    }
  });
  return out;
}

export const NATS = ['México', 'España', 'Argentina', 'Brasil', 'Reino Unido', 'Francia', 'Italia', 'Alemania', 'Países Bajos', 'Japón', 'Australia', 'Canadá', 'Estados Unidos'];
const AGE_RANGE: Record<Exclude<Category, 'f1'>, [number, number]> = { karting: [10, 15], f4: [15, 18], f3: [17, 20], f2: [18, 23] };
/** Pilotos rivales persistentes: mantienen nombre, edad y trayectoria entre temporadas. */
export function initRivals(season: number, rng: Rng): Record<Exclude<Category, 'f1'>, Rival[]> {
  const out = {} as Record<Exclude<Category, 'f1'>, Rival[]>;
  (['karting', 'f4', 'f3', 'f2'] as const).forEach((cat) => {
    out[cat] = juniorField(season, cat).map((j, i) => ({
      id: `rv-${cat}-${i}`, name: j.name, nationality: rng.pick(NATS), birthYear: season - rng.int(AGE_RANGE[cat][0], AGE_RANGE[cat][1]),
      rating: j.rating, potential: Math.min(99, j.rating + rng.int(5, 25)), team: j.team, cat,
    }));
  });
  (['f2', 'f3'] as const).forEach((cat) => {
    JUNIOR[cat].forEach((team) => {
      const slots = out[cat].filter((r) => r.team === team);
      (REAL_ROSTER[cat][team] ?? []).slice(0, slots.length).forEach((rj, i) =>
        Object.assign(slots[i], { name: rj.name, nationality: rj.nat, birthYear: rj.birth, rating: rj.rating, potential: Math.min(99, rj.rating + rng.int(4, 18)) }));
    });
  });
  return out;
}

type RJ = { name: string; nat: string; birth: number; rating: number };
/** Alineaciones reales de F2 y F3 por equipo. Edades y niveles son estimaciones. Si un equipo tiene menos pilotos listados que plazas, el resto se genera. */
export const REAL_ROSTER: Record<'f2' | 'f3', Record<string, RJ[]>> = {
  f2: {
    'Invicta Racing': [{ name: 'Joshua Dürksen', nat: 'Paraguay', birth: 2003, rating: 68 }],
    'Hitech': [{ name: 'Ritomo Miyata', nat: 'Japón', birth: 2002, rating: 68 }, { name: 'Colton Herta', nat: 'Estados Unidos', birth: 2000, rating: 70 }],
    'Campos Racing': [{ name: 'Noel León', nat: 'México', birth: 2004, rating: 66 }, { name: 'Nikola Tsolov', nat: 'Bulgaria', birth: 2006, rating: 68 }],
    'DAMS Lucas Oil': [{ name: 'Dino Beganovic', nat: 'Suecia', birth: 2003, rating: 70 }, { name: 'Roman Bilinski', nat: 'Polonia', birth: 2004, rating: 64 }],
    'MP Motorsport': [{ name: 'Gabriele Minì', nat: 'Italia', birth: 2005, rating: 71 }, { name: 'Oliver Goethe', nat: 'Alemania', birth: 2003, rating: 64 }],
    'PREMA Racing': [{ name: 'Sebastián Montoya', nat: 'Colombia', birth: 2005, rating: 67 }, { name: 'Mari Boya', nat: 'España', birth: 2005, rating: 66 }],
    'Rodin Motorsport': [{ name: 'Martinius Stenshorne', nat: 'Noruega', birth: 2006, rating: 64 }, { name: 'Alexander Dunne', nat: 'Irlanda', birth: 2006, rating: 69 }],
    'ART Grand Prix': [{ name: 'Kush Maini', nat: 'India', birth: 1999, rating: 69 }, { name: 'Tasanapol Inthraphuvasak', nat: 'Tailandia', birth: 2003, rating: 62 }],
    'AIX Racing': [{ name: 'Emerson Fittipaldi', nat: 'Brasil', birth: 2003, rating: 63 }, { name: 'Cian Shields', nat: 'Reino Unido', birth: 2005, rating: 65 }],
    'Van Amersfoort Racing': [{ name: 'Hiyu Yamakoshi', nat: 'Japón', birth: 2006, rating: 63 }, { name: 'Rafael Villagómez', nat: 'México', birth: 2001, rating: 66 }],
    'TRIDENT': [{ name: 'Laurens van Hoepen', nat: 'Países Bajos', birth: 2004, rating: 66 }, { name: 'John Bennett', nat: 'Reino Unido', birth: 2005, rating: 62 }],
  },
  f3: {
    'Campos Racing': [{ name: 'Théophile Naël', nat: 'Francia', birth: 2005, rating: 60 }, { name: 'Ugo Ugochukwu', nat: 'Estados Unidos', birth: 2007, rating: 62 }, { name: 'Ernesto Rivera', nat: 'México', birth: 2007, rating: 56 }],
    'TRIDENT': [{ name: 'Noah Strømsted', nat: 'Dinamarca', birth: 2005, rating: 58 }, { name: 'Freddie Slater', nat: 'Reino Unido', birth: 2006, rating: 60 }, { name: 'Matteo De Palo', nat: 'Italia', birth: 2007, rating: 54 }],
    'MP Motorsport': [{ name: 'Mattia Colnaghi', nat: 'Argentina', birth: 2007, rating: 55 }, { name: 'Tuukka Taponen', nat: 'Finlandia', birth: 2006, rating: 59 }, { name: 'Alessandro Giusti', nat: 'Francia', birth: 2005, rating: 58 }],
    'ART Grand Prix': [{ name: 'Taito Kato', nat: 'Japón', birth: 2007, rating: 54 }, { name: 'Maciej Gładysz', nat: 'Polonia', birth: 2006, rating: 55 }, { name: 'Kanato Le', nat: 'Japón', birth: 2007, rating: 53 }],
    'Van Amersfoort Racing': [{ name: 'Enzo Deligny', nat: 'Francia', birth: 2006, rating: 56 }, { name: 'Bruno del Pino', nat: 'España', birth: 2007, rating: 54 }],
    'Rodin Motorsport': [{ name: 'Pedro Clerot', nat: 'Brasil', birth: 2007, rating: 55 }, { name: 'Brando Badoer', nat: 'Italia', birth: 2005, rating: 62 }, { name: 'Niccolò Maccagnani', nat: 'Italia', birth: 2007, rating: 54 }],
    'PREMA Racing': [{ name: 'Alex Powell', nat: 'Jamaica', birth: 2005, rating: 57 }, { name: 'James Wharton', nat: 'Australia', birth: 2006, rating: 59 }, { name: 'José Garfias', nat: 'México', birth: 2007, rating: 56 }],
    'Hitech': [{ name: 'Woohyun Shin', nat: 'Corea del Sur', birth: 2007, rating: 53 }, { name: 'Fionn McLaughlin', nat: 'Irlanda', birth: 2006, rating: 55 }, { name: 'Jin Nakamura', nat: 'Japón', birth: 2007, rating: 54 }],
    'AIX Racing': [{ name: 'Ricardo Escotto', nat: 'México', birth: 2006, rating: 55 }, { name: 'Yevan David', nat: 'Sri Lanka', birth: 2006, rating: 55 }, { name: 'Fernando Barrichello', nat: 'Brasil', birth: 2007, rating: 54 }],
    'DAMS Lucas Oil': [{ name: 'Nicola Lacorte', nat: 'Italia', birth: 2005, rating: 57 }, { name: 'Nandhavud Bhirombhakdi', nat: 'Tailandia', birth: 2006, rating: 53 }, { name: 'Gerrard Xie', nat: 'China', birth: 2007, rating: 52 }],
  },
};
