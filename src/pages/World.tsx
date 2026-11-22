import type { Category, GameState } from '../types';
import { STAT_KEYS, STAT_LABELS } from '../types';
import { gameStore } from '../hooks/useGame';
import { nextEvent } from '../services/gameEngine';
import { CAT_LABEL, CATEGORIES, PLAYER_ID, ageOf, playerOf, seasonRank, slTotal, teammateOf } from '../systems/career';
import { rating } from '../systems/market';

const act = gameStore.dispatch;
const Bar = ({ v }: { v: number }) => <div className="bar"><i style={{ width: `${v}%` }} /></div>;

/** Pantalla de inicio: qué viene, cómo estás y qué conviene hacer ahora. */
export function Home({ game, go }: { game: GameState; go: (id: string) => void }) {
  const p = playerOf(game);
  if (!p) return null;
  const next = nextEvent(game), c = game.career;
  const days = next ? Math.round((Date.parse(next.date) - Date.parse(game.date)) / 86400000) : 0;
  const rank = seasonRank(game, game.season, p.category);
  const todo: { text: string; go?: [string, string] }[] = [];
  if (p.injuryDays > 0) todo.push({ text: `Estás lesionado: ${p.injuryDays} días de recuperación. No puedes entrenar ni correr.` });
  else if (!c.training) todo.push({ text: 'No estás entrenando. Entrenar sube tus estadísticas.', go: ['Elegir entrenamiento', 'training'] });
  if (p.fatigue > 70) todo.push({ text: `Fatiga alta (${p.fatigue}): descansa para evitar lesiones.`, go: ['Ir a entrenamiento', 'training'] });
  if (game.offers.length) todo.push({ text: `Tienes ${game.offers.length} oferta(s) esperando respuesta.`, go: ['Ver ofertas', 'contracts'] });
  c.candidacies.forEach((x) => todo.push({ text: `Esperando respuesta de ${x.target} (hacia el ${x.reply}).` }));
  if (c.sponsors.length === 0) todo.push({ text: 'No tienes patrocinadores. Las marcas de tu país pueden interesarse.', go: ['Buscar patrocinadores', 'sponsors'] });
  if (!c.contract && p.category !== 'karting') todo.push({ text: 'No tienes equipo: preséntate a equipos o espera ofertas.', go: ['Buscar equipo', 'contracts'] });
  if (c.objective) todo.push({ text: `Objetivo de la temporada: terminar P${c.objective.rank} o mejor.` });
  if (c.skillPoints > 0) todo.push({ text: `Tienes ${c.skillPoints} punto(s) de habilidad para repartir.`, go: ['Repartir puntos', 'performance'] });
  if (c.reserve) todo.push({ text: `Eres piloto de pruebas de ${c.reserve.team}: cada mes pueden invitarte a un test.` });
  const mate = teammateOf(game);
  if (mate) todo.push({ text: `Tu compañero de equipo: ${mate.name} (nivel ${mate.rating}, ${mate.age} años). Durante la carrera el equipo puede darte órdenes: aceptarlas o rechazarlas afecta a vuestra relación.` });
  if (c.camp) todo.push({ text: `Campamento de ${c.camp.academy}: prueba ${c.camp.step + 1}/4 pendiente.`, go: ['Ir al campamento', 'contracts'] });
  if (c.life.mood < 35) todo.push({ text: `Tu ánimo está bajo (${c.life.mood}): afecta a cuánto aprendes.`, go: ['Vida personal', 'life'] });
  if (CATEGORIES.indexOf(p.category) >= 2) todo.push({ text: `Superlicencia FIA: ${slTotal(game)}/40 puntos para llegar a la F1.` });
  const top = [...STAT_KEYS].sort((a, b) => p.stats[b] - p.stats[a]).slice(0, 5);
  return (
    <>
      <div className="card home">
        <div><span className="muted">Categoría</span><b>{CAT_LABEL[p.category]}</b></div>
        <div><span className="muted">Equipo</span><b>{c.contract?.teamName ?? 'Independiente'}</b></div>
        <div><span className="muted">Academia</span><b>{c.academy ?? '—'}</b></div>
        <div><span className="muted">Edad</span><b>{ageOf(game, p)}</b></div>
        <div><span className="muted">Nivel</span><b>{rating(p)}</b></div>
        <div><span className="muted">Posición</span><b>{rank ? `P${rank}` : '—'}</b></div>
      </div>
      <div className="card">
        <strong>Próximo evento</strong>
        <p>{next ? `${next.name} · ${next.date} (en ${days} días)` : 'Temporada finalizada: avanza para empezar la siguiente.'}</p>
        <div className="row"><button className="btn primary" onClick={() => act({ type: 'SKIP_TO_NEXT_EVENT' })} disabled={!next}>Avanzar hasta la próxima carrera</button>
          <button className="btn" onClick={() => act({ type: 'ADVANCE_DAYS', days: 7 })}>+7 días</button></div>
      </div>
      <h2>Qué hacer ahora</h2>
      <div className="card">{todo.length === 0 ? <p className="muted">Todo en orden.</p> : todo.map((t, i) => (
        <div className="row todo" key={i}><span style={{ flex: 1 }}>{t.text}</span>{t.go && <button className="btn" onClick={() => go(t.go![1])}>{t.go[0]}</button>}</div>))}</div>
      <h2>Tus mejores estadísticas</h2>
      <div className="card"><table className="stats"><tbody>{top.map((k) => (<tr key={k}><td>{STAT_LABELS[k]}</td><td className="bar"><i style={{ width: `${p.stats[k]}%` }} /></td><td className="num">{p.stats[k]}</td></tr>))}</tbody></table>
        <button className="btn" onClick={() => go('performance')}>Ver todo mi rendimiento</button></div>
    </>
  );
}

