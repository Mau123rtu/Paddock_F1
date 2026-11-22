import { clash } from '../data/sponsors';
import type { Alert, Career, GameState } from '../types';
import { hierLabel, teamFavor } from '../systems/orders';
import { gameStore } from '../hooks/useGame';
import { playerOf } from '../systems/career';
import { recommendSetup, sponsorTargets } from '../systems/extras';
import { CIRCUITS, eventHasCat } from '../data/circuits';

const act = gameStore.dispatch;
const money = (m: number) => (Math.abs(m) < 1 ? `${Math.round(m * 1000)} k` : `${m.toFixed(2)} M`);
const Meter = ({ v, label }: { v: number; label: string }) => (
  <div className="meter"><span>{label}</span><div className="bar"><i style={{ width: `${v}%` }} /></div><b className="num">{v}</b></div>
);

export function Press({ game }: { game: GameState }) {
  const iv = game.interview;
  if (!iv) return null;
  return (
    <div className="card"><strong>Rueda de prensa</strong><p>{iv.question}</p>
      <p className="muted">Tu respuesta afecta a la prensa, a tu equipo, a tus rivales y a tu reputación. El tiempo no avanza hasta que respondas.</p>
      {iv.options.map((o, i) => <div className="row" key={i}><button className="btn" onClick={() => act({ type: 'ANSWER_INTERVIEW', index: i })}>{o.label}</button></div>)}
    </div>
  );
}

