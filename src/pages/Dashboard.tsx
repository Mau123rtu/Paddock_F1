import { useEffect, useState } from 'react';
import { Calendar, CalendarCheck, Newspaper, Save, LayoutDashboard, Lock, Users, Dumbbell, FileSignature, Activity, Briefcase, Wrench, FlaskConical, Wallet, Handshake, Flag, Trophy, GraduationCap, LogOut, FastForward, Menu, Heart, Award, BarChart3, Crown, Landmark, LineChart, HelpCircle, Timer } from 'lucide-react';
import type { Category, GameState } from '../types';
import { CIRCUITS, eventHasCat } from '../data/circuits';
import { playerOf } from '../systems/career';
import { gameStore } from '../hooks/useGame';
import { nextEvent } from '../services/gameEngine';
import Market from './Market';
import { AcademyPage, FiaPage } from './Team2';
import { HistoryPage, Home, RivalsPage } from './World';
import { AlertModal, LifeModal, LifePage, SponsorSearch, Press, PersonalSponsorsPage, RelationsPage, SetupPage } from './Driver';
import RaceWeekend from './RaceWeekend';
import Standings, { StrategyPage } from './Standings';
import { CarPage, DevPage, FinancePage, SponsorsPage, StaffPage } from './Team';
import { Contracts, Performance, Training } from './Career';
import { saveGame } from '../services/storage/saves';
import { AchievementsPage, AchievementsStrip, CelebrationOverlay, ChampionsPage, HallPage, RecordsPage, ReserveFPPage, SeasonsPage, SummaryModal } from './Legacy';
import Tutorial from './Tutorial';
import NewsPage from './News';
import Headlines from './Headlines';

type Section = { id: string; label: string; phase?: number; icon: typeof Calendar; group?: string };
const DRIVER: Section[] = [
  { id: 'summary', label: 'Inicio', icon: LayoutDashboard, group: 'Mi carrera' }, { id: 'calendar', label: 'Calendario', icon: Calendar, group: 'Mi carrera' },
  { id: 'training', label: 'Entrenamiento', icon: Dumbbell, group: 'Mi carrera' }, { id: 'performance', label: 'Mi rendimiento', icon: Activity, group: 'Mi carrera' }, { id: 'life', label: 'Vida personal', icon: Heart, group: 'Mi carrera' },
  { id: 'setup', label: 'Ajuste del monoplaza', icon: Wrench, group: 'Mi carrera' }, { id: 'history', label: 'Trayectoria', icon: Trophy, group: 'Mi carrera' },
  { id: 'contracts', label: 'Equipos y contratos', icon: FileSignature, group: 'Fichajes' }, { id: 'sponsors', label: 'Patrocinadores', icon: Handshake, group: 'Fichajes' },
  { id: 'market', label: 'Mercado de pilotos', icon: Users, group: 'Fichajes' }, { id: 'relations', label: 'Relaciones', icon: Users, group: 'Fichajes' },
  { id: 'news', label: 'Noticias', icon: Newspaper, group: 'Mundo' }, { id: 'standings', label: 'Clasificaciones', icon: Trophy, group: 'Mundo' },
  { id: 'rivals', label: 'Rivales', icon: Users, group: 'Mundo' },
  { id: 'achievements', label: 'Logros y trofeos', icon: Award, group: 'Legado' }, { id: 'records', label: 'Récords', icon: BarChart3, group: 'Legado' },
  { id: 'champions', label: 'Campeones del mundo', icon: Crown, group: 'Legado' }, { id: 'seasons', label: 'Resúmenes de temporada', icon: LineChart, group: 'Legado' },
  { id: 'hall', label: 'Salón de la Fama', icon: Landmark, group: 'Legado' }, { id: 'tutorial', label: 'Tutorial', icon: HelpCircle, group: 'Legado' },
  { id: 'save', label: 'Guardar partida', icon: Save, group: 'Partida' },
];
const RETIRED: Section[] = [
  { id: 'hall', label: 'Salón de la Fama', icon: Landmark, group: 'Legado' }, { id: 'champions', label: 'Campeones del mundo', icon: Crown, group: 'Legado' },
  { id: 'records', label: 'Récords', icon: BarChart3, group: 'Legado' }, { id: 'achievements', label: 'Logros y trofeos', icon: Award, group: 'Legado' },
  { id: 'seasons', label: 'Resúmenes de temporada', icon: LineChart, group: 'Legado' },
  { id: 'news', label: 'Noticias', icon: Newspaper, group: 'Mundo' }, { id: 'standings', label: 'Clasificaciones', icon: Trophy, group: 'Mundo' }, { id: 'calendar', label: 'Calendario', icon: Calendar, group: 'Mundo' },
  { id: 'save', label: 'Guardar partida', icon: Save, group: 'Partida' },
];
const PRINCIPAL: Section[] = [
  { id: 'summary', label: 'Resumen de escudería', icon: LayoutDashboard }, { id: 'drivers', label: 'Pilotos', icon: Users }, { id: 'academy', label: 'Academia', icon: GraduationCap },
  { id: 'staff', label: 'Personal', icon: Briefcase }, { id: 'car', label: 'Monoplaza', icon: Wrench },
  { id: 'dev', label: 'Desarrollo', icon: FlaskConical }, { id: 'strategy', label: 'Estrategia', icon: Flag },
  { id: 'finance', label: 'Finanzas', icon: Wallet }, { id: 'sponsors', label: 'Patrocinadores', icon: Handshake },
  { id: 'market', label: 'Mercado de pilotos', icon: Users }, { id: 'calendar', label: 'Calendario', icon: Calendar },
  { id: 'news', label: 'Noticias', icon: Newspaper }, { id: 'standings', label: 'Clasificaciones', phase: 5, icon: Lock },
  { id: 'save', label: 'Guardar partida', icon: Save },
];