export function HistoryPage({ game }: { game: GameState }) {
  const c = game.career;
  return (
    <>
      <div className="card home">
        <div><span className="muted">Carreras</span><b>{c.stats.races}</b></div><div><span className="muted">Victorias</span><b>{c.stats.wins}</b></div>
        <div><span className="muted">Podios</span><b>{c.stats.podiums}</b></div><div><span className="muted">Poles</span><b>{c.stats.poles}</b></div><div><span className="muted">Abandonos</span><b>{c.stats.dnfs}</b></div>
        <div><span className="muted">Popularidad</span><b>{c.popularity}</b></div>
      </div>
      <h2>Temporadas</h2>
      <div className="card"><table className="data"><thead><tr><th>Año</th><th>Categoría</th><th>Equipo</th><th>Puesto</th><th>Puntos</th></tr></thead><tbody>
        {[...c.history].reverse().map((h) => (<tr key={h.season}><td>{h.season}</td><td>{CAT_LABEL[h.category]}</td><td>{h.team}</td><td className="num">{h.rank ? `P${h.rank}` : '—'}</td><td className="num">{h.points}</td></tr>))}
        {c.history.length === 0 && <tr><td colSpan={5} className="muted">Aún no has cerrado ninguna temporada.</td></tr>}
      </tbody></table></div>
    </>
  );
}

export function RivalsPage({ game }: { game: GameState }) {
  const p = playerOf(game);
  if (!p) return null;
  const cat = p.category;
  const pts = new Map<string, number>();
  game.results.filter((r) => r.season === game.season && r.category === cat).forEach((r) => r.entries.forEach((e) => pts.set(e.id, (pts.get(e.id) ?? 0) + e.pts)));
  const list = cat === 'f1'
    ? game.drivers.filter((d) => d.category === 'f1' && d.id !== PLAYER_ID).map((d) => ({ id: d.id, name: d.name, age: ageOf(game, d), team: game.teams.find((t) => t.id === d.teamId)?.name ?? 'Libre', rating: rating(d) }))
    : game.rivals[cat].map((r) => ({ id: r.id, name: r.name, age: game.season - r.birthYear, team: r.team, rating: r.rating }));
  const sorted = [...list].sort((a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0) || b.rating - a.rating);
  const nextCat: Category | null = cat === 'f1' ? null : CATEGORIES[CATEGORIES.indexOf(cat) + 1];
  const up = nextCat && nextCat !== 'f1' ? [...game.rivals[nextCat]].sort((a, b) => b.rating - a.rating).slice(0, 5) : [];
  return (
    <>
      <p className="muted">Tus rivales de {CAT_LABEL[cat]} se mantienen entre temporadas: envejecen, mejoran, ascienden o se retiran. La relación sube o baja con los duelos y tus respuestas en prensa.</p>
      <div className="card"><table className="data"><thead><tr><th>Piloto</th><th>Edad</th><th>Equipo</th><th>Nivel</th><th>Pts</th><th>Relación</th></tr></thead><tbody>
        {sorted.map((r) => (<tr key={r.id}><td>{r.name}</td><td className="num">{r.age}</td><td className="muted">{r.team}</td><td className="num">{r.rating}</td><td className="num">{pts.get(r.id) ?? 0}</td>
          <td><Bar v={game.bonds[r.name] ?? 50} /></td></tr>))}
      </tbody></table></div>
      {up.length > 0 && (<><h2>Los mejores de {CAT_LABEL[nextCat as Category]}</h2>
        <div className="card"><table className="data"><tbody>{up.map((r) => (<tr key={r.id}><td>{r.name}</td><td className="num">{game.season - r.birthYear} años</td><td className="muted">{r.team}</td><td className="num">nivel {r.rating}</td></tr>))}</tbody></table></div></>)}
    </>
  );
}
