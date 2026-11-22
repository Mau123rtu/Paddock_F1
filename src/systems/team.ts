import { clash } from '../data/sponsors';
import type { CarComponent, GameState, NewsItem, SponsorDeal, Staff, StaffRole, Team, TeamOps } from '../types';
import { Rng } from './rng';
import { payroll } from './market';
import { dm } from './difficulty';
import { FIRST_NAMES, LAST_NAMES } from '../data/world';

export const ROLES: StaffRole[] = ['aero', 'engineering', 'design', 'strategy', 'mechanics', 'marketing'];
export const ROLE_LABEL: Record<StaffRole, string> = {
  aero: 'Aerodinámica', engineering: 'Ingeniería', design: 'Diseño', strategy: 'Estrategia', mechanics: 'Mecánicos', marketing: 'Marketing',
};
export const COMPONENTS = [
  { id: 'chassis', label: 'Chasis', aero: false }, { id: 'frontWing', label: 'Alerón delantero', aero: true },
  { id: 'rearWing', label: 'Alerón trasero', aero: true }, { id: 'floor', label: 'Suelo', aero: true },
  { id: 'sidepods', label: 'Pontones', aero: true }, { id: 'suspension', label: 'Suspensión', aero: false },
  { id: 'powerUnit', label: 'Unidad de potencia', aero: false }, { id: 'gearbox', label: 'Caja de cambios', aero: false },
  { id: 'cooling', label: 'Refrigeración', aero: false }, { id: 'brakes', label: 'Frenos', aero: false },
];
const SPONSOR_NAMES = ['Vertex Energy', 'Lumina Telecom', 'Atlas Bank', 'Nova Fuels', 'Kiro Watches', 'Polar Drinks', 'Zenith Air'];
const clamp = (v: number) => Math.min(99, Math.max(0, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
export const staffSalary = (skill: number) => r1(Math.max(0.3, (skill - 30) * 0.03));
export const MAX_PER_ROLE = 2, MAX_PROJECTS = 3;

const person = (rng: Rng, id: string, role: StaffRole, lo: number, hi: number): Staff => {
  const skill = clamp(rng.int(lo, hi));
  return { id, name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, role, skill, salary: staffSalary(skill) };
};
export function createPool(rng: Rng, n: number, prefix: string): Staff[] {
  return Array.from({ length: n }, (_, i) => person(rng, `${prefix}-${i}`, rng.pick(ROLES), 40, 85));
}
export function createOps(rng: Rng, team: Team, season: number): TeamOps {
  const rep = team.reputation;
  const staff = ROLES.map((r, i) => person(rng, `s${i}`, r, Math.max(35, rep - 15), Math.min(90, rep + 8)));
  const car: CarComponent[] = COMPONENTS.map((c) => ({
    id: c.id, label: c.label, performance: clamp(Math.round(team.carPerf + rng.int(-4, 4))), reliability: clamp(rng.int(62, 88)), level: 1,
  }));
  const sponsors: SponsorDeal[] = [0, 1].map((i) => ({
    id: `sp${i}`, name: SPONSOR_NAMES[i + (rep % 3)], pay: r1(rep * 0.07 + rng.int(0, 2)), endSeason: season + i,
  }));
  return { staff, car, projects: [], sponsors, ledger: [], devSpent: 0, academy: [] };
}
export const carRating = (ops: TeamOps) => (ops.car.length ? Math.round(ops.car.reduce((a, c) => a + c.performance, 0) / ops.car.length) : 0);
export const bestSkill = (ops: TeamOps, role: StaffRole) => Math.max(40, ...ops.staff.filter((x) => x.role === role).map((x) => x.skill));
export const projectCost = (level: number) => r1(3 + level * 1.5);
export const projectDays = (ops: TeamOps) => Math.max(10, Math.round(60 - (bestSkill(ops, 'engineering') + bestSkill(ops, 'design')) * 0.2));
export const annualIncome = (s: GameState, team: Team) => r1((s.ops.sponsors.reduce((a, d) => a + d.pay, 0) + (team.entered ? 6 + team.reputation * 0.2 : 0)) * dm(s).income);
export const annualExpenses = (s: GameState, team: Team) => r1((payroll(s, team.id) + s.ops.staff.reduce((a, x) => a + x.salary, 0) + 8 + team.reputation * 0.1) * dm(s).expense * (1 - ((s.principal?.management ?? 50) - 50) / 400));

const myTeam = (s: GameState) => s.teams.find((t) => t.id === s.player.teamId);
const news = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string, involved: string[]): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved });
const withNews = (s: GameState, n: NewsItem): GameState => ({ ...s, news: [n, ...s.news] });
const setBudget = (s: GameState, delta: number): GameState =>
  ({ ...s, teams: s.teams.map((t) => (t.id === s.player.teamId ? { ...t, budget: r2(t.budget + delta) } : t)) });