export function SetupPage({ game }: { game: GameState }) {
  const p = playerOf(game), s = game.career.setup;
  const next = game.calendar.find((e) => !e.done && e.date >= game.date && eventHasCat(e, p?.category ?? 'karting'));
  const idx = next?.cn ?? 0;
  if (!p) return null;
  const set = (patch: Partial<Career['setup']>) => act({ type: 'SET_SETUP', setup: { ...s, ...patch } });
  return (
    <div className="card">
      <p>Próxima carrera: <strong>{next ? `${next.name} · ${CIRCUITS[next.cn].name}` : 'ninguna'}</strong>. Cada circuito tiene un ajuste ideal que no conoces. Con experiencia {p.stats.experience} tu ingeniero se equivoca menos al recomendar.</p>
      {(['aero', 'suspension', 'brakes'] as const).map((k) => (
        <div className="meter" key={k}><span>{{ aero: 'Aerodinámica', suspension: 'Suspensión', brakes: 'Frenos' }[k]}</span>
          <input type="range" min={0} max={100} value={s[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} style={{ flex: 1 }} /><b className="num">{s[k]}</b></div>
      ))}
      <div className="row"><button className="btn primary" onClick={() => act({ type: 'SET_SETUP', setup: recommendSetup(idx, p.stats.experience) })}>Pedir recomendación al ingeniero</button></div>
      <p className="muted">Un buen ajuste mejora el rendimiento del coche en carrera (hasta +2); uno malo lo empeora (hasta -3).</p>
    </div>
  );
}

export function PersonalSponsorsPage({ game }: { game: GameState }) {
  const c = game.career;
  return (
    <>
      <div className="card"><p>Fondos personales: <strong>{money(c.money)}</strong></p><p className="muted">Cada mes ingresas tu salario y tus patrocinios. No hay límite de patrocinadores, pero las marcas rivales (dos petroleras, dos bancos…) no quieren compartir contigo. Se van si tu reputación cae por debajo de 30.</p></div>
      <h2>Contratos</h2>
      <div className="card"><table className="data"><tbody>
        {c.sponsors.map((d) => (<tr key={d.id}><td>{d.name}</td><td className="num">{money(d.pay)}/año</td><td>hasta {d.endSeason}</td><td><button className="btn" onClick={() => act({ type: 'DROP_PSPONSOR', id: d.id })}>Rescindir</button></td></tr>))}
        {c.sponsors.length === 0 && <tr><td className="muted">Sin patrocinadores.</td></tr>}
      </tbody></table></div>
      <h2>Ofertas</h2>
      {game.sponsorOffers.length === 0 && <p className="muted">Sin ofertas. Llegan al cerrar cada temporada; mejoran con reputación, popularidad y buena relación con la prensa.</p>}
      {game.sponsorOffers.map((o) => { const rival = clash(o.name, c.sponsors.map((x) => x.name)); return (<div className="card" key={o.id}><strong>{o.name}</strong> · {money(o.pay)}/año hasta {o.endSeason}
        {rival && <p className="muted">No quiere estar con {rival}.</p>}
        <div className="row"><button className="btn primary" disabled={!!rival} onClick={() => act({ type: 'ACCEPT_PSPONSOR', id: o.id })}>Aceptar</button><button className="btn" onClick={() => act({ type: 'DECLINE_SPONSOR', id: o.id })}>Rechazar</button></div></div>); })}
    </>
  );
}

export function RelationsPage({ game }: { game: GameState }) {
  const p = playerOf(game), r = game.career.relations, ag = game.career.agent;
  if (!p) return null;
  const people = Object.entries(game.bonds).filter(([k]) => k !== 'engineer').sort((a, b) => b[1] - a[1]).slice(0, 10);
  const friends = people.filter(([, v]) => v >= 70).length, hs = teamFavor(game);
  return (
    <>
      <div className="card">
        <Meter v={r.team} label="Jefe de equipo" /><Meter v={game.bonds.engineer ?? 50} label={`Ingeniero (${game.career.engineer})`} />
        <Meter v={r.media} label="Prensa" /><Meter v={r.rivals} label="Rivales" /><Meter v={p.reputation} label="Reputación" /><Meter v={game.career.popularity} label="Popularidad" />
        <p className="muted">Una relación de 65 o más con el equipo puede salvarte del despido. Tienden a volver a 50 con el tiempo.</p>
      </div>
      {hs.mate && (
        <>
          <h2>Jerarquía en el equipo</h2>
          <div className="card">
            <p><strong>{hierLabel(hs.hier)}</strong> · compañero: {hs.mate}</p>
            <Meter v={Math.round((hs.favor + 1) * 50)} label="Favoritismo del equipo hacia ti" />
            <p className="muted">Esta temporada: {hs.myPts} puntos y {hs.myWins} victoria(s) tuyas frente a {hs.matePts} y {hs.mateWins} de {hs.mate}. Cambia con los resultados: quien rinde más recibe antes las mejoras del coche y, cuando hace falta, el equipo le pide al otro que ceda posiciones.</p>
          </div>
        </>
      )}
      <h2>Pilotos</h2>
      <div className="card">
        {people.length === 0 ? <p className="muted">Todavía no tienes relación con otros pilotos. Se forman al competir cerca de ellos y con tus respuestas en prensa.</p>
          : <>{people.map(([n, v]) => <Meter key={n} v={v} label={n} />)}<p className="muted">{friends > 0 ? `${friends} amistad(es) de 70 o más: sus recomendaciones aumentan las ofertas de equipos.` : 'Con 70 o más, un piloto te recomienda y aumenta tus ofertas.'}</p></>}
      </div>
      <h2>Representante</h2>
      <div className="card">
        {ag.hired ? (<><p>Tu representante cobra el 10 % de tus ingresos, mejora un 10 % las ofertas, te da más margen al contraofertar y aumenta el interés de los equipos.</p>
          <div className="row"><button className="btn primary" onClick={() => act({ type: 'ASK_AGENT' })}>Pedir que busque oportunidades</button><button className="btn" onClick={() => act({ type: 'FIRE_AGENT' })}>Despedir</button></div>
          {ag.nextAsk && <p className="muted">Puede buscar de nuevo a partir del {ag.nextAsk}.</p>}</>)
          : (<><p className="muted">Sin representante. Contratar uno cuesta el 10 % de tus ingresos mensuales.</p><div className="row"><button className="btn primary" onClick={() => act({ type: 'HIRE_AGENT' })}>Contratar representante</button></div></>)}
      </div>
    </>
  );
}

export function AlertModal({ alert, left }: { alert: Alert; left: number }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={alert.title}>
      <div className={`modal-box ${alert.tone}`}>
        <h2>{alert.title}</h2><p>{alert.body}</p>
        <div className="row"><button className="btn primary" autoFocus onClick={() => act({ type: 'DISMISS_ALERT' })}>{left > 1 ? `Siguiente (${left - 1} más)` : 'Cerrar'}</button></div>
      </div>
    </div>
  );
}