export default function Dashboard({ game, onExit }: { game: GameState; onExit: () => void }) {
  const [sec, setSec] = useState('summary');
  const [saved, setSaved] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTut, setShowTut] = useState(game.mode === 'driver' && !game.legacy.tutorialDone);
  const base = game.mode === 'driver' ? (game.legacy.retired ? RETIRED : DRIVER) : PRINCIPAL;
  const extra: Section[] = [];
  if (game.legacy.fp) extra.push({ id: 'fp', label: 'Prácticas F1 (reserva)', icon: Timer });
  if (game.pendingRace) extra.push({ id: 'race', label: 'Fin de semana de carrera', icon: Flag });
  if (game.application && game.application.status !== 'approved') extra.push({ id: 'fia', label: 'Admisión FIA', icon: Flag });
  const sections: Section[] = [...extra, ...base];
  useEffect(() => { if (game.pendingRace) setSec('race'); }, [game.pendingRace]);
  useEffect(() => { if (game.legacy.fp) setSec('fp'); }, [game.legacy.fp?.id]);
  const cur = sections.find((s) => s.id === sec) ?? sections[0];
  const next = nextEvent(game);
  const blocked = !!(game.pendingRace || game.legacy.fp || game.interview || game.lifeEvent || game.alerts.length);
  const team = game.teams.find((t) => t.id === game.player.teamId);

  return (
    <div className="shell" style={{ ['--accent' as string]: team?.color ?? '#e8002d' }}>
      {showTut && !game.alerts[0] && <Tutorial onClose={() => setShowTut(false)} />}
      <SummaryModal game={game} />
      <CelebrationOverlay game={game} />
      {game.alerts[0] && <AlertModal alert={game.alerts[0]} left={game.alerts.length} />}
      {game.lifeEvent && !game.alerts[0] && <LifeModal game={game} />}
      <Headlines game={game} go={setSec} />
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <nav className={`side ${menuOpen ? 'open' : ''}`} aria-label="Secciones">
        <div className="brand">Paddock<small>{game.mode === 'driver' ? 'Piloto' : team?.name}</small></div>
        {sections.map((s, i) => (
          <div key={s.id}>
            {s.group && s.group !== sections[i - 1]?.group && <small className="navgroup">{s.group}</small>}
            <button className={s.id === cur.id ? 'on' : ''} onClick={() => { setSec(s.id); setMenuOpen(false); }}><s.icon size={16} />{s.label}{s.phase && <em>F{s.phase}</em>}</button>
          </div>
        ))}
        <button onClick={onExit}><LogOut size={16} />Salir al menú</button>
      </nav>
      <section className="main">
        <header className="topbar">
          <button className="btn icon menu-btn" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu size={18} /></button>
          <strong>{game.date}</strong>
          <span className="muted">{next ? `Próximo evento: ${next.name} (${next.date})` : 'Temporada finalizada'}</span>
          <span className="spacer" />
          <button className="btn desk" disabled={blocked} onClick={() => gameStore.dispatch({ type: 'ADVANCE_DAYS', days: 1 })}>+1 día</button>
          <button className="btn desk" disabled={blocked} onClick={() => gameStore.dispatch({ type: 'ADVANCE_DAYS', days: 7 })}>+7 días</button>
          <button className="btn primary desk" disabled={!next || blocked} onClick={() => gameStore.dispatch({ type: 'SKIP_TO_NEXT_EVENT' })}><FastForward size={14} />Siguiente evento</button>
        </header>
        <div className="actionbar">
          <button className="btn" disabled={blocked} onClick={() => gameStore.dispatch({ type: 'ADVANCE_DAYS', days: 1 })}>+1 día</button>
          <button className="btn" disabled={blocked} onClick={() => gameStore.dispatch({ type: 'ADVANCE_DAYS', days: 7 })}>+7 días</button>
          <button className="btn primary" disabled={!next || blocked} onClick={() => gameStore.dispatch({ type: 'SKIP_TO_NEXT_EVENT' })}><FastForward size={14} />Siguiente</button>
        </div>
        <div className="content">
          {game.interview && <Press game={game} />}
          <h1>{cur.label}</h1>
          {cur.phase && <p className="muted">Esta sección se construye en la Fase {cur.phase}. Todavía no tiene funcionalidad.</p>}
          {cur.id === 'summary' && team && (
            <table className="data"><tbody>
              <tr><td>Presupuesto</td><td className="num">{team.budget} M</td></tr>
              <tr><td>Reputación</td><td className="num">{team.reputation}</td></tr>
              <tr><td>Pilotos</td><td>{game.drivers.filter((d) => d.teamId === team.id).map((d) => d.name).join(', ')}</td></tr>
            </tbody></table>
          )}
          {(cur.id === 'market' || cur.id === 'drivers') && <Market game={game} view={cur.id === 'drivers' ? 'roster' : 'market'} />}
          {game.mode === 'driver' && cur.id === 'setup' && <SetupPage game={game} />}
          {game.mode === 'driver' && cur.id === 'sponsors' && <><PersonalSponsorsPage game={game} /><SponsorSearch game={game} /></>}
          {game.mode === 'driver' && cur.id === 'relations' && <RelationsPage game={game} />}
          {game.mode === 'driver' && cur.id === 'summary' && <><Home game={game} go={setSec} /><AchievementsStrip game={game} /></>}
          {game.mode === 'driver' && cur.id === 'achievements' && <AchievementsPage game={game} />}
          {game.mode === 'driver' && cur.id === 'records' && <RecordsPage game={game} />}
          {game.mode === 'driver' && cur.id === 'champions' && <ChampionsPage game={game} />}
          {game.mode === 'driver' && cur.id === 'seasons' && <SeasonsPage game={game} />}
          {game.mode === 'driver' && cur.id === 'hall' && <HallPage game={game} />}
          {cur.id === 'fp' && <ReserveFPPage game={game} />}
          {cur.id === 'tutorial' && <div className="card"><p>Repasa cómo funciona cada sistema del modo piloto.</p><button className="btn primary" onClick={() => setShowTut(true)}>Abrir tutorial</button></div>}
          {game.mode === 'driver' && cur.id === 'life' && <LifePage game={game} />}
          {game.mode === 'driver' && cur.id === 'history' && <HistoryPage game={game} />}
          {game.mode === 'driver' && cur.id === 'rivals' && <RivalsPage game={game} />}
          {cur.id === 'fia' && <FiaPage game={game} />}
          {game.mode === 'principal' && cur.id === 'academy' && <AcademyPage game={game} />}
          {cur.id === 'race' && game.pendingRace && <RaceWeekend key={game.pendingRace} game={game} />}
          {cur.id === 'standings' && <Standings game={game} />}
          {game.mode === 'principal' && cur.id === 'strategy' && <StrategyPage game={game} />}
          {game.mode === 'principal' && cur.id === 'staff' && <StaffPage game={game} />}
          {game.mode === 'principal' && cur.id === 'car' && <CarPage game={game} />}
          {game.mode === 'principal' && cur.id === 'dev' && <DevPage game={game} />}
          {game.mode === 'principal' && cur.id === 'finance' && <FinancePage game={game} />}
          {game.mode === 'principal' && cur.id === 'sponsors' && <SponsorsPage game={game} />}
          {cur.id === 'training' && <Training game={game} />}
          {(cur.id === 'contracts' || cur.id === 'team') && <Contracts game={game} />}
          {cur.id === 'performance' && <Performance game={game} />}
          {cur.id === 'calendar' && (
            <CalendarView game={game} />
          )}
          {cur.id === 'news' && <NewsPage game={game} />}
          {cur.id === 'save' && (
            <div>
              <button className="btn primary" onClick={async () => { await saveGame(game); setSaved(`Guardada en ${game.date}`); }}>Guardar partida</button>
              {saved && <p className="muted">{saved}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const CAT_SHORT: Record<Category, string> = { karting: 'Karting', f4: 'F4', f3: 'F3', f2: 'F2', f1: 'F1' };
/** Calendario: por defecto solo las citas de tu categoría; el botón muestra todas las categorías. */
function CalendarView({ game }: { game: GameState }) {
  const [all, setAll] = useState(false);
  const mine: Category = game.mode === 'principal' ? 'f1' : playerOf(game)?.category ?? 'karting';
  const rows = game.calendar.filter((e) => all || eventHasCat(e, mine));
  return (
    <div className="card">
      <div className="row"><button className="btn" onClick={() => setAll(!all)}>{all ? `Solo ${CAT_SHORT[mine]}` : 'Ver todas las categorías'}</button><span className="muted">{game.calendar.filter((e) => eventHasCat(e, mine)).length} carreras en {CAT_SHORT[mine]} esta temporada</span></div>
      <table className="data"><thead><tr><th>Fecha</th><th>Evento</th><th>Circuito</th><th>Categorías</th><th /></tr></thead><tbody>
        {rows.map((e) => <tr key={e.id}><td>{e.date}</td><td>{e.name}</td><td className="muted">{CIRCUITS[e.cn]?.name ?? e.circuit}</td><td className="muted">{e.cats.map((c) => CAT_SHORT[c]).join(' · ')}</td><td>{e.done && <CalendarCheck size={14} />}</td></tr>)}
      </tbody></table>
    </div>
  );
}
