import type { Action, Alert, Category, Driver, GameState, NewGameSetup, NewsItem, Personality, Team } from '../../types';
import { STAT_KEYS } from '../../types';
import { Rng } from '../../systems/rng';
import { aiSigning, expireContracts, releaseDriver, signDriver } from '../../systems/market';
import { PLAYER_ID, canRace, careerStep, declineOffer, respondOffer, seasonEnd, setTraining } from '../../systems/career';
import { createOps, createPool, declineSponsor, acceptSponsor, dropSponsor, fireStaff, hireStaff, startProject, teamSeasonEnd, teamStep } from '../../systems/team';
import { applySponsor, sponsorStep, acceptPersonalSponsor, answerInterview, dropPersonalSponsor, extrasSeasonEnd, extrasStep, newCareer, setSetup } from '../../systems/extras';
import { fiaStep, investFacilities, lobbyFia, newApplication, newTeamOps, startOffers, submitApplication } from '../../systems/fia';
import { askAgent, fireAgent, hireAgent, createYouth, peopleMonthly, peopleSeasonEnd, promoteYouth, releaseYouth, renewDriver, signYouth } from '../../systems/people';
import { autoRace, finishRace, simulateOthers } from '../../systems/race';
import { F1_DRIVERS, initRivals } from '../../data/real';
import { answerLife, lifeMonthly, toggleService } from '../../systems/life';
import { campTest } from '../../systems/camp';
import { worldMonthly, worldSeasonEnd } from '../../systems/world';
import { applyTo, requestReserve, spendPoint } from '../../systems/career';
import { tagNews } from '../../systems/newsMeta';
import { fpAuto, fpFinish, fpRun, fpSkip, legacySeasonEnd, maybeInviteFP, newLegacy, retirePlayer, updateLegacy } from '../../systems/legacy';
import { eventHasCat } from '../../data/circuits';
import { buildCalendar, FIRST_NAMES, LAST_NAMES, NATIONALITIES, TEAMS } from '../../data/world';

export const SCHEMA_VERSION = 16;

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomDriver(rng: Rng, i: number, teamId: string | null, season: number): Driver {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(55, 88)])) as Driver['stats'];
  const avg = STAT_KEYS.reduce((acc, k) => acc + stats[k], 0) / STAT_KEYS.length;
  return {
    id: `ai${i}`, name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, nationality: rng.pick(NATIONALITIES),
    birthYear: season - rng.int(20, 34), number: 10 + i, teamId, category: 'f1', stats, personality: 'professional', fatigue: 0, injuryDays: 0, reputation: rng.int(30, 80),
    contract: teamId ? { teamId, salary: Math.round(Math.max(1, (avg - 50) * 0.25) * 10) / 10, endSeason: season + rng.int(0, 2) } : null,
  };
}