const tierName = { 3: 'Fuerte', 2: 'Nacional', 1: 'Local' } as const;
const plabel = (p: number) => (p >= 0.6 ? 'Alta' : p >= 0.3 ? 'Media' : 'Baja');
export function SponsorSearch({ game }: { game: GameState }) {
  const t = sponsorTargets(game), p = playerOf(game);
  if (!t || !p) return null;
  const pend = game.career.candidacies.filter((c) => c.kind === 'sponsor');
  const pendingSet = new Set(pend.map((c) => c.target));
  return (
    <>
      <h2>Buscar patrocinadores · {p.nationality}</h2>
      <div className="card">
        <p className="muted">Las marcas de tu país te prefieren; las globales exigen más popularidad. Las "Fuertes" pagan más pero piden reputación y buenos resultados. Responden en 10-20 días y, si te rechazan, no te valoran en 90 días. Máximo 2 propuestas a la vez.</p>
        {pend.map((c) => <p key={c.id}>Pendiente: <strong>{c.target}</strong> · respuesta hacia el {c.reply}</p>)}
        <table className="data"><thead><tr><th>Marca</th><th>Tipo</th><th>Probabilidad</th><th /></tr></thead><tbody>
          {t.map((b) => (<tr key={b.name}><td>{b.name}</td><td className="muted">{tierName[b.tier]} · {b.local ? 'de tu país' : 'global'}</td><td>{plabel(b.prob)}</td>
            <td>{pendingSet.has(b.name) ? <span className="muted">En proceso…</span> : b.blocked ? <span className="muted">{b.blocked}</span> : <button className="btn" disabled={pend.length >= 2} onClick={() => act({ type: 'APPLY_SPONSOR', name: b.name })}>Proponer</button>}</td></tr>))}
        </tbody></table>
      </div>
    </>
  );
}

import { SERVICES } from '../systems/life';
import type { ServiceKey } from '../systems/life';

export function LifeModal({ game }: { game: GameState }) {
  const ev = game.lifeEvent;
  if (!ev) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={ev.title}>
      <div className="modal-box info">
        <h2>{ev.title}</h2><p>{ev.body}</p>
        {ev.options.map((o, i) => <div className="row" key={i}><button className="btn" onClick={() => act({ type: 'ANSWER_LIFE', index: i })}>{o.label}</button></div>)}
      </div>
    </div>
  );
}

export function LifePage({ game }: { game: GameState }) {
  const c = game.career, recent = game.news.filter((n) => n.headline.startsWith('Vida personal')).slice(0, 5);
  const monthly = (Object.keys(SERVICES) as ServiceKey[]).filter((k) => c.life.services[k]).reduce((a, k) => a + SERVICES[k].cost, 0);
  return (
    <>
      <div className="card"><Meter v={c.life.mood} label="Ánimo" /><p>Fondos personales: <strong>{money(c.money)}</strong> · Gasto mensual en servicios: {money(monthly)}</p>
        <p className="muted">Un ánimo alto (70+) mejora un 10 % lo que aprendes al entrenar; uno bajo (menos de 30) lo reduce un 30 %. Los resultados lo suben o bajan, y cada mes puede surgir un suceso personal en el que decides.</p></div>
      <h2>Servicios</h2>
      <div className="card">{(Object.keys(SERVICES) as ServiceKey[]).map((k) => (
        <div className="row todo" key={k}><span style={{ flex: 1 }}><strong>{SERVICES[k].label}</strong> <span className="muted">{SERVICES[k].desc} · {money(SERVICES[k].cost)}/mes</span></span>
          <button className={`btn ${c.life.services[k] ? 'primary' : ''}`} onClick={() => act({ type: 'TOGGLE_SERVICE', key: k })}>{c.life.services[k] ? 'Contratado' : 'Contratar'}</button></div>))}</div>
      <h2>Últimos sucesos</h2>
      <div className="card">{recent.length === 0 ? <p className="muted">Todavía no ha pasado nada fuera de la pista.</p> : recent.map((n) => <p key={n.id}><span className="muted">{n.date}</span> {n.headline.replace('Vida personal: ', '')} · {n.body}</p>)}</div>
    </>
  );
}
