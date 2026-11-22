import { useMemo, useState } from 'react';
import { Ico } from '../components/Icon';
import type { Compound, GameState } from '../types';
import { gameStore } from '../hooks/useGame';
import { Rng } from '../systems/rng';
import { idealSetup, setupBonus } from '../systems/extras';
import { PLAYER_ID } from '../systems/career';
import { practiceTime, qualiAttempt } from '../systems/race';
import type { Participant, QMode } from '../systems/race';

export type Prog = 'pace' | 'tyres' | 'setup' | 'quali';
export const MAX_RUNS = 5;
const PROGS: Record<Prog, { label: string; desc: string }> = {
  pace: { label: 'Ritmo de carrera', desc: '+1 al ritmo en carrera por tanda (máx. +3).' },
  tyres: { label: 'Gestión de neumáticos', desc: 'Menos desgaste en carrera: +5 de gestión por tanda (máx. +15).' },
  setup: { label: 'Ajuste del coche', desc: 'Te dice cómo se siente el coche con tu ajuste; más tandas, menos error.' },
  quali: { label: 'Simulación de clasificación', desc: 'Más confianza a una vuelta: -0.06 s por tanda en clasificación.' },
};
const fmt = (t: number) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(3).padStart(6, '0')}`; };
const COMP: Record<Compound, string> = { S: 'Blando', M: 'Medio', H: 'Duro', W: 'Lluvia' };
const MODES: Record<QMode, string> = { normal: 'Segura', push: 'Atacar', risk: 'Arriesgar' };

export function Practice({ game, parts, evIdx, base, runs, setRuns, crashes, setCrashes, wet, title, onDone }: {
  game: GameState; parts: Participant[]; evIdx: number; base: number; runs: Prog[]; setRuns: (r: Prog[]) => void;
  crashes: number; setCrashes: (n: number) => void; wet: boolean; title: string; onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const driver = game.mode === 'driver';
  const setupRuns = runs.filter((r) => r === 'setup').length, left = MAX_RUNS - runs.length - crashes;
  const exp = game.drivers.find((d) => d.id === PLAYER_ID)?.stats.experience ?? 50;
  const focus = parts.find((p) => p.mine)?.focus ?? 60;
  const bonus = setupBonus(game.career.setup, idealSetup(evIdx));
  const feel = bonus + ((new Rng(base + 77 + setupRuns).next() - 0.5) * ((2 * (100 - exp)) / 60)) / (1 + setupRuns);
  const feelLabel = setupRuns === 0 ? 'Sin datos: haz una tanda de "Ajuste del coche"' : feel >= 1.2 ? 'El coche va muy bien' : feel >= 0.4 ? 'El coche va bien' : feel >= -0.6 ? 'El coche va regular' : 'El coche va mal';
  const times = useMemo(() => parts.map((p) => ({ p, t: practiceTime(p, base, runs.length) })).sort((a, b) => a.t - b.t), [parts, base, runs.length]);
  /** Cada salida a pista tiene riesgo de error: con poca concentración o lluvia puedes irte largo, perder la tanda y dañar el coche. */
  const go = (k: Prog) => {
    const risk = 0.04 * (1 + (100 - focus) / 100) * (k === 'setup' ? 0.5 : 1) * (wet ? 2 : 1);
    if (new Rng(base + 900 + runs.length + crashes).next() < risk) { setCrashes(crashes + 1); setNote('Salida de pista: pierdes la tanda y el coche queda dañado (+0.1 s en clasificación).'); }
    else { setRuns([...runs, k]); setNote(''); }
  };
  return (
    <>
      <p className="muted">{title}</p>
      <h2>Prácticas libres · {Math.min(MAX_RUNS, runs.length + crashes)}/{MAX_RUNS} tandas</h2>
      <div className="card">
        <p className="muted">Tienes {left} tanda(s). La clasificación será con pista <strong>{wet ? 'mojada' : 'seca'}</strong> (pronóstico). Cada salida tiene riesgo de accidente, mayor con poca concentración o lluvia.</p>
        {crashes > 0 && <p>Accidentes en prácticas: {crashes} (coche dañado: +{(crashes * 0.1).toFixed(1)} s en clasificación)</p>}
        {note && <p><strong>{note}</strong></p>}
        {(Object.keys(PROGS) as Prog[]).filter((k) => driver || k !== 'setup').map((k) => (
          <div className="row todo" key={k}><span style={{ flex: 1 }}><strong>{PROGS[k].label}</strong> <span className="muted">{PROGS[k].desc}</span> {runs.filter((r) => r === k).length > 0 && <b>×{runs.filter((r) => r === k).length}</b>}</span>
            <button className="btn" disabled={left <= 0} onClick={() => go(k)}>Salir a pista</button></div>))}
      </div>
      {driver && (
        <div className="card"><strong>Ajuste del monoplaza</strong> <span className="muted">· {feelLabel}</span>
          {(['aero', 'suspension', 'brakes'] as const).map((k) => (
            <div className="meter" key={k}><span>{{ aero: 'Aerodinámica', suspension: 'Suspensión', brakes: 'Frenos' }[k]}</span>
              <input type="range" min={0} max={100} value={game.career.setup[k]} onChange={(e) => gameStore.dispatch({ type: 'SET_SETUP', setup: { ...game.career.setup, [k]: Number(e.target.value) } })} style={{ flex: 1 }} /><b className="num">{game.career.setup[k]}</b></div>))}
          <p className="muted">Mueve un control y repite la tanda de ajuste para notar la diferencia.</p></div>
      )}
      <h2>Tiempos de prácticas</h2>
      <div className="card"><table className="data"><tbody>
        {times.map(({ p, t }, i) => (<tr key={p.id} className={p.mine ? 'sel' : ''}><td className="num">{i + 1}</td><td><i className="dot" style={{ background: p.color }} /> {p.name}{p.mine && <> <Ico name="star" size={12} className="you" /></>}</td><td className="muted">{p.team}</td><td className="num">{fmt(t)}</td></tr>))}
      </tbody></table></div>
      <div className="row"><button className="btn primary" onClick={onDone}>Terminar prácticas e ir a clasificación</button></div>
    </>
  );
}

/** Clasificación por eliminación: Q1 (caen ~27 %), Q2 (caen ~27 %) y Q3. Dos vueltas lanzadas por sesión; en mojado solo funciona el neumático de lluvia. */
export function Qualifying({ game, parts, quali, base, runs, damage, wet, title, onDone }: {
  game: GameState; parts: Participant[]; quali: { id: string; time: number }[]; base: number; runs: Prog[]; damage: number; wet: boolean; title: string;
  onDone: (r: { order: string[]; times: Record<string, number | null> }) => void;
}) {
  const mine = parts.filter((p) => p.mine), qRuns = runs.filter((r) => r === 'quali').length;
  const [session, setSession] = useState(0), [run, setRun] = useState(0);
  const [att, setAtt] = useState<Record<string, (number | null)[]>>({});
  const [alive, setAlive] = useState<string[]>(() => parts.map((p) => p.id));
  const [fin, setFin] = useState<Record<string, { s: number; t: number | null }>>({});
  const [set, setSet] = useState<Record<string, { tyre: Compound; mode: QMode }>>({});
  const truth = (id: string) => quali.find((q) => q.id === id)?.time ?? 99;
  const u = (id: string) => ((id.length * 37 + id.charCodeAt(id.length - 1)) % 10) / 10;
  const aiTime = (id: string, s: number) => truth(id) + (wet ? 6 + u(id) * 0.4 : 0) - 0.08 * s + (u(id) - 0.5) * 0.12 * (s + 1);
  const best = (id: string) => { const a = (att[id] ?? []).filter((x): x is number => x !== null); return a.length ? Math.min(...a) : null; };
  const timeNow = (p: Participant): number | null => (p.mine ? best(p.id) : run === 0 ? null : aiTime(p.id, session) + (run < 2 ? (2 - run) * 0.1 : 0));
  const alivePs = parts.filter((p) => alive.includes(p.id));
  const ranked = [...alivePs].sort((a, b) => (timeNow(a) ?? 999) - (timeNow(b) ?? 999));
  const cut = session < 2 ? Math.max(1, Math.round(alivePs.length * 0.27)) : 0;
  const aliveMine = mine.filter((p) => alive.includes(p.id));
  const cfg = (id: string) => set[id] ?? { tyre: (wet ? 'W' : 'S') as Compound, mode: 'push' as QMode };
  const finish = (nf: Record<string, { s: number; t: number | null }>) => {
    const grp = (s: number) => Object.entries(nf).filter(([, v]) => v.s === s).sort((a, b) => (a[1].t ?? 999) - (b[1].t ?? 999));
    onDone({ order: [2, 1, 0].flatMap((s) => grp(s).map(([id]) => id)), times: Object.fromEntries(Object.entries(nf).map(([id, v]) => [id, v.t])) });
  };
  const go = () => {
    const n = { ...att };
    aliveMine.forEach((p) => {
      const c = cfg(p.id), fat = game.drivers.find((d) => d.id === p.id)?.fatigue ?? 0;
      n[p.id] = [...(n[p.id] ?? []), qualiAttempt(p, c.tyre, c.mode, base + 500 + session * 977 + run * 131, qRuns, fat, wet, damage)];
    });
    setAtt(n); setRun(run + 1);
  };
  const closeSession = () => {
    const nf = { ...fin };
    const out = session < 2 ? ranked.slice(ranked.length - cut) : ranked;
    out.forEach((p) => { nf[p.id] = { s: session, t: timeNow(p) }; });
    if (session === 2) { finish(nf); return; }
    setFin(nf); setAlive(alive.filter((id) => !out.some((o) => o.id === id))); setSession(session + 1); setRun(0); setAtt({});
  };
  const settleRest = () => {
    let al = [...alive];
    const nf = { ...fin };
    for (let s = session; s <= 2; s++) {
      const rk = parts.filter((p) => al.includes(p.id)).sort((a, b) => aiTime(a.id, s) - aiTime(b.id, s));
      const outs = s < 2 ? rk.slice(rk.length - Math.max(1, Math.round(rk.length * 0.27))) : rk;
      outs.forEach((p) => { nf[p.id] = { s, t: aiTime(p.id, s) }; });
      al = al.filter((id) => !outs.some((o) => o.id === id));
    }
    finish(nf);
  };
  const skip = () => onDone({ order: quali.map((q) => q.id), times: Object.fromEntries(quali.map((q) => [q.id, q.time + (wet ? 6 : 0)])) });
  const eliminatedMine = mine.filter((p) => !alive.includes(p.id));
  return (
    <>
      <p className="muted">{title}</p>
      <h2>Clasificación · Q{session + 1} · tanda {Math.min(run + 1, 2)}/2 · pista {wet ? 'mojada' : 'seca'}</h2>
      <div className="card">
        <p className="muted">Caen {session < 2 ? `los ${cut} más lentos de Q${session + 1}` : 'ninguno: Q3 define la pole'}. {wet ? 'Con lluvia, solo el neumático de lluvia funciona y los errores son mucho más probables. ' : 'Blando es más rápido; atacar o arriesgar ganan tiempo pero pueden anularte la vuelta. '}
          {qRuns > 0 && `Tu simulación de clasificación te da -${(qRuns * 0.06).toFixed(2)} s. `}{damage > 0 && `Coche dañado: +${damage.toFixed(1)} s.`}</p>
        {aliveMine.map((p) => (
          <div className="row todo" key={p.id}><strong style={{ minWidth: '8rem' }}>{p.name}</strong>
            <select disabled={run >= 2} value={cfg(p.id).tyre} onChange={(e) => setSet({ ...set, [p.id]: { ...cfg(p.id), tyre: e.target.value as Compound } })}>{(['S', 'M', 'H', 'W'] as Compound[]).map((c) => <option key={c} value={c}>{COMP[c]}</option>)}</select>
            <select disabled={run >= 2} value={cfg(p.id).mode} onChange={(e) => setSet({ ...set, [p.id]: { ...cfg(p.id), mode: e.target.value as QMode } })}>{(Object.keys(MODES) as QMode[]).map((m) => <option key={m} value={m}>{MODES[m]}</option>)}</select>
            <span className="muted">{(att[p.id] ?? []).map((t) => (t === null ? 'anulada' : fmt(t))).join(' · ')}</span></div>))}
        {eliminatedMine.map((p) => <p key={p.id} className="muted">{p.name}: eliminado en Q{(fin[p.id]?.s ?? 0) + 1}.</p>)}
        <div className="row">
          {aliveMine.length > 0 && run < 2 && <button className="btn primary" onClick={go}>Salir a pista (Q{session + 1}, tanda {run + 1}/2)</button>}
          {aliveMine.length > 0 && run >= 2 && <button className="btn primary" onClick={closeSession}>{session < 2 ? `Cerrar Q${session + 1}` : 'Ver parrilla y preparar la carrera'}</button>}
          {aliveMine.length === 0 && <button className="btn primary" onClick={settleRest}>Simular el resto de la sesión y ver la parrilla</button>}
          <button className="btn" onClick={skip}>Saltar (resultado automático)</button>
        </div>
      </div>
      <div className="card"><table className="data"><tbody>
        {ranked.map((p, i) => { const t = timeNow(p), lead = timeNow(ranked[0]), out = run >= 2 && session < 2 && i >= ranked.length - cut;
          return (<tr key={p.id} className={p.mine ? 'sel' : ''}><td className="num">{i + 1}</td><td><i className="dot" style={{ background: p.color }} /> {p.name}{p.mine && <> <Ico name="star" size={12} className="you" /></>}</td><td className="muted">{p.team}{out && ' · eliminado'}</td>
            <td className="num">{t === null ? (p.mine && run > 0 ? 'sin tiempo' : '—') : i === 0 ? fmt(t) : `+${(t - (lead ?? t)).toFixed(3)}`}</td></tr>); })}
      </tbody></table></div>
    </>
  );
}
