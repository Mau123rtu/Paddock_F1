import { useState } from 'react';
import type { GameState } from '../types';
import { gameStore } from '../hooks/useGame';
import { asking, freeAgents, payroll, rating, roster } from '../systems/market';

export default function Market({ game, view }: { game: GameState; view: 'market' | 'roster' }) {
  const [offers, setOffers] = useState<Record<string, number>>({});
  const [years, setYears] = useState(2);
  const team = game.teams.find((t) => t.id === game.player.teamId);
  const age = (b: number) => game.season - b;
  const mine = team ? roster(game, team.id) : [];

  if (view === 'roster' && team) {
    return (
      <div className="card">
        <p className="muted">Nómina: {payroll(game, team.id).toFixed(1)} M de {(team.budget * 0.3).toFixed(1)} M permitidos · Presupuesto {team.budget} M</p>
        <table className="data"><thead><tr><th>Piloto</th><th>Nivel</th><th>Salario</th><th>Hasta</th><th>Relación</th><th /></tr></thead><tbody>
          {mine.map((d) => (
            <tr key={d.id}><td>{d.name}</td><td className="num">{rating(d)}</td><td className="num">{d.contract?.salary} M</td><td>{d.contract?.endSeason}</td>
              <td className="num">{game.bonds[d.id] ?? 50}</td><td><input className="mini" type="number" step="0.1" value={offers[d.id] ?? asking(game, d)} onChange={(e) => setOffers({ ...offers, [d.id]: Number(e.target.value) })} /><button className="btn" onClick={() => gameStore.dispatch({ type: 'RENEW_DRIVER', driverId: d.id, salary: offers[d.id] ?? asking(game, d), years: 2 })}>Renovar 2 años</button> <button className="btn" onClick={() => gameStore.dispatch({ type: 'RELEASE_DRIVER', driverId: d.id })}>Rescindir</button></td></tr>
          ))}
          {mine.length === 0 && <tr><td colSpan={6} className="muted">Sin pilotos. Ficha desde el mercado.</td></tr>}
        </tbody></table>
      </div>
    );
  }
  return (
    <>
      <h2>Pilotos libres</h2>
      <div className="card">
        {game.mode === 'principal' && team && <p className="muted">Tu equipo tiene {mine.length}/2 pilotos. Si ofreces menos de lo que piden, rechazarán.
          {' '}Años: <select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3].map((y) => <option key={y}>{y}</option>)}</select></p>}
        <table className="data"><thead><tr><th>Piloto</th><th>Edad</th><th>Nivel</th><th>Pide</th>{game.mode === 'principal' && <th>Tu oferta (M)</th>}</tr></thead><tbody>
          {freeAgents(game).map((d) => (
            <tr key={d.id}><td>{d.name}</td><td className="num">{age(d.birthYear)}</td><td className="num">{rating(d)}</td><td className="num">{asking(game, d)} M</td>
              {game.mode === 'principal' && (
                <td><input className="mini" type="number" step="0.1" min={0.5} value={offers[d.id] ?? asking(game, d)} onChange={(e) => setOffers({ ...offers, [d.id]: Number(e.target.value) })} />
                  <button className="btn primary" disabled={mine.length >= 2} onClick={() => gameStore.dispatch({ type: 'SIGN_DRIVER', driverId: d.id, salary: offers[d.id] ?? asking(game, d), years })}>Ofertar</button></td>)}
            </tr>
          ))}
          {freeAgents(game).length === 0 && <tr><td colSpan={5} className="muted">No hay pilotos libres ahora. Los contratos vencen al terminar la temporada.</td></tr>}
        </tbody></table>
      </div>
      <h2>Contratos vigentes</h2>
      <div className="card">
        <table className="data"><thead><tr><th>Piloto</th><th>Equipo</th><th>Nivel</th><th>Salario</th><th>Hasta</th></tr></thead><tbody>
          {game.drivers.filter((d) => d.contract).sort((a, b) => rating(b) - rating(a)).map((d) => (
            <tr key={d.id}><td>{d.name}</td><td>{game.teams.find((t) => t.id === d.teamId)?.name}</td><td className="num">{rating(d)}</td><td className="num">{d.contract?.salary} M</td><td>{d.contract?.endSeason}</td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}
