import { useState } from 'react';
import { Ico } from '../components/Icon';
import type { GameState, TrainingId } from '../types';
import { STAT_KEYS, STAT_LABELS } from '../types';
import { gameStore } from '../hooks/useGame';
import { CAT_LABEL, PITCHES, TRAININGS, ageOf, pitchBonus, playerOf, scoutingTargets, slTotal } from '../systems/career';
import { APPROACH_LABELS, CAMP_STEPS } from '../systems/camp';
import { rating } from '../systems/market';

const money = (m: number) => (m < 1 ? `${Math.round(m * 1000)} k` : `${m} M`);
const Meter = ({ v, label }: { v: number; label: string }) => (
  <div className="meter"><span>{label}</span><div className="bar"><i style={{ width: `${v}%` }} /></div><b className="num">{v}</b></div>
);

export function Training({ game }: { game: GameState }) {
  const p = playerOf(game);
  if (!p) return null;
  const cur = game.career.training;
  return (
    <>
      <div className="card">
        <Meter v={p.fatigue} label="Fatiga" />
        {p.injuryDays > 0
          ? <p>Lesionado: {p.injuryDays} días de recuperación. No puedes entrenar ni competir.</p>
          : <p className="muted">Entrenar a diario sube tus estadísticas, pero acumula fatiga. Con fatiga alta crece el riesgo de lesión; descansar la reduce.</p>}
      </div>
      <div className="card">
        <table className="data"><tbody>
          {(Object.keys(TRAININGS) as TrainingId[]).map((id) => (
            <tr key={id}><td><strong>{TRAININGS[id].label}</strong><br /><span className="muted">{TRAININGS[id].desc}</span></td>
              <td className="num">+{STAT_LABELS[TRAININGS[id].stat]}</td><td className="num">fatiga {TRAININGS[id].fatigue}/día</td>
              <td><button className={`btn ${cur === id ? 'primary' : ''}`} disabled={p.injuryDays > 0} onClick={() => gameStore.dispatch({ type: 'SET_TRAINING', plan: id })}>{cur === id ? 'En curso' : 'Elegir'}</button></td></tr>
          ))}
        </tbody></table>
        <button className="btn" disabled={!cur} onClick={() => gameStore.dispatch({ type: 'SET_TRAINING', plan: null })}>Descansar</button>
      </div>
    </>
  );
}

export function Contracts({ game }: { game: GameState }) {
  const [counter, setCounter] = useState<Record<string, number>>({});
  const p = playerOf(game);
  const c = game.career.contract;
  if (!p) return null;
  return (
    <>
      {game.career.camp && <CampPanel game={game} />}
      <div className="card">
        <h2>Situación actual</h2>
        <p>Categoría: <strong>{CAT_LABEL[p.category]}</strong></p>
        {c ? <p>Equipo: <strong>{c.teamName}</strong> · {money(c.salary)} anuales · hasta {c.endSeason}</p>
           : <p className="muted">{p.category === 'karting' ? 'Compites por tu cuenta en karting.' : 'No tienes equipo. Espera ofertas o mejora tu nivel.'}</p>}
        <p className="muted">Temporada: {game.career.points} puntos en {game.career.races} carreras</p>
      </div>
      <h2>Ofertas</h2>
      {game.offers.length === 0 && <p className="muted">Sin ofertas. Los equipos te observan tras buenos resultados y al cerrar la temporada.</p>}
      {game.offers.map((o) => (
        <div className="card" key={o.id}>
          <strong>{o.teamName}</strong> · {CAT_LABEL[o.category]}{o.academy && ` · entras en ${o.academy}`}{o.reserve && ' · piloto de pruebas (sigues corriendo en tu categoría)'} · {money(o.salary)} anuales · {o.years} temporada(s)
          <div className="row">
            <button className="btn primary" onClick={() => gameStore.dispatch({ type: 'ACCEPT_OFFER', offerId: o.id, salary: null })}>Aceptar</button>
            <input className="mini" type="number" step="0.01" value={counter[o.id] ?? o.salary} onChange={(e) => setCounter({ ...counter, [o.id]: Number(e.target.value) })} />
            <button className="btn" onClick={() => gameStore.dispatch({ type: 'ACCEPT_OFFER', offerId: o.id, salary: counter[o.id] ?? o.salary })}>Contraofertar</button>
            <button className="btn" onClick={() => gameStore.dispatch({ type: 'DECLINE_OFFER', offerId: o.id })}>Rechazar</button>
          </div>
          <p className="muted">Pedir más de un 30 % arriesga que retiren la oferta.</p>
        </div>
      ))}
      <Scouting game={game} />
      <ReservePanel game={game} />
    </>
  );
}

export function Performance({ game }: { game: GameState }) {
  const p = playerOf(game);
  if (!p) return null;
  return (
    <div className="card">
      <p>Nivel global <strong>{rating(p)}</strong> · {ageOf(game, p)} años · {CAT_LABEL[p.category]}</p>
      <Meter v={p.reputation} label="Reputación" />
      <Meter v={p.fatigue} label="Fatiga" />
      <p><strong>Puntos de habilidad: {game.career.skillPoints}</strong> · se ganan al terminar cada temporada (más si eres joven y quedas arriba) y subes un poco más corriendo. Usa + para subir una estadística.</p>
      <p className="muted">Superlicencia FIA: {slTotal(game)}/40 puntos (últimas 3 temporadas) · Academia: {game.career.academy ?? 'ninguna'}</p>
      <table className="stats"><tbody>{STAT_KEYS.map((k) => (
        <tr key={k}><td>{STAT_LABELS[k]}</td><td className="bar"><i style={{ width: `${p.stats[k]}%` }} /></td><td className="num">{p.stats[k]}</td><td><button className="icon" aria-label={`Subir ${STAT_LABELS[k]}`} disabled={!game.career.skillPoints || p.stats[k] >= 99} onClick={() => gameStore.dispatch({ type: 'SPEND_POINT', stat: k })}>+</button></td></tr>
      ))}</tbody></table>
    </div>
  );
}