export function createGame(setup: NewGameSetup): GameState {
  const rng = new Rng(Math.floor(Math.random() * 2 ** 31));
  const PERS: Personality[] = ['humble', 'egocentric', 'competitive', 'professional', 'charismatic', 'reserved'];
  const drivers: Driver[] = F1_DRIVERS.map((d, i) => {
    const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.min(99, Math.max(30, d.rating + rng.int(-6, 6)))])) as Driver['stats'];
    return {
      id: `f1-${i}`, name: d.name, nationality: d.nat, birthYear: d.birth, number: d.number, teamId: d.team, category: 'f1' as const, stats,
      personality: rng.pick(PERS), contract: { teamId: d.team, salary: Math.round(Math.max(1, (d.rating - 50) * 0.25) * 10) / 10, endSeason: setup.season + rng.int(0, 2) },
      fatigue: 0, injuryDays: 0, reputation: Math.min(95, d.rating - 5),
    };
  });
  for (let n = 0; n < 4; n++) drivers.push(randomDriver(rng, 20 + n, null, setup.season));
  const fullName = `${setup.firstName} ${setup.lastName}`.trim();
  let driverId: string | null = null;
  if (setup.mode === 'driver') {
    driverId = 'player';
    drivers.push({
      id: driverId, name: fullName, nationality: setup.nationality, birthYear: setup.season - setup.age,
      number: 99, teamId: null, contract: null, category: 'karting', stats: setup.stats, personality: setup.personality, fatigue: 0, injuryDays: 0, reputation: 10,
    });
  }
  const isNew = setup.mode === 'principal' && setup.teamMode === 'new';
  const newTeam: Team = { id: 'player-team', name: setup.newTeam.name.trim() || 'Nueva Escudería', color: setup.newTeam.color, budget: setup.newTeam.budget, reputation: 20, carPerf: 35, entered: false, logo: setup.newTeam.logo, philosophy: setup.newTeam.philosophy };
  const allTeams = isNew ? [...TEAMS, newTeam] : TEAMS;
  const myTeam = isNew ? newTeam : TEAMS.find((t) => t.id === setup.teamId) ?? TEAMS[0];
  const ops = isNew ? newTeamOps() : setup.mode === 'principal' ? createOps(rng, myTeam, setup.season) : { staff: [], car: [], projects: [], sponsors: [], ledger: [], devSpent: 0, academy: [] };
  const staffPool = createPool(rng, 12, 'st0');
  const start = `${setup.season}-01-01`;
  return {
    legacy: newLegacy(setup.season, setup.mode !== 'driver', Math.round(STAT_KEYS.reduce((a, k) => a + setup.stats[k], 0) / STAT_KEYS.length)),
    schemaVersion: SCHEMA_VERSION, id: `save-${Date.now()}`, label: `${fullName} · ${setup.season}`, mode: setup.mode,
    difficulty: setup.difficulty, seed: rng.seed, date: start, season: setup.season,
    player: { name: fullName, driverId, teamId: setup.mode === 'principal' ? (isNew ? 'player-team' : setup.teamId) : null },
    offers: [], career: newCareer(),
    ops, staffPool, sponsorOffers: isNew ? startOffers(rng, setup.season) : [], pendingRace: null, interview: null, lifeEvent: null, alerts: [], rivals: initRivals(setup.season, rng), rivalSeq: 1000, rumors: [], results: [], teams: allTeams,
    application: isNew ? newApplication() : null, principal: setup.mode === 'principal' ? setup.profile : null, bonds: {}, youth: createYouth(rng, setup.season), drivers, calendar: buildCalendar(setup.season, rng.seed, false),
    news: [{
      id: 'n0', date: start, category: 'system', headline: 'Comienza la temporada',
      body: setup.mode === 'driver' ? `${fullName} inicia su carrera en el karting.` : `${fullName} asume la dirección de la escudería.`,
      involved: [fullName],
    }],
  };
}

