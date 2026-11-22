import { useState } from 'react';
import { Ico } from '../components/Icon';
import type { GameState } from '../types';
import { gameStore } from '../hooks/useGame';
import { REQ, checks } from '../systems/fia';
import { rating } from '../systems/market';

const act = gameStore.dispatch;

export function FiaPage({ game }: { game: GameState }) {
  const [amount, setAmount] = useState(5);
  const a = game.application, team = game.teams.find((t) => t.id === game.player.teamId);
  if (!a || !team) return null;
  const q = REQ(game);
  return (
    <>
      <div className="card"><p>Para competir en la F1 necesitas la aprobación de la FIA. Cuando cumplas los requisitos, presenta la solicitud: la revisión dura 30 días y la inscripción cuesta {q.fee} M. Estado: <strong>{a.status === 'review' ? `en revisión (${a.daysLeft} días)` : 'borrador'}</strong>{a.attempts > 0 && ` · intentos fallidos: ${a.attempts}`}</p></div>
      <div className="card"><table className="data"><thead><tr><th>Requisito</th><th>Tienes</th><th>Se exige</th><th /></tr></thead><tbody>
        {checks(game).map((c) => (<tr key={c.label}><td>{c.label}</td><td>{c.have}</td><td className="muted">{c.need}</td><td>{c.ok ? <Ico name="tick" size={16} className="okc" /> : <Ico name="close" size={16} className="bad" />}</td></tr>))}
      </tbody></table>
        {a.reasons.length > 0 && <><p><strong>Motivos del último rechazo</strong></p><ul className="log">{a.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>}
      </div>
      <div className="card">
        <div className="row"><input className="mini" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <button className="btn" disabled={a.status !== 'draft'} onClick={() => act({ type: 'INVEST_FACILITIES', amount })}>Invertir en instalaciones (M)</button>
          <button className="btn" disabled={a.status !== 'draft'} onClick={() => act({ type: 'LOBBY_FIA' })}>Reunirte con la FIA (2 M)</button>
          <button className="btn primary" disabled={a.status !== 'draft'} onClick={() => act({ type: 'SUBMIT_APPLICATION' })}>Presentar solicitud</button></div>
        <p className="muted">Contrata personal en la sección Personal y busca patrocinadores. Presupuesto actual: {team.budget} M. Tu equipo no competirá hasta ser admitido; mientras tanto las carreras se disputan sin ti.</p>
      </div>
    </>
  );
}

export function AcademyPage({ game }: { game: GameState }) {
  const age = (b: number) => game.season - b;
  return (
    <>
      <h2>Academia ({game.ops.academy.length}/3)</h2>
      <div className="card"><table className="data"><thead><tr><th>Piloto</th><th>Edad</th><th>Nivel</th><th>Potencial</th><th /></tr></thead><tbody>
        {game.ops.academy.map((d) => (<tr key={d.id}><td>{d.name}</td><td className="num">{age(d.birthYear)}</td><td className="num">{rating(d)}</td><td className="num">{d.potential}</td>
          <td><button className="btn primary" onClick={() => act({ type: 'PROMOTE_YOUTH', id: d.id })}>Ascender a titular</button> <button className="btn" onClick={() => act({ type: 'RELEASE_YOUTH', id: d.id })}>Liberar</button></td></tr>))}
        {game.ops.academy.length === 0 && <tr><td colSpan={5} className="muted">Sin jóvenes. Ficha talentos abajo: mejoran cada mes hasta su potencial y sirven de reserva.</td></tr>}
      </tbody></table></div>
      <h2>Jóvenes talentos disponibles</h2>
      <div className="card"><table className="data"><tbody>
        {game.youth.map((d) => (<tr key={d.id}><td>{d.name}</td><td className="num">{age(d.birthYear)} años</td><td className="num">nivel {rating(d)}</td><td className="num">potencial {d.potential}</td>
          <td><button className="btn" onClick={() => act({ type: 'SIGN_YOUTH', id: d.id })}>Fichar (0.5 M)</button></td></tr>))}
        {game.youth.length === 0 && <tr><td className="muted">No quedan talentos esta temporada.</td></tr>}
      </tbody></table></div>
    </>
  );
}