const label = (p: number) => (p >= 0.6 ? 'Alta' : p >= 0.3 ? 'Media' : 'Baja');

export function Scouting({ game }: { game: GameState }) {
  const [pitch, setPitch] = useState('talent');
  const t = scoutingTargets(game);
  if (!t) return null;
  const pend = game.career.candidacies.filter((c) => c.kind !== 'sponsor');
  const pendingSet = new Set(pend.map((c) => c.target));
  const row = (kind: 'team' | 'academy') => (x: { name: string; prob: number; blocked: string | null }) => (
    <tr key={x.name}><td>{x.name}</td><td className="muted">Probabilidad {label(x.prob)}</td>
      <td>{pendingSet.has(x.name) ? <span className="muted">En proceso…</span> : x.blocked ? <span className="muted">No antes del {x.blocked}</span>
        : <button className="btn" disabled={pend.length >= 2 || (kind === 'academy' && !!game.career.camp)} onClick={() => gameStore.dispatch({ type: 'APPLY_TO', target: x.name, kind, pitch: kind === 'academy' ? pitch : undefined })}>Presentarme</button>}</td></tr>
  );
  return (
    <>
      <h2>Presentarte a equipos · {CAT_LABEL[t.cat]}</h2>
      <div className="card">
        <p className="muted">Los equipos valoran tu nivel, reputación, popularidad y edad: cuanto más te pasas de la edad de promesa, menos interés. Responden en 1-2 semanas y, si te rechazan, no te valoran en 90 días. Máximo 2 solicitudes a la vez.</p>
        {pend.map((c) => <p key={c.id}>Pendiente: <strong>{c.target}</strong> · respuesta hacia el {c.reply}</p>)}
        <table className="data"><tbody>{t.teams.map(row('team'))}</tbody></table>
      </div>
      {t.academies.length > 0 && (<><h2>Academias de F1</h2><div className="card">
        <p className="muted">Una academia te mete en un equipo asociado y te respalda. Primero debes convencerla frente a otros aspirantes: si te acepta, te invita a un campamento de 4 pruebas y solo entran 2 de 6; tus patrocinadores suman puntos. Si luego rindes mal te sacan de la academia, aunque en karting y F4 sigues en el equipo.</p>
        <label>Tu argumento para convencerlos<select value={pitch} onChange={(e) => setPitch(e.target.value)}>{Object.entries(PITCHES).map(([k, v]) => <option key={k} value={k}>{v.label} · {pitchBonus(game, k) >= 0.1 ? 'fuerte' : pitchBonus(game, k) >= 0 ? 'neutro' : 'débil'}</option>)}</select></label>
        <p className="muted">{PITCHES[pitch].desc}</p>
        <table className="data"><tbody>{t.academies.map(row('academy'))}</tbody></table></div></>)}
    </>
  );
}

export function CampPanel({ game }: { game: GameState }) {
  const camp = game.career.camp;
  if (!camp) return null;
  const step = CAMP_STEPS[camp.step], mine = camp.scores.reduce((a, b) => a + b, 0);
  const rows = [{ name: game.player.name, score: mine, me: true }, ...camp.candidates.map((c) => ({ name: c.name, score: c.score, me: false }))].sort((a, b) => b.score - a.score);
  return (
    <div className="card">
      <h2>Campamento de {camp.academy}</h2>
      <p className="muted">Solo entran {camp.spots} de {rows.length} aspirantes. Prueba {camp.step + 1}/{CAMP_STEPS.length}: <strong>{step.label}</strong> · {step.desc} Al final tus patrocinadores suman puntos.</p>
      <div className="row">{APPROACH_LABELS.map((l, i) => <button className={`btn ${i === 1 ? 'primary' : ''}`} key={l} onClick={() => gameStore.dispatch({ type: 'CAMP_TEST', approach: i })}>{l}</button>)}</div>
      <p className="muted">Conservador: resultado seguro. Equilibrado: algo mejor. Agresivo: puede salir muy bien o muy mal.</p>
      <table className="data"><tbody>{rows.map((r, i) => (<tr key={r.name} className={r.me ? 'sel' : ''}><td className="num">{i + 1}</td><td>{r.name}{r.me && <> <Ico name="star" size={12} className="you" /></>}</td><td className="num">{r.score}</td></tr>))}</tbody></table>
    </div>
  );
}

export function ReservePanel({ game }: { game: GameState }) {
  const p = playerOf(game), r = game.career.reserve;
  if (!p || !game.career.academy) return null;
  return (
    <>
      <h2>Piloto de pruebas</h2>
      <div className="card">
        {r ? <p>Eres piloto de pruebas de <strong>{r.team}</strong> desde {r.since}. En los GP te llaman a las FP1 para rodar con su F1. FP1 disputadas: {game.legacy.fpDone}{game.legacy.fpBest ? ` · mejor puesto: P${game.legacy.fpBest}` : ''}. Si queda un asiento libre, serán los primeros en llamarte (aun sin superlicencia completa si tu nivel es alto).</p>
          : (<><p className="muted">Tu academia puede nombrarte piloto de pruebas de su equipo de F1 (desde F3, con 17 años y buen nivel). Es la vía más rápida a un asiento. También pueden ofrecértelo ellos.</p>
            <div className="row"><button className="btn primary" onClick={() => gameStore.dispatch({ type: 'REQUEST_RESERVE' })}>Pedir ser piloto de pruebas</button></div></>)}
      </div>
    </>
  );
}