/** Cada día: avanzan los proyectos de desarrollo; cada día 1 de mes: finanzas y evolución de los rivales. */
export function teamStep(s: GameState, rng: Rng) {
  const out: NewsItem[] = [];
  let st = s;
  const team = myTeam(s);
  if (s.mode === 'principal' && team) {
    const projects = s.ops.projects.map((p) => ({ ...p, daysLeft: p.daysLeft - 1 }));
    let car = s.ops.car;
    for (const p of projects.filter((x) => x.daysLeft <= 0)) {
      const comp = COMPONENTS.find((c) => c.id === p.componentId);
      const skill = bestSkill(s.ops, comp?.aero ? 'aero' : 'engineering');
      const gain = Math.max(1, Math.round(1 + rng.next() * 2 + (skill - 50) / 25));
      const loss = rng.int(0, bestSkill(s.ops, 'mechanics') < 60 ? 5 : 3);
      car = car.map((c) => (c.id === p.componentId ? { ...c, performance: clamp(c.performance + gain), reliability: clamp(c.reliability - loss), level: c.level + 1 } : c));
      out.push(news(s, `dev-${p.id}`, 'system', `Mejora lista: ${p.label}`, `Rendimiento +${gain}, fiabilidad -${loss}.`, [team.name]));
    }
    const ops = { ...s.ops, projects: projects.filter((x) => x.daysLeft > 0), car };
    st = { ...st, ops, teams: st.teams.map((t) => (t.id === team.id ? { ...t, carPerf: carRating(ops) } : t)) };
  }
  if (s.date.endsWith('-01')) {
    if (team) {
      const inc = r2(annualIncome(st, team) / 12), exp = r2(annualExpenses(st, team) / 12);
      st = setBudget(st, inc - exp);
      st = { ...st, ops: { ...st.ops, ledger: [...st.ops.ledger, { month: s.date.slice(0, 7), income: inc, expenses: exp }].slice(-24) } };
      if ((myTeam(st)?.budget ?? 0) < 0) out.push(news(s, 'debt', 'finance', `${team.name} entra en números rojos`, 'El presupuesto es negativo: no podrás iniciar desarrollos ni fichar hasta recuperarlo.', [team.name]));
    }
    st = { ...st, teams: st.teams.map((t) => {
      if (t.id === st.player.teamId || rng.next() > 0.25) return t;
      const g = rng.int(1, 2);
      out.push(news(s, `ai-${t.id}`, 'system', `${t.name} presenta mejoras`, `Su monoplaza gana ${g} punto(s) de rendimiento.`, [t.name]));
      return { ...t, carPerf: clamp(t.carPerf + g) };
    }) };
  }
  return { state: st, news: out };
}

/** Fin de temporada: vencen patrocinios, llegan nuevas ofertas y nuevos candidatos de personal. */
export function teamSeasonEnd(s: GameState, ended: number, rng: Rng) {
  const out: NewsItem[] = [];
  if (s.mode !== 'principal') return { state: s, news: out };
  const team = myTeam(s);
  if (!team) return { state: s, news: out };
  const gone = s.ops.sponsors.filter((d) => d.endSeason <= ended);
  gone.forEach((d) => out.push(news(s, `spend-${d.id}`, 'finance', `${d.name} finaliza su patrocinio`, `Dejas de ingresar ${d.pay} M anuales.`, [team.name, d.name])));
  const mk = bestSkill(s.ops, 'marketing');
  const offers: SponsorDeal[] = [0, 1].map((i) => ({
    id: `so-${s.season}-${i}`, name: rng.pick(SPONSOR_NAMES), endSeason: s.season + rng.int(0, 2),
    pay: r1(team.reputation * 0.07 * (1 + mk / 200) * (0.8 + rng.next() * 0.5)),
  }));
  if (offers.length) out.push(news(s, 'spoff', 'finance', 'Nuevas ofertas de patrocinio', `${offers.length} marcas quieren trabajar con ${team.name}.`, [team.name]));
  return {
    state: { ...s, sponsorOffers: offers, staffPool: [...s.staffPool.slice(-8), ...createPool(rng, 4, `st${s.season}`)], ops: { ...s.ops, devSpent: 0, sponsors: s.ops.sponsors.filter((d) => d.endSeason > ended) } },
    news: out,
  };
}