/** Las noticias nacen solo de eventos reales del estado (carreras, contratos, fichajes). */
function stepDay(state: GameState): GameState {
  const date = addDays(state.date, 1);
  const rng = new Rng(state.seed);
  const news: NewsItem[] = [];
  let s: GameState = { ...state, date };
  const calendar = s.calendar.map((e) => {
    if (!e.done && e.date === date) {
      news.push({ id: `n-${date}-${e.id}`, date, category: 'race', headline: `Hoy: ${e.name}`,
        body: 'Comienza el fin de semana de carrera.', involved: [] });
      return { ...e, done: true };
    }
    return e;
  });
  s = { ...s, calendar };
  const ev = state.calendar.find((e) => !e.done && e.date === date);
  const retired = !!s.legacy.retired;
  const mine = !!ev && eventHasCat(ev, playerCat(s));
  if (!retired) { const cr = careerStep(s, rng, mine, ev?.name ?? ''); s = cr.state; news.push(...cr.news); }
  if (ev && mine && canRace(s)) s = { ...s, pendingRace: ev.id, calendar: s.calendar.map((e) => (e.id === ev.id ? { ...e, done: false } : e)) };
  if (ev && !retired && eventHasCat(ev, 'f1')) { const fp = maybeInviteFP(s, rng, ev); s = fp.state; news.push(...fp.news); }
  if (s.pendingRace && s.mode === 'principal' && s.teams.find((t) => t.id === s.player.teamId)?.entered === false) s = autoRace(s);
  const sp = sponsorStep(s, rng);
  s = sp.state; news.push(...sp.news);
  if (ev) s = simulateOthers(s, ev.id);
  const tm = teamStep(s, rng);
  s = tm.state; news.push(...tm.news);
  if (s.date.endsWith('-01')) { if (!retired) s = extrasStep(s); s = peopleMonthly(s, rng); const wm = worldMonthly(s, rng); s = wm.state; news.push(...wm.news); if (!retired) { const lf = lifeMonthly(s, rng); s = lf.state; news.push(...lf.news); } }
  const fi = fiaStep(s);
  s = fi.state; news.push(...fi.news);
  if (date.endsWith('-01-01') && Number(date.slice(0, 4)) > state.season) {
    const r = expireContracts({ ...s, season: Number(date.slice(0, 4)) }, state.season);
    s = { ...r.state, calendar: buildCalendar(r.state.season, state.seed) };
    news.push(...r.news);
    if (!retired) { const se = seasonEnd(s, state.season, rng); s = se.state; news.push(...se.news); }
    const te = teamSeasonEnd(s, state.season, rng);
    s = te.state; news.push(...te.news);
    if (!retired) { const ee = extrasSeasonEnd(s, state.season, rng); s = ee.state; news.push(...ee.news); }
    s = peopleSeasonEnd(s, rng);
    const lg = legacySeasonEnd(s, state.season, rng);
    s = lg.state; news.push(...lg.news);
    const ws = worldSeasonEnd(s, state.season, rng);
    s = ws.state; news.push(...ws.news);
  }
  const ai = aiSigning(s, rng);
  s = ai.state; news.push(...ai.news);
  return { ...s, seed: rng.seed, news: [...news, ...s.news].slice(0, 500) };
}

export { fpAuto };
/** Categoría en la que compite el jugador (el jefe de equipo siempre en F1). */
export const playerCat = (s: GameState): Category => (s.mode === 'principal' ? 'f1' : s.drivers.find((d) => d.id === PLAYER_ID)?.category ?? 'karting');
/** Próximo evento de la categoría del jugador. */
export const nextEvent = (s: GameState) => s.calendar.find((e) => e.date > s.date && eventHasCat(e, playerCat(s))) ?? null;

