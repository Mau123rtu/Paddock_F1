import { useState } from 'react';
import { Ico } from '../components/Icon';
import type { Category, GameState } from '../types';
import { CAT_LABEL, CATEGORIES, PLAYER_ID } from '../systems/career';
import { JUNIOR, teamStrength } from '../data/real';

const Bar = ({ v }: { v: number }) => <div className="bar"><i style={{ width: `${Math.min(100, v)}%` }} /></div>;

export default function Standings({ game }: { game: GameState }) {
  const mine: Category = game.mode === 'driver' ? game.drivers.find((d) => d.id === PLAYER_ID)?.category ?? 'karting' : 'f1';
  const [cat, setCat] = useState<Category>(mine);
  const rs = game.results.filter((r) => r.season === game.season && r.category === cat);
  const dr = new Map<string, { name: string; team: string; color: string; pts: number; wins: number; podiums: number }>();
  const tm = new Map<string, { color: string; pts: number; best: number }>();
  rs.forEach((r) => r.entries.forEach((e) => {
    const d = dr.get(e.id) ?? { name: e.name, team: e.team, color: e.color, pts: 0, wins: 0, podiums: 0 };
    dr.set(e.id, { ...d, team: e.team, pts: d.pts + e.pts, wins: d.wins + (e.pos === 1 && e.status === 'finished' ? 1 : 0), podiums: d.podiums + (e.pos <= 3 && e.status === 'finished' ? 1 : 0) });
    const t = tm.get(e.team) ?? { color: e.color, pts: 0, best: 99 };
    tm.set(e.team, { color: e.color, pts: t.pts + e.pts, best: Math.min(t.best, e.status === 'finished' ? e.pos : 99) });
  }));
  const D = [...dr.entries()].sort((a, b) => b[1].pts - a[1].pts), T = [...tm.entries()].sort((a, b) => b[1].pts - a[1].pts);
  const strength = (name: string) => {
    if (cat === 'f1') return game.teams.find((t) => t.name === name)?.carPerf ?? 0;
    const l = JUNIOR[cat], i = l.indexOf(name);
    return i < 0 ? 0 : teamStrength(cat, i, l.length);
  };
  const isMine = (id: string) => (game.mode === 'driver' ? id === PLAYER_ID : game.drivers.find((d) => d.id === id)?.teamId === game.player.teamId);
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Categoría">
        {CATEGORIES.map((c) => <button key={c} className={`btn ${c === cat ? 'primary' : ''}`} onClick={() => setCat(c)}>{CAT_LABEL[c]}{c === mine && <> <Ico name="star" size={12} className="you" /></>}</button>)}
      </div>
      {rs.length === 0 ? (
        <>
          <p className="muted">Todavía no hay carreras disputadas en {CAT_LABEL[cat]} esta temporada. Las clasificaciones de todas las categorías se actualizan en cada fecha de carrera. Esta es la parrilla actual:</p>
          <div className="card"><table className="data"><thead><tr><th>Equipo</th><th>Piloto</th><th>Edad</th><th>Nivel</th></tr></thead><tbody>
            {(cat === 'f1'
              ? game.drivers.filter((d) => d.category === 'f1' && d.id !== PLAYER_ID).map((d) => ({ id: d.id, team: game.teams.find((t) => t.id === d.teamId)?.name ?? 'Libre', name: d.name, age: game.season - d.birthYear, r: Math.round(Object.values(d.stats).reduce((a, b) => a + b, 0) / Object.values(d.stats).length) }))
              : game.rivals[cat].map((r) => ({ id: r.id, team: r.team, name: r.name, age: game.season - r.birthYear, r: r.rating }))
            ).sort((a, b) => a.team.localeCompare(b.team)).map((x) => (<tr key={x.id}><td className="muted">{x.team}</td><td>{x.name}</td><td className="num">{x.age}</td><td className="num">{x.r}</td></tr>))}
          </tbody></table></div>
        </>
      ) : (
        <>
          <p className="muted">{CAT_LABEL[cat]} {game.season} · {rs.length} carrera(s)</p>
          <h2>Pilotos</h2>
          <div className="card"><table className="data"><thead><tr><th>#</th><th>Piloto</th><th>Equipo</th><th>Vic.</th><th>Podios</th><th>Pts</th></tr></thead><tbody>
            {D.map(([id, d], i) => (<tr key={id} className={isMine(id) ? 'sel' : ''}><td className="num">{i + 1}</td><td><i className="dot" style={{ background: d.color }} /> {d.name}{isMine(id) && <> <Ico name="star" size={12} className="you" /></>}</td><td className="muted">{d.team}</td><td className="num">{d.wins}</td><td className="num">{d.podiums}</td><td className="num"><strong>{d.pts}</strong></td></tr>))}
          </tbody></table></div>
          <h2>Rendimiento de los equipos</h2>
          <div className="card"><table className="data"><thead><tr><th>#</th><th>Equipo</th><th>Fuerza del coche</th><th>Mejor resultado</th><th>Pts</th></tr></thead><tbody>
            {T.map(([n, t], i) => (<tr key={n} className={n === game.career.contract?.teamName || n === game.teams.find((x) => x.id === game.player.teamId)?.name ? 'sel' : ''}>
              <td className="num">{i + 1}</td><td><i className="dot" style={{ background: t.color }} /> {n}</td><td><Bar v={strength(n)} /> <span className="num muted">{Math.round(strength(n))}</span></td>
              <td className="num">{t.best === 99 ? '—' : `P${t.best}`}</td><td className="num"><strong>{t.pts}</strong></td></tr>))}
          </tbody></table></div>
        </>
      )}
    </>
  );
}

export function StrategyPage({ game }: { game: GameState }) {
  const team = game.teams.find((t) => t.id === game.player.teamId);
  const last = game.results.filter((r) => r.category === 'f1').slice(-5).reverse();
  return (
    <>
      <div className="card"><p>Las decisiones de carrera se toman en el fin de semana de carrera: neumáticos de salida y parada antes de salir, y durante la carrera ritmo (atacar, normal, conservar), boxes, órdenes de equipo, retirar un coche y reacción a Safety Car, Virtual Safety Car, bandera roja y lluvia.</p>
        <p className="muted">El jefe de equipo controla a ambos pilotos. La carrera se pausa sola ante incidentes que afectan a tu equipo.</p></div>
      <h2>Últimas carreras de {team?.name}</h2>
      <div className="card"><table className="data"><tbody>
        {last.map((r) => (<tr key={r.id}><td>{r.name}</td><td>{r.entries.filter((e) => e.team === team?.name).map((e) => `${e.name}: ${e.status === 'dnf' ? 'ABD' : 'P' + e.pos}`).join(' · ')}</td></tr>))}
        {last.length === 0 && <tr><td className="muted">Aún no hay carreras disputadas.</td></tr>}
      </tbody></table></div>
    </>
  );
}
