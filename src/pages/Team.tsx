import { clash } from '../data/sponsors';
import type { GameState } from '../types';
import { gameStore } from '../hooks/useGame';
import { DIFF } from '../systems/difficulty';
import { COMPONENTS, MAX_PROJECTS, ROLE_LABEL, annualExpenses, annualIncome, carRating, projectCost, projectDays } from '../systems/team';

const act = gameStore.dispatch;
const myTeam = (g: GameState) => g.teams.find((t) => t.id === g.player.teamId);
const Bar = ({ v }: { v: number }) => <div className="bar"><i style={{ width: `${v}%` }} /></div>;

export function StaffPage({ game }: { game: GameState }) {
  return (
    <>
      <h2>Plantilla</h2>
      <div className="card"><table className="data"><thead><tr><th>Nombre</th><th>Área</th><th>Nivel</th><th>Salario</th><th /></tr></thead><tbody>
        {game.ops.staff.map((x) => (<tr key={x.id}><td>{x.name}</td><td>{ROLE_LABEL[x.role]}</td><td className="num">{x.skill}</td><td className="num">{x.salary} M</td>
          <td><button className="btn" onClick={() => act({ type: 'FIRE_STAFF', staffId: x.id })}>Despedir</button></td></tr>))}
      </tbody></table></div>
      <h2>Candidatos disponibles</h2>
      <div className="card"><table className="data"><tbody>
        {game.staffPool.map((x) => (<tr key={x.id}><td>{x.name}</td><td>{ROLE_LABEL[x.role]}</td><td className="num">{x.skill}</td><td className="num">{x.salary} M</td>
          <td><button className="btn primary" onClick={() => act({ type: 'HIRE_STAFF', staffId: x.id })}>Contratar</button></td></tr>))}
      </tbody></table></div>
    </>
  );
}

export function CarPage({ game }: { game: GameState }) {
  return (
    <>
      <div className="card"><strong>Rendimiento global: {carRating(game.ops)}</strong>
        <table className="data"><thead><tr><th>Componente</th><th>Rendimiento</th><th>Fiabilidad</th><th>Nivel</th></tr></thead><tbody>
          {game.ops.car.map((c) => (<tr key={c.id}><td>{c.label}</td><td><Bar v={c.performance} /> <span className="num">{c.performance}</span></td><td><Bar v={c.reliability} /> <span className="num">{c.reliability}</span></td><td className="num">{c.level}</td></tr>))}
        </tbody></table></div>
      <h2>Rivales</h2>
      <div className="card"><table className="data"><tbody>
        {[...game.teams].sort((a, b) => b.carPerf - a.carPerf).map((t) => (<tr key={t.id}><td>{t.name}</td><td><Bar v={t.carPerf} /></td><td className="num">{t.carPerf}</td></tr>))}
      </tbody></table></div>
    </>
  );
}

export function DevPage({ game }: { game: GameState }) {
  const team = myTeam(game);
  return (
    <>
      <p className="muted">Presupuesto: {team?.budget} M · Gasto en desarrollo: {game.ops.devSpent}/{DIFF[game.difficulty].cap} M (límite de temporada) · Proyectos: {game.ops.projects.length}/{MAX_PROJECTS} · Duración según ingeniería y diseño: {projectDays(game.ops)} días. Mejorar sube el rendimiento pero puede bajar la fiabilidad.</p>
      {game.ops.projects.length > 0 && <div className="card"><table className="data"><tbody>
        {game.ops.projects.map((p) => (<tr key={p.id}><td>{p.label}</td><td className="num">{p.daysLeft} días restantes</td></tr>))}
      </tbody></table></div>}
      <div className="card"><table className="data"><thead><tr><th>Componente</th><th>Nivel</th><th>Coste</th><th /></tr></thead><tbody>
        {COMPONENTS.map((k) => {
          const c = game.ops.car.find((x) => x.id === k.id);
          if (!c) return null;
          return (<tr key={k.id}><td>{k.label}</td><td className="num">{c.level}</td><td className="num">{projectCost(c.level)} M</td>
            <td><button className="btn primary" onClick={() => act({ type: 'START_PROJECT', componentId: k.id })}>Desarrollar</button></td></tr>);
        })}
      </tbody></table></div>
    </>
  );
}

export function FinancePage({ game }: { game: GameState }) {
  const team = myTeam(game);
  if (!team) return null;
  const inc = annualIncome(game, team), exp = annualExpenses(game, team);
  return (
    <>
      <div className="card">
        <p>Presupuesto: <strong>{team.budget} M</strong></p>
        <p className="muted">Proyección anual: ingresos {inc} M (patrocinadores + derechos comerciales) · gastos {exp} M (pilotos, personal e instalaciones) · balance {(inc - exp).toFixed(1)} M. Los premios llegarán con las carreras (Fase 5).</p>
      </div>
      <div className="card"><table className="data"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th></tr></thead><tbody>
        {[...game.ops.ledger].reverse().map((l) => (<tr key={l.month}><td>{l.month}</td><td className="num">{l.income} M</td><td className="num">{l.expenses} M</td></tr>))}
        {game.ops.ledger.length === 0 && <tr><td colSpan={3} className="muted">El primer cierre mensual ocurre el día 1 del mes siguiente.</td></tr>}
      </tbody></table></div>
    </>
  );
}

export function SponsorsPage({ game }: { game: GameState }) {
  return (
    <>
      <h2>Contratos</h2>
      <div className="card"><table className="data"><tbody>
        {game.ops.sponsors.map((d) => (<tr key={d.id}><td>{d.name}</td><td className="num">{d.pay} M/año</td><td>hasta {d.endSeason}</td>
          <td><button className="btn" onClick={() => act({ type: 'DROP_SPONSOR', id: d.id })}>Rescindir</button></td></tr>))}
        {game.ops.sponsors.length === 0 && <tr><td className="muted">Sin patrocinadores.</td></tr>}
      </tbody></table></div>
      <h2>Ofertas</h2>
      {game.sponsorOffers.length === 0 && <p className="muted">Sin ofertas. Llegan al terminar cada temporada; el marketing las mejora.</p>}
      {game.sponsorOffers.map((o) => { const rival = clash(o.name, game.ops.sponsors.map((x) => x.name)); return (<div className="card" key={o.id}><strong>{o.name}</strong> · {o.pay} M/año hasta {o.endSeason}
        {rival && <p className="muted">No quiere estar con {rival}.</p>}
        <div className="row"><button className="btn primary" disabled={!!rival} onClick={() => act({ type: 'ACCEPT_SPONSOR', id: o.id })}>Aceptar</button>
          <button className="btn" onClick={() => act({ type: 'DECLINE_SPONSOR', id: o.id })}>Rechazar</button></div></div>); })}
    </>
  );
}