export function hireStaff(s: GameState, id: string): GameState {
  const team = myTeam(s), c = s.staffPool.find((x) => x.id === id);
  if (s.mode !== 'principal' || !team || !c) return s;
  if (s.ops.staff.filter((x) => x.role === c.role).length >= MAX_PER_ROLE)
    return withNews(s, news(s, `hfull-${id}`, 'system', 'Departamento completo', `${ROLE_LABEL[c.role]} ya tiene ${MAX_PER_ROLE} empleados.`, [team.name]));
  if (team.budget <= 0) return withNews(s, news(s, `hbud-${id}`, 'finance', 'Sin fondos', 'No puedes contratar con el presupuesto en negativo.', [team.name]));
  return withNews({ ...s, staffPool: s.staffPool.filter((x) => x.id !== id), ops: { ...s.ops, staff: [...s.ops.staff, c] } },
    news(s, `hire-${id}`, 'transfer', `${team.name} ficha a ${c.name}`, `Nuevo en ${ROLE_LABEL[c.role]} (nivel ${c.skill}), ${c.salary} M anuales.`, [team.name, c.name]));
}
export function fireStaff(s: GameState, id: string): GameState {
  const team = myTeam(s), x = s.ops.staff.find((y) => y.id === id);
  if (s.mode !== 'principal' || !team || !x) return s;
  const fee = r1(x.salary * 0.5);
  return withNews(setBudget({ ...s, ops: { ...s.ops, staff: s.ops.staff.filter((y) => y.id !== id) } }, -fee),
    news(s, `fire-${id}`, 'transfer', `${team.name} despide a ${x.name}`, `La indemnización cuesta ${fee} M.`, [team.name, x.name]));
}
export function startProject(s: GameState, componentId: string): GameState {
  const team = myTeam(s), c = s.ops.car.find((x) => x.id === componentId);
  if (s.mode !== 'principal' || !team || !c) return s;
  const cost = projectCost(c.level);
  const refuse = (why: string) => withNews(s, news(s, `pref-${componentId}`, 'system', 'Desarrollo no iniciado', why, [team.name]));
  if (s.ops.projects.some((p) => p.componentId === componentId)) return refuse(`${c.label} ya está en desarrollo.`);
  if (s.ops.projects.length >= MAX_PROJECTS) return refuse(`Solo se pueden llevar ${MAX_PROJECTS} proyectos a la vez.`);
  if (team.budget < cost) return refuse(`Cuesta ${cost} M y el presupuesto es ${team.budget} M.`);
  if (s.ops.devSpent + cost > dm(s).cap) return refuse(`Límite de gasto en desarrollo: llevas ${s.ops.devSpent} M de ${dm(s).cap} M esta temporada.`);
  const p = { id: `p-${s.date}-${componentId}`, componentId, label: c.label, daysLeft: projectDays(s.ops), cost };
  return setBudget({ ...s, ops: { ...s.ops, projects: [...s.ops.projects, p], devSpent: r1(s.ops.devSpent + cost) } }, -cost);
}
export function acceptSponsor(s: GameState, id: string): GameState {
  const team = myTeam(s), o = s.sponsorOffers.find((x) => x.id === id);
  if (s.mode !== 'principal' || !team || !o) return s;
  const rival = clash(o.name, s.ops.sponsors.map((x) => x.name));
  if (rival) return withNews(s, news(s, `spclash-${id}`, 'finance', `${o.name} no quiere compartir con ${rival}`, `Son competidores directos. Rescinde con ${rival} o rechaza la oferta.`, [team.name, o.name]));
  return withNews({ ...s, sponsorOffers: s.sponsorOffers.filter((x) => x.id !== id), ops: { ...s.ops, sponsors: [...s.ops.sponsors, o] } },
    news(s, `spacc-${id}`, 'finance', `${o.name} patrocina a ${team.name}`, `${o.pay} M anuales hasta ${o.endSeason}.`, [team.name, o.name]));
}
export const declineSponsor = (s: GameState, id: string): GameState => ({ ...s, sponsorOffers: s.sponsorOffers.filter((x) => x.id !== id) });
export function dropSponsor(s: GameState, id: string): GameState {
  const team = myTeam(s), d = s.ops.sponsors.find((x) => x.id === id);
  if (s.mode !== 'principal' || !team || !d) return s;
  const fee = r1(d.pay * 0.25);
  return withNews(setBudget({ ...s, ops: { ...s.ops, sponsors: s.ops.sponsors.filter((x) => x.id !== id) } }, -fee),
    news(s, `spdrop-${id}`, 'finance', `${team.name} rompe con ${d.name}`, `La penalización cuesta ${fee} M.`, [team.name, d.name]));
}
