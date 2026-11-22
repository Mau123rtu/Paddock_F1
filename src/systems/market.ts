import type { Driver, GameState, NewsItem } from '../types';
import { STAT_KEYS } from '../types';
import type { Rng } from './rng';
import { dm } from './difficulty';

export const rating = (d: Driver) => Math.round(STAT_KEYS.reduce((a, k) => a + d.stats[k], 0) / STAT_KEYS.length);
export const askingSalary = (d: Driver) => Math.round(Math.max(1, (rating(d) - 50) * 0.25) * 10) / 10;
export const asking = (s: GameState, d: Driver) => Math.round(askingSalary(d) * dm(s).ask * 10) / 10;
export const roster = (s: GameState, teamId: string) => s.drivers.filter((d) => d.teamId === teamId);
export const payroll = (s: GameState, teamId: string) => roster(s, teamId).reduce((a, d) => a + (d.contract?.salary ?? 0), 0);
export const freeAgents = (s: GameState) =>
  s.drivers.filter((d) => d.id !== s.player.driverId && d.teamId === null && d.category === 'f1')
    .sort((a, b) => rating(b) - rating(a));
const payrollLimit = (budget: number) => budget * 0.3;

const news = (s: GameState, id: string, category: NewsItem['category'], headline: string, body: string, involved: string[]): NewsItem =>
  ({ id: `${id}-${s.date}`, date: s.date, category, headline, body, involved });

const setDriver = (s: GameState, id: string, patch: Partial<Driver>): GameState =>
  ({ ...s, drivers: s.drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)) });

/** Fin de temporada: los contratos vencidos dejan libres a los pilotos. */
export function expireContracts(s: GameState, endedSeason: number) {
  const out: NewsItem[] = [];
  const drivers = s.drivers.map((d) => {
    if (d.contract && d.contract.endSeason <= endedSeason) {
      const team = s.teams.find((t) => t.id === d.teamId);
      out.push(news(s, `exp-${d.id}`, 'transfer', `${d.name} queda libre`, `Su contrato con ${team?.name ?? 'su equipo'} terminó y llega al mercado.`, [d.name, team?.name ?? '']));
      return { ...d, teamId: null, contract: null };
    }
    return d;
  });
  return { state: { ...s, drivers }, news: out };
}

/** Los equipos controlados por la IA completan su alineación con el mejor agente libre que puedan pagar. */
export function aiSigning(s: GameState, rng: Rng) {
  const out: NewsItem[] = [];
  let st = s;
  for (const team of s.teams) {
    if (team.id === s.player.teamId || roster(st, team.id).length >= 2 || rng.next() > 0.35) continue;
    const pick = freeAgents(st).find((d) => payroll(st, team.id) + askingSalary(d) <= payrollLimit(team.budget));
    if (!pick) continue;
    const years = rng.int(1, 3);
    st = setDriver(st, pick.id, { teamId: team.id, contract: { teamId: team.id, salary: askingSalary(pick), endSeason: st.season + years - 1 } });
    out.push(news(st, `sign-${pick.id}`, 'transfer', `${team.name} ficha a ${pick.name}`, `Contrato de ${years} temporada(s) por ${askingSalary(pick)} M anuales.`, [team.name, pick.name]));
  }
  return { state: st, news: out };
}

export function signDriver(s: GameState, driverId: string, salary: number, years: number): GameState {
  const team = s.teams.find((t) => t.id === s.player.teamId);
  const d = s.drivers.find((x) => x.id === driverId);
  if (s.mode !== 'principal' || !team || !d || d.teamId !== null || roster(s, team.id).length >= 2) return s;
  const reject = (why: string) => ({ ...s, news: [news(s, `rej-${d.id}`, 'transfer', `${d.name} rechaza a ${team.name}`, why, [d.name, team.name]), ...s.news] });
  if (salary < asking(s, d)) return reject(`La oferta de ${salary} M queda por debajo de lo que pide (${asking(s, d)} M).`);
  if (payroll(s, team.id) + salary > payrollLimit(team.budget)) return reject('La oferta supera el límite salarial que permite el presupuesto del equipo.');
  const signed = setDriver(s, d.id, { teamId: team.id, contract: { teamId: team.id, salary, endSeason: s.season + years - 1 } });
  return { ...signed, news: [news(s, `sign-${d.id}`, 'transfer', `${team.name} ficha a ${d.name}`, `Contrato de ${years} temporada(s) por ${salary} M anuales.`, [team.name, d.name]), ...s.news] };
}

export function releaseDriver(s: GameState, driverId: string): GameState {
  const d = s.drivers.find((x) => x.id === driverId);
  if (s.mode !== 'principal' || !d || !d.contract || d.teamId !== s.player.teamId) return s;
  const fee = Math.round(d.contract.salary * (d.contract.endSeason - s.season + 1) * 0.5 * 10) / 10;
  const teams = s.teams.map((t) => (t.id === d.teamId ? { ...t, budget: Math.round((t.budget - fee) * 10) / 10 } : t));
  const released = setDriver({ ...s, teams }, d.id, { teamId: null, contract: null });
  return { ...released, news: [news(s, `rel-${d.id}`, 'transfer', `${d.name} deja ${teams.find((t) => t.id === s.player.teamId)?.name}`, `La rescisión cuesta ${fee} M al equipo.`, [d.name]), ...s.news] };
}