function reduceCore(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ADVANCE_DAYS': {
      let s = state;
      for (let i = 0; i < action.days && !s.pendingRace && !s.interview && !s.lifeEvent && !s.legacy.fp && alertsFrom(state, s).length === 0; i++) s = stepDay(s);
      return s;
    }
    case 'SKIP_TO_NEXT_EVENT': {
      const ev = nextEvent(state);
      let s = state;
      while (ev && s.date < ev.date && !s.pendingRace && !s.interview && !s.lifeEvent && !s.legacy.fp && alertsFrom(state, s).length === 0) s = stepDay(s);
      return s;
    }
    case 'SIGN_DRIVER': return signDriver(state, action.driverId, action.salary, action.years);
    case 'RELEASE_DRIVER': return releaseDriver(state, action.driverId);
    case 'SET_TRAINING': return setTraining(state, action.plan);
    case 'ACCEPT_OFFER': return respondOffer(state, action.offerId, action.salary);
    case 'DECLINE_OFFER': return declineOffer(state, action.offerId);
    case 'HIRE_STAFF': return hireStaff(state, action.staffId);
    case 'FIRE_STAFF': return fireStaff(state, action.staffId);
    case 'START_PROJECT': return startProject(state, action.componentId);
    case 'ACCEPT_SPONSOR': return acceptSponsor(state, action.id);
    case 'DECLINE_SPONSOR': return declineSponsor(state, action.id);
    case 'DROP_SPONSOR': return dropSponsor(state, action.id);
    case 'FINISH_RACE': return finishRace(state, action.result);
    case 'ANSWER_INTERVIEW': return answerInterview(state, action.index);
    case 'SET_SETUP': return setSetup(state, action.setup);
    case 'ACCEPT_PSPONSOR': return acceptPersonalSponsor(state, action.id);
    case 'DROP_PSPONSOR': return dropPersonalSponsor(state, action.id);
    case 'INVEST_FACILITIES': return investFacilities(state, action.amount);
    case 'LOBBY_FIA': return lobbyFia(state);
    case 'SUBMIT_APPLICATION': return submitApplication(state);
    case 'SIGN_YOUTH': return signYouth(state, action.id);
    case 'RELEASE_YOUTH': return releaseYouth(state, action.id);
    case 'PROMOTE_YOUTH': return promoteYouth(state, action.id);
    case 'RENEW_DRIVER': return renewDriver(state, action.driverId, action.salary, action.years);
    case 'HIRE_AGENT': return hireAgent(state);
    case 'FIRE_AGENT': return fireAgent(state);
    case 'ASK_AGENT': return askAgent(state);
    case 'APPLY_TO': return applyTo(state, action.target, action.kind, action.pitch);
    case 'ANSWER_LIFE': return answerLife(state, action.index);
    case 'TOGGLE_SERVICE': return toggleService(state, action.key);
    case 'CAMP_TEST': return campTest(state, action.approach);
    case 'SPEND_POINT': return spendPoint(state, action.stat);
    case 'REQUEST_RESERVE': return requestReserve(state);
    case 'APPLY_SPONSOR': return applySponsor(state, action.name);
    case 'DISMISS_ALERT': return { ...state, alerts: state.alerts.slice(1) };
    case 'DISMISS_CELEBRATION': return { ...state, legacy: { ...state.legacy, celebrations: state.legacy.celebrations.slice(1) } };
    case 'DISMISS_SUMMARY': return { ...state, legacy: { ...state.legacy, pendingSummary: null } };
    case 'TUTORIAL_DONE': return { ...state, legacy: { ...state.legacy, tutorialDone: true } };
    case 'RETIRE': return retirePlayer(state);
    case 'FP_RUN': return fpRun(state, action.program, action.tyre, action.mode);
    case 'FP_FINISH': return fpFinish(state);
    case 'FP_SKIP': return fpSkip(state);
  }
}

const BAD = /lesi|despid|sin asiento|rescinde|rechaz|retira|abandon|baja|saca|finaliz|accidente|termina su|fallid|ignoras|no entras/i;
const GOOD = /gana|victoria|podio|\bP[123]\b|oferta|fich|firma|contrato|academia|alta m|ascen|interesa|acepta|renuev|mejoras|pole|subes|pruebas|superlicencia|contacta|patrocin|cumplido/i;
/** Noticias nuevas que afectan al piloto: se muestran como aviso a pantalla completa hasta que las cierres. */
export function alertsFrom(prev: GameState, next: GameState): Alert[] {
  if (next.mode !== 'driver') return [];
  const seen = new Set(prev.news.slice(0, 40).map((n) => n.id));
  const out: Alert[] = [];
  for (const n of next.news) {
    if (seen.has(n.id)) break;
    if (!n.involved.includes(next.player.name) || /prensa|Reuniones|Solicitud|Vida personal/.test(n.headline)) continue;
    out.push({ id: n.id, title: n.headline, body: n.body, tone: BAD.test(n.headline) ? 'bad' : GOOD.test(n.headline) ? 'good' : 'info' });
  }
  return out.reverse();
}
export function reduce(state: GameState, action: Action): GameState {
  let next = reduceCore(state, action);
  if (action.type === 'DISMISS_ALERT' || action.type === 'DISMISS_CELEBRATION' || action.type === 'DISMISS_SUMMARY' || action.type === 'TUTORIAL_DONE') return next;
  next = tagNews(updateLegacy(next));
  const a = alertsFrom(state, next);
  return a.length ? { ...next, alerts: [...next.alerts, ...a] } : next;
}
