import { useEffect, useMemo, useState } from 'react';
import type { Celebration, Compound, FPRun, GameState, SeasonSummary } from '../types';
import { gameStore } from '../hooks/useGame';
import { ACHIEVEMENTS, FP_RUNS, GOALS, PROGRAMS, careerLog, fpEval, fpTable, legacyScore, worldChampions } from '../systems/legacy';
import { CAT_LABEL, CATEGORIES, playerOf } from '../systems/career';
import { RECORD_DEFS, REAL_CHAMPIONS, REAL_LAST_SEASON } from '../data/history';
import { BarList, LineChart } from '../components/Charts';
import { fanfare } from '../audio/sound';
import { Ico } from '../components/Icon';

const act = gameStore.dispatch;
const Bar = ({ v }: { v: number }) => <div className="bar"><i style={{ width: `${Math.min(100, v)}%` }} /></div>;
const fmt = (t: number) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(3).padStart(6, '0')}`; };

/* ───────────── Celebraciones ───────────── */
const KIND_ICON: Record<Celebration['kind'], string> = { win: 'trophy', pole: 'timer', title: 'crown', promo: 'rocket', record: 'chart', trophy: 'medal', hall: 'landmark' };
const Star = () => <Ico name="star" size={13} className="you" />;
const Crowns = ({ n }: { n: number }) => <span className="crownrow" aria-hidden="true">{Array.from({ length: Math.min(n, 8) }, (_, i) => <Ico key={i} name="crown" size={16} />)}</span>;
const CONF = ['#ffd24a', '#e8002d', '#3fa7ff', '#4ad66d', '#ffffff', '#ff7ac8'];
export function CelebrationOverlay({ game }: { game: GameState }) {
  const c = game.legacy.celebrations[0];
  const small = c?.kind === 'trophy' || c?.kind === 'pole';
  const pieces = useMemo(() => (c && !small ? Array.from({ length: 64 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.9, dur: 2.8 + Math.random() * 2.4, size: 6 + Math.random() * 9, color: CONF[i % CONF.length], rot: Math.random() * 360 })) : []), [c?.id, small]);
  useEffect(() => {
    if (!c) return;
    fanfare();
    if (!small) return;
    const t = setTimeout(() => act({ type: 'DISMISS_CELEBRATION' }), 5200);
    return () => clearTimeout(t);
  }, [c?.id, small]);
  if (!c) return null;
  const left = game.legacy.celebrations.length;
  if (small) {
    return (
      <div className="toast" role="status" aria-live="polite">
        <span className="ticon"><Ico name={c.icon ?? KIND_ICON[c.kind]} size={30} /></span><div><strong>{c.title}</strong><p>{c.sub}</p></div>
        <button className="icon" aria-label="Cerrar" onClick={() => act({ type: 'DISMISS_CELEBRATION' })}><Ico name="close" size={16} /></button>
      </div>
    );
  }
  const podium = c.kind === 'win' || c.kind === 'title';
  return (
    <div className="modal celebrate" role="dialog" aria-modal="true" aria-label={c.title} onClick={() => act({ type: 'DISMISS_CELEBRATION' })}>
      <div className="confetti" aria-hidden="true">{pieces.map((p, i) => <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.45, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />)}</div>
      <div className="cbox" onClick={(e) => e.stopPropagation()}>
        <div className="cup"><Ico name={c.icon ?? KIND_ICON[c.kind]} size={88} /></div>
        <h2>{c.title}</h2>
        <p>{c.sub}</p>
        {podium && <div className="podium" aria-hidden="true"><div className="p2"><b>2</b></div><div className="p1"><b>1</b></div><div className="p3"><b>3</b></div></div>}
        <button className="btn primary" autoFocus onClick={() => act({ type: 'DISMISS_CELEBRATION' })}>{left > 1 ? `Continuar (${left - 1} más)` : 'Continuar'}</button>
      </div>
    </div>
  );
}

/* ───────────── Resúmenes de temporada ───────────── */
export function SummaryView({ sum }: { sum: SeasonSummary }) {
  const delta = sum.ratingEnd - sum.ratingStart;
  const labels = sum.races.map((r) => r.name);
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Temporada {sum.season} · {CAT_LABEL[sum.category]}</h2>
      <p className="lead">{sum.headline} <span className="muted">· {sum.team}</span></p>
      <div className="card home">
        <div><span className="muted">Puesto</span><b>{sum.rank ? `P${sum.rank}` : '—'}</b></div>
        <div><span className="muted">Puntos</span><b>{sum.points}</b></div>
        <div><span className="muted">Victorias</span><b>{sum.wins}</b></div>
        <div><span className="muted">Podios</span><b>{sum.podiums}</b></div>
        <div><span className="muted">Poles</span><b>{sum.poles}</b></div>
        <div><span className="muted">Abandonos</span><b>{sum.dnfs}</b></div>
        <div><span className="muted">Nivel</span><b>{sum.ratingStart} → {sum.ratingEnd} <small className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{delta}</small></b></div>
        <div><span className="muted">Campeón</span><b>{sum.champion}</b></div>
      </div>
      <h3>Puntos acumulados</h3>
      <LineChart label="Puntos acumulados por carrera frente al líder" labels={labels} series={[{ name: 'Tú', color: 'var(--accent)', values: sum.races.map((r) => r.cum) }, { name: 'Líder', color: '#8b9099', dashed: true, values: sum.races.map((r) => r.leaderCum) }]} />
      <h3>Posición de llegada</h3>
      <LineChart label="Posición de llegada en cada carrera" invert labels={labels} series={[{ name: 'Posición', color: '#3fa7ff', values: sum.races.map((r) => r.pos) }]} />
      <p className="muted">Los abandonos quedan fuera de la gráfica.</p>
      <h3>Clasificación final</h3>
      <BarList unit=" pts" items={sum.table.map((t) => ({ label: t.name, value: t.pts, hi: t.me }))} />
    </>
  );
}
export function SummaryModal({ game }: { game: GameState }) {
  const sum = game.legacy.pendingSummary;
  if (!sum || game.legacy.celebrations.length) return null;
  return (
    <div className="modal wide" role="dialog" aria-modal="true" aria-label={`Resumen de la temporada ${sum.season}`}>
      <div className="modal-box good big">
        <SummaryView sum={sum} />
        <div className="row"><button className="btn primary" autoFocus onClick={() => act({ type: 'DISMISS_SUMMARY' })}>Empezar la nueva temporada</button></div>
      </div>
    </div>
  );
}
export function SeasonsPage({ game }: { game: GameState }) {
  const list = game.legacy.summaries;
  const [sel, setSel] = useState<number | null>(null);
  if (list.length === 0) return <p className="muted">Todavía no has cerrado ninguna temporada. Al acabar el año, tu resumen aparece aquí.</p>;
  const cur = list.find((x) => x.season === sel) ?? list[list.length - 1];
  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Tu evolución</h3>
        <LineChart label="Tu nivel al cierre de cada temporada" labels={list.map((x) => String(x.season))} series={[{ name: 'Nivel', color: '#4ad66d', values: list.map((x) => x.ratingEnd) }]} />
        <LineChart label="Tu puesto final en cada temporada" invert height={150} labels={list.map((x) => String(x.season))} series={[{ name: 'Puesto final', color: 'var(--accent)', values: list.map((x) => x.rank) }]} />
      </div>
      <div className="tabs" role="tablist" aria-label="Temporada">
        {[...list].reverse().map((x) => <button key={x.season} className={`btn ${x.season === cur.season ? 'primary' : ''}`} onClick={() => setSel(x.season)}>{x.season}</button>)}
      </div>
      <div className="card"><SummaryView sum={cur} /></div>
    </>
  );
}

/* ───────────── Logros y trofeos ───────────── */
export function AchievementsStrip({ game }: { game: GameState }) {
  const have = new Set(game.legacy.trophies.map((t) => t.id)), last = [...game.legacy.trophies].slice(-5).reverse();
  return (
    <>
      <h2>Logros <span className="muted">({have.size}/{ACHIEVEMENTS.length})</span></h2>
      <div className="card">
        {last.length === 0 ? <p className="muted">Aún no tienes ningún logro. Sal a pista.</p>
          : <div className="medals">{last.map((t) => { const a = ACHIEVEMENTS.find((x) => x.id === t.id); return a ? <span className="medal" key={t.id} title={a.desc}><i><Ico name={a.icon} size={15} /></i>{a.label}</span> : null; })}</div>}
        <Bar v={(have.size / ACHIEVEMENTS.length) * 100} />
      </div>
    </>
  );
}
export function AchievementsPage({ game }: { game: GameState }) {
  const l = game.legacy, have = new Map(l.trophies.map((t) => [t.id, t]));
  const cups = l.champions.filter((c) => c.player);
  const log = careerLog(l, game.player.name), st = game.career.stats;
  return (
    <>
      <div className="card home">
        <div><span className="muted">Logros</span><b>{have.size}/{ACHIEVEMENTS.length}</b></div>
        <div><span className="muted">Títulos</span><b>{cups.length}</b></div>
        <div><span className="muted">Victorias</span><b>{st.wins}</b></div>
        <div><span className="muted">Podios</span><b>{st.podiums}</b></div>
        <div><span className="muted">Poles</span><b>{st.poles}</b></div>
        <div><span className="muted">Victorias en F1</span><b>{log.wins}</b></div>
      </div>
      <h2>Vitrina de trofeos</h2>
      <div className="card cabinet">
        {cups.length === 0 ? <p className="muted">La vitrina está vacía. Gana un campeonato para estrenarla.</p>
          : cups.map((c) => (<div className={`cupcard ${c.category === 'f1' ? 'gold' : ''}`} key={`${c.category}${c.season}`}><Ico name={c.category === 'f1' ? 'crown' : 'trophy'} size={34} /><b>{CAT_LABEL[c.category]}</b><small>{c.season} · {c.team}</small></div>))}
      </div>
      <h2>Todos los logros</h2>
      <div className="ach">
        {ACHIEVEMENTS.map((a) => {
          const t = have.get(a.id), prog = a.progress?.(game);
          return (
            <div className={`achcard ${t ? 'got' : ''}`} key={a.id}>
              <span className="aicon"><Ico name={t ? a.icon : 'lock'} size={26} /></span>
              <div><strong>{a.label}</strong><p className="muted">{a.desc}</p>
                {t ? <small className="okc">Conseguido en {t.season}</small> : prog ? <><Bar v={(prog[0] / prog[1]) * 100} /><small className="muted">{prog[0]}/{prog[1]}</small></> : <small className="muted">Bloqueado</small>}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───────────── Récords ───────────── */
export function RecordsPage({ game }: { game: GameState }) {
  const l = game.legacy, me = game.player.name, log = careerLog(l, me), p = playerOf(game);
  return (
    <>
      <p className="muted">Récords reales hasta 2025 (cifras aproximadas). Si alguien rompe uno en tu partida, su nombre pasa a la tabla.</p>
      <div className="card"><table className="data"><thead><tr><th>Récord</th><th>Titular</th><th>Marca</th><th>Año</th><th /></tr></thead><tbody>
        {RECORD_DEFS.map((d) => {
          const r = l.records.find((x) => x.key === d.key);
          if (!r) return null;
          const empty = r.holder === '—';
          return (
            <tr key={d.key} className={r.holder === me ? 'sel' : ''}>
              <td>{d.label}</td><td>{empty ? <span className="muted">Sin titular</span> : r.holder}{r.holder === me && <> <Star /></>}</td>
              <td className="num"><strong>{empty ? '—' : `${r.value}${d.unit}`}</strong></td><td className="num muted">{r.season ?? '—'}</td>
              <td>{!empty && <span className={`pill ${r.real ? 'histórico' : 'activo'}`}>{r.real ? 'Histórico' : 'Tu partida'}</span>}</td>
            </tr>
          );
        })}
      </tbody></table></div>
      <h2>Tus marcas</h2>
      <div className="card home">
        <div><span className="muted">Carreras</span><b>{game.career.stats.races}</b></div>
        <div><span className="muted">Victorias</span><b>{game.career.stats.wins}</b></div>
        <div><span className="muted">Podios</span><b>{game.career.stats.podiums}</b></div>
        <div><span className="muted">Poles</span><b>{game.career.stats.poles}</b></div>
        <div><span className="muted">Primera victoria</span><b>{log.firstWin ? `${log.firstWin.age} años` : '—'}</b></div>
        <div><span className="muted">Edad</span><b>{p ? game.season - p.birthYear : '—'}</b></div>
      </div>
    </>
  );
}

/* ───────────── Vitrina de campeones del mundo ───────────── */
export function ChampionsPage({ game }: { game: GameState }) {
  const [tab, setTab] = useState<'cards' | 'stats' | 'years' | 'cats' | 'cons'>('cards');
  const [sort, setSort] = useState<'first' | 'titles' | 'wins' | 'podiums' | 'poles'>('first');
  const [filter, setFilter] = useState<'all' | 'active' | 'gone'>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'karting' | 'f4' | 'f3' | 'f2'>('f2');
  const l = game.legacy, champs = useMemo(() => worldChampions(game), [game.legacy.champions, game.drivers, game.legacy.hall]);
  const shown = champs.filter((c) => (filter === 'all' || (filter === 'active' ? c.status === 'activo' || c.status === 'sin equipo' : c.status === 'retirado' || c.status === 'histórico')) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const years = [...REAL_CHAMPIONS.filter((c) => c.season < l.startSeason && c.season <= REAL_LAST_SEASON).map((c) => ({ season: c.season, driver: c.driver, team: c.team, rating: null as number | null, pts: null as number | null, sim: false })),
    ...l.champions.filter((c) => c.category === 'f1').map((c) => ({ season: c.season, driver: c.driver, team: c.team, rating: c.rating, pts: c.pts, sim: true }))].sort((a, b) => b.season - a.season);
  return (
    <>
      <p className="muted">Todos los campeones de la F1: los reales hasta 2025 y los que salgan en tu partida.</p>
      <div className="tabs" role="tablist" aria-label="Vista">
        {([['cards', 'Vitrina'], ['stats', 'Estadísticas'], ['years', 'Año por año'], ['cons', 'Constructores'], ['cats', 'Otras categorías']] as const).map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn ${tab === k ? 'primary' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === 'cards' && (
        <>
          <div className="grid2">
            <label>Buscar piloto<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre" /></label>
            <label>Mostrar<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">Todos</option><option value="active">En activo</option><option value="gone">Retirados e históricos</option></select></label>
          </div>
          <div className="champs">
            {shown.map((c) => (
              <article className={`champ ${c.titles >= 5 ? 'legend' : ''}`} key={c.name}>
                <header><h3>{c.name}</h3><span className={`pill ${c.status}`}>{c.status}</span></header>
                <div className="crowns" aria-label={`${c.titles} títulos`}><Crowns n={c.titles} /> <b>{c.titles}</b> título{c.titles === 1 ? '' : 's'}</div>
                <div className="years">{c.years.map((y) => <span className={`chip ${y.rating ? 'sim' : ''}`} key={y.season} title={`${y.team}${y.rating ? ` · nivel ${y.rating}` : ''}${y.pts ? ` · ${y.pts} pts` : ''}`}>{y.season}</span>)}</div>
                {c.level !== null && <div className="lmeter"><span>Nivel</span><Bar v={c.level} /><b className="num">{c.level}</b></div>}
                <small className="muted">{c.team ? `${c.team} · ` : ''}{c.age !== null ? `${c.age} años · ` : ''}{c.wins} victorias · {c.poles} poles · {c.podiums} podios</small>
              </article>
            ))}
            {shown.length === 0 && <p className="muted">Sin resultados.</p>}
          </div>
        </>
      )}
      {tab === 'stats' && (
        <div className="card scroll">
          <table className="data"><thead><tr><th>#</th><th>Piloto</th>
            {([['titles', 'Campeonatos'], ['wins', 'Victorias'], ['podiums', 'Podios'], ['poles', 'Poles']] as const).map(([k, t]) => <th key={k}><button className={`btn ${sort === k ? 'primary' : ''}`} onClick={() => setSort(sort === k ? 'first' : k)}>{t}</button></th>)}</tr></thead><tbody>
            {[...champs].sort((a, b) => (sort === 'first' ? a.years[0].season - b.years[0].season : b[sort] - a[sort] || a.years[0].season - b.years[0].season)).map((c, i) => {
              const live = c.status === 'activo' || c.status === 'sin equipo';
              return (<tr key={c.name} className={c.name === game.player.name ? 'sel' : ''}><td className="num">{i + 1}</td><td>{c.name}{c.name === game.player.name && <> <Star /></>}</td>
                <td className="num">{c.titles}{live && '*'}</td><td className="num">{c.wins}{live && '*'}</td><td className="num">{c.podiums}{live && '*'}</td><td className="num">{c.poles}{live && '*'}</td></tr>);
            })}
          </tbody></table>
          <p className="muted">* Piloto en activo: sus cifras siguen subiendo con tu partida. Pulsa una columna para ordenar; pulsa otra vez para volver al orden cronológico.</p>
        </div>
      )}
      {tab === 'years' && (
        <div className="card scroll"><table className="data"><thead><tr><th>Año</th><th>Campeón</th><th>Equipo</th><th>Nivel</th><th>Pts</th></tr></thead><tbody>
          {years.map((y) => (<tr key={y.season} className={y.driver === game.player.name ? 'sel' : ''}><td className="num">{y.season}</td><td>{y.driver}{y.sim && <> <Star /></>}</td><td className="muted">{y.team}</td><td className="num">{y.rating ?? '—'}</td><td className="num">{y.pts ?? '—'}</td></tr>))}
        </tbody></table><p className="muted"><Star /> Campeón de tu partida.</p></div>
      )}
      {tab === 'cons' && (
        <div className="card">
          {l.constructors.length === 0 ? <p className="muted">Todavía no hay temporadas cerradas.</p>
            : <table className="data"><thead><tr><th>Año</th><th>Constructor</th><th>Puntos</th></tr></thead><tbody>{[...l.constructors].reverse().map((c) => <tr key={c.season}><td className="num">{c.season}</td><td>{c.team}</td><td className="num">{c.pts}</td></tr>)}</tbody></table>}
        </div>
      )}
      {tab === 'cats' && (
        <>
          <div className="tabs">{CATEGORIES.filter((c) => c !== 'f1').map((c) => <button key={c} className={`btn ${c === cat ? 'primary' : ''}`} onClick={() => setCat(c as typeof cat)}>{CAT_LABEL[c]}</button>)}</div>
          <div className="card">
            {l.champions.filter((c) => c.category === cat).length === 0 ? <p className="muted">Aún no hay campeones de {CAT_LABEL[cat]} en tu partida.</p>
              : <table className="data"><thead><tr><th>Año</th><th>Campeón</th><th>Equipo</th><th>Edad</th><th>Nivel</th><th>Pts</th></tr></thead><tbody>
                {[...l.champions.filter((c) => c.category === cat)].reverse().map((c) => <tr key={c.season} className={c.player ? 'sel' : ''}><td className="num">{c.season}</td><td>{c.driver}{c.player && <> <Star /></>}</td><td className="muted">{c.team}</td><td className="num">{c.age || '—'}</td><td className="num">{c.rating}</td><td className="num">{c.pts}</td></tr>)}
              </tbody></table>}
          </div>
        </>
      )}
    </>
  );
}

/* ───────────── Salón de la Fama ───────────── */
export function HallPage({ game }: { game: GameState }) {
  const [sure, setSure] = useState(false);
  const l = game.legacy, p = playerOf(game), prev = legacyScore(game);
  const members = [...l.hall].sort((a, b) => b.titles - a.titles || b.wins - a.wins);
  return (
    <>
      {l.retired ? (
        <div className="card inducted">
          <div className="cup"><Ico name="landmark" size={68} /></div>
          <h2 style={{ margin: 0 }}>{game.player.name}</h2>
          <p className="lead">{l.retired.verdict} · retirado en {l.retired.season} a los {l.retired.age} años · puntuación de legado {l.retired.score}</p>
          <p className="muted">El campeonato sigue sin ti. Avanza el tiempo y míralo desde la grada.</p>
        </div>
      ) : p && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Colgar el casco</h3>
          <p>Cuelga el casco y entra en el Salón de la Fama. Hoy tu legado vale <strong>{prev.score}</strong> puntos: te recordarían como <strong>{prev.verdict}</strong>.</p>
          <p className="muted">Sin vuelta atrás: dejas de competir, pero el mundo sigue.</p>
          {sure ? <div className="row"><strong>¿Colgar el casco para siempre?</strong><button className="btn primary" onClick={() => act({ type: 'RETIRE' })}>Sí, retirarme</button><button className="btn" onClick={() => setSure(false)}>Cancelar</button></div>
            : <div className="row"><button className="btn" onClick={() => setSure(true)}>Retirarme</button></div>}
        </div>
      )}
      <h2>Miembros del Salón de la Fama</h2>
      {members.length === 0 ? <p className="muted">Aún no hay nadie. Entran los campeones y grandes ganadores cuando se retiran.</p> : (
        <div className="champs">{members.map((m) => (
          <article className={`champ ${m.player ? 'legend' : ''}`} key={m.name + m.season}>
            <header><h3>{m.name}{m.player && <> <Star /></>}</h3><span className="pill histórico">{m.season}</span></header>
            <div className="crowns"><Crowns n={m.titles} /> <b>{m.titles}</b> título{m.titles === 1 ? '' : 's'}</div>
            <p style={{ margin: '.2rem 0' }}>{m.verdict}</p>
            <small className="muted">{m.wins} victorias · {m.poles} poles · {m.podiums} podios · retirado a los {m.age} · nivel máx. {m.peak}</small>
          </article>))}
        </div>
      )}
    </>
  );
}

/* ───────────── Prácticas libres de F1 (piloto de reserva) ───────────── */
const TYRES: Record<Exclude<Compound, 'W'>, string> = { S: 'Blando', M: 'Medio', H: 'Duro' };
const MODES: Record<FPRun['mode'], string> = { normal: 'Segura', push: 'Atacar', risk: 'Arriesgar' };
export function ReserveFPPage({ game }: { game: GameState }) {
  const fp = game.legacy.fp;
  const [program, setProgram] = useState<FPRun['program']>('pace');
  const [tyre, setTyre] = useState<Compound>('M');
  const [mode, setMode] = useState<FPRun['mode']>('push');
  const table = useMemo(() => (fp ? fpTable(game) : null), [fp]);
  const ev = useMemo(() => (fp ? fpEval(game) : null), [fp]);
  if (!fp || !table || !ev) return <p className="muted">Sin sesión pendiente. Si eres piloto de pruebas, el equipo te llamará en pleno fin de semana de GP.</p>;
  const last = fp.log[fp.log.length - 1], first = game.legacy.fpDone === 0;
  const lead = table.rows.find((r) => r.time !== null)?.time ?? null;
  return (
    <>
      <div className="card">
        <p><strong>{fp.team}</strong> te presta el coche de <strong>{fp.replaces}</strong> para las FP1 del <strong>{fp.eventName}</strong>. Te quedan <strong>{fp.runsLeft}</strong> de {FP_RUNS} tandas. Un accidente te cuesta dos y mancha tu imagen.</p>
        {first && <p className="muted">Primer F1: el coche te queda grande y lo notarás en el cronómetro. Con cada sesión te adaptas mejor. Con poca concentración, te sales.</p>}
        <p className="muted">Fatiga: {playerOf(game)?.fatigue ?? 0}. Cansado, vas más lento.</p>
      </div>
      <h2>Objetivos del equipo</h2>
      <div className="card">
        {GOALS.map((g, i) => <div className="goal" key={g.id}><Ico name={ev.goals[i] ? 'check' : 'square'} size={16} /> {g.label}{g.id === 'gap' && ev.regularGap !== null && <span className="muted"> (ahora {ev.regularGap >= 0 ? '+' : ''}{ev.regularGap.toFixed(3)} s)</span>}</div>)}
        <p className="muted">Nota provisional: <strong>{ev.score}/100</strong>. Una buena sesión sube tu reputación y te acerca a un asiento.</p>
      </div>
      <h2>Salir a pista</h2>
      <div className="card">
        <div className="progs" role="radiogroup" aria-label="Programa de la tanda">
          {(Object.keys(PROGRAMS) as FPRun['program'][]).map((k) => (
            <button key={k} role="radio" aria-checked={program === k} className={`prog ${program === k ? 'on' : ''}`} onClick={() => setProgram(k)}><strong>{PROGRAMS[k].label}</strong><small>{PROGRAMS[k].desc}</small></button>
          ))}
        </div>
        <div className="grid2">
          <label>Neumático<select value={tyre} disabled={program === 'aero' || program === 'tyres'} onChange={(e) => setTyre(e.target.value as Compound)}>{(Object.keys(TYRES) as (keyof typeof TYRES)[]).map((k) => <option key={k} value={k}>{TYRES[k]}</option>)}</select></label>
          <label>Ritmo de la vuelta<select value={mode} disabled={program !== 'pace'} onChange={(e) => setMode(e.target.value as FPRun['mode'])}>{(Object.keys(MODES) as FPRun['mode'][]).map((k) => <option key={k} value={k}>{MODES[k]}</option>)}</select></label>
        </div>
        <p className="muted">Segura: sin riesgo. Atacar: más rápido, algo de riesgo. Arriesgar: lo más rápido… o al muro.</p>
        <div className="row">
          <button className="btn primary" disabled={fp.runsLeft <= 0} onClick={() => act({ type: 'FP_RUN', program, tyre, mode })}>Salir a pista</button>
          <button className="btn" disabled={fp.log.length === 0} onClick={() => act({ type: 'FP_FINISH' })}>Terminar sesión</button>
          {fp.log.length === 0 && <button className="btn" onClick={() => act({ type: 'FP_SKIP' })}>Rechazar la invitación</button>}
        </div>
        <p aria-live="polite" className={last?.crashed ? 'bad' : ''}>{last ? `${PROGRAMS[last.program].label}${last.time ? ` · ${fmt(last.time)}` : ''}: ${last.note}` : ''}</p>
        {fp.runsLeft <= 0 && <p><strong>Se acabó la sesión.</strong> Pulsa «Terminar sesión» para ver tu nota.</p>}
      </div>
      <h2>Tiempos de las FP1</h2>
      <div className="card"><table className="data"><thead><tr><th>#</th><th>Piloto</th><th>Equipo</th><th>Mejor vuelta</th><th>Dif.</th></tr></thead><tbody>
        {table.rows.map((r, i) => (<tr key={r.id} className={r.mine ? 'sel' : ''}><td className="num">{i + 1}</td><td>{r.name}{r.mine && <> <Star /></>}</td><td className="muted">{r.team}</td><td className="num">{r.time ? fmt(r.time) : '—'}</td><td className="num">{r.time && lead && r.time !== lead ? `+${(r.time - lead).toFixed(3)}` : ''}</td></tr>))}
      </tbody></table>
        {table.regularTime && <p className="muted">Titular: {fp.replaces} marca {fmt(table.regularTime)}.</p>}</div>
      {fp.log.length > 0 && (<><h2>Tus tandas</h2><div className="card"><table className="data"><tbody>{fp.log.map((r, i) => (<tr key={i}><td className="num">{i + 1}</td><td>{PROGRAMS[r.program].label}</td><td className="muted">{r.program === 'aero' || r.program === 'tyres' ? '—' : TYRES[r.tyre as keyof typeof TYRES]}</td><td className="num">{r.time ? fmt(r.time) : '—'}</td><td className={r.crashed ? 'bad' : 'muted'}>{r.note}</td></tr>))}</tbody></table></div></>)}
    </>
  );
}
