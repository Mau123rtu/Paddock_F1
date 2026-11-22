import { useEffect, useMemo, useRef, useState } from 'react';
import { Ico } from '../components/Icon';
import { Pause, Play, FastForward, Volume2, VolumeX } from 'lucide-react';
import type { Category, Compound, GameState } from '../types';
import { gameStore } from '../hooks/useGame';
import { Rng } from '../systems/rng';
import { decideOrder, hierLabel, teamFavor } from '../systems/orders';
import type { OrderPlan } from '../systems/orders';
import { CAT_LABEL, PLAYER_ID } from '../systems/career';
import { LAPS, TYRE, buildField, defaultPlan, makeWeather, qualify, simulateRace } from '../systems/race';
import type { Decision, Mode, Participant, Plan, Trace } from '../systems/race';
import { getTrack } from '../data/circuits';
import { Practice, Qualifying } from './Sessions';
import type { Prog } from './Sessions';
import { crashSound, lightsOut, pitBeeps, radio, setEngine, setSound, soundOn, startEngine, startLight, stopEngine, unlock } from '../audio/sound';

const COMP: Record<Compound, string> = { S: 'Blando', M: 'Medio', H: 'Duro', W: 'Lluvia' };
const COMP_COLOR: Record<Compound, string> = { S: '#e8002d', M: '#f2c500', H: '#e9ebee', W: '#3fa7ff' };
const MODES: Record<Mode, string> = { push: 'Atacar', normal: 'Normal', save: 'Conservar' };
const fmt = (t: number) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(3).padStart(6, '0')}`; };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function progress(tr: Trace, T: number, laps: number): number {
  const n = tr.cum.length;
  if (T < tr.cum[0]) return (T - tr.cum[0]) / 90;
  let i = 0;
  while (i + 1 < n && tr.cum[i + 1] <= T) i++;
  if (i + 1 < n) return i + (T - tr.cum[i]) / (tr.cum[i + 1] - tr.cum[i]);
  return tr.out ? i + Math.min(0.4, (T - tr.cum[i]) / 90) : laps;
}

/** Semáforo de salida: pulsa justo cuando se apagan las luces. Adelantarte es salida en falso. */
function StartLights({ onDone }: { onDone: (delta: number) => void }) {
  const [phase, setPhase] = useState<'idle' | 'lights' | 'go' | 'done'>('idle');
  const [lit, setLit] = useState(0);
  const [res, setRes] = useState<{ delta: number; msg: string } | null>(null);
  const t0 = useRef(0), timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  const begin = () => {
    unlock(); setPhase('lights'); setLit(0);
    for (let i = 1; i <= 5; i++) timers.current.push(window.setTimeout(() => { setLit(i); startLight(i); }, i * 800));
    timers.current.push(window.setTimeout(() => { setLit(0); setPhase('go'); t0.current = performance.now(); lightsOut(); }, 5 * 800 + 500 + Math.random() * 1500));
  };
  const tap = () => {
    if (phase === 'lights') { timers.current.forEach((x) => window.clearTimeout(x)); setLit(0); setPhase('done'); setRes({ delta: 2.5, msg: 'Salida en falso: pierdes unos 2.5 s.' }); return; }
    if (phase !== 'go') return;
    const r = performance.now() - t0.current;
    setPhase('done');
    setRes({ delta: clamp(((r - 220) / 1000) * 2.2, -0.15, 1.2), msg: `Reacción: ${Math.round(r)} ms · ${r < 230 ? 'salida excelente' : r < 320 ? 'buena salida' : r < 450 ? 'salida normal' : 'salida lenta'}` });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2>Salida</h2>
      <div className="lights">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={`light ${i <= lit ? 'on' : ''} ${phase === 'go' ? 'go' : ''}`} />)}</div>
      {phase === 'idle' && (<><p className="muted">Las 5 luces se encienden una a una. Cuando se apaguen todas, pulsa el botón (o la barra espaciadora) lo más rápido posible. Si pulsas antes, es salida en falso.</p>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={begin}>Comenzar procedimiento de salida</button><button className="btn" onClick={() => onDone(0.25)}>Salida automática</button></div></>)}
      {(phase === 'lights' || phase === 'go') && <button className="btn primary bigtap" onPointerDown={tap}>¡YA!</button>}
      {phase === 'done' && res && (<><p><strong>{res.msg}</strong></p><button className="btn primary" onClick={() => onDone(res.delta)}>Empezar carrera</button></>)}
    </div>
  );
}

/** Parada en boxes: detén el marcador en la zona verde para un cambio rápido. */
function PitGame({ onDone, onCancel }: { onDone: (delta: number) => void; onCancel: () => void }) {
  const [pos, setPos] = useState(0);
  const [res, setRes] = useState<{ delta: number; msg: string } | null>(null);
  const dir = useRef(1);
  useEffect(() => {
    if (res) return;
    const id = window.setInterval(() => setPos((p) => { let n = p + dir.current * 2.4; if (n >= 100) { n = 100; dir.current = -1; } if (n <= 0) { n = 0; dir.current = 1; } return n; }), 16);
    return () => window.clearInterval(id);
  }, [res]);
  const hit = () => {
    pitBeeps();
    const d = Math.abs(pos - 50);
    setRes(d < 5 ? { delta: -1.5, msg: 'Parada perfecta: ganas 1.5 s.' } : d < 12 ? { delta: -0.5, msg: 'Parada rápida: ganas 0.5 s.' } : d < 25 ? { delta: 0.8, msg: 'Parada lenta: pierdes 0.8 s.' } : { delta: 2.5, msg: 'Problema con una rueda: pierdes 2.5 s.' });
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Parada en boxes">
      <div className="modal-box info">
        <h2>Parada en boxes</h2>
        <div className="pitbar"><i className="zone" /><i className="marker" style={{ left: `${pos}%` }} /></div>
        {!res ? (<><p className="muted">Pulsa en el momento en que el marcador pase por la zona verde.</p>
          <div className="row"><button className="btn primary bigtap" onPointerDown={hit}>¡CAMBIO!</button></div>
          <div className="row"><button className="btn" onClick={() => onDone(0)}>Parada automática</button><button className="btn" onClick={onCancel}>Cancelar</button></div></>)
          : (<><p><strong>{res.msg}</strong></p><div className="row"><button className="btn primary" onClick={() => onDone(res.delta)}>Confirmar parada</button></div></>)}
      </div>
    </div>
  );
}

export default function RaceWeekend({ game }: { game: GameState }) {
  const ev = game.calendar.find((e) => e.id === game.pendingRace);
  const evIdx = ev ? ev.cn : 0;
  const base = game.seed ^ (evIdx * 7919);
  const cat: Category = game.mode === 'driver' ? game.drivers.find((d) => d.id === PLAYER_ID)?.category ?? 'karting' : 'f1';
  const laps = LAPS[cat];
  const parts = useMemo(() => buildField(game, new Rng(base), evIdx), [game, base, evIdx]);
  const quali = useMemo(() => qualify(parts, new Rng(base + 1)), [parts, base]);
  const track = useMemo(() => getTrack(evIdx), [evIdx]);
  const weather = useMemo(() => makeWeather(new Rng(base + 4), laps), [base, laps]);
  const [plans, setPlans] = useState<Record<string, Plan>>(() => {
    const r = new Rng(base + 2);
    return Object.fromEntries(parts.map((p) => [p.id, defaultPlan(r, laps)]));
  });
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState<'fp' | 'q' | 'strategy' | 'start'>('fp');
  const [fpRuns, setFpRuns] = useState<Prog[]>([]);
  const [fpCrashes, setFpCrashes] = useState(0);
  const [orderSeen, setOrderSeen] = useState<number[]>([]);
  const [cards, setCards] = useState(0);
  const [orderMsg, setOrderMsg] = useState('');
  const [attackSeen, setAttackSeen] = useState<number[]>([]);
  const [ordersLog, setOrdersLog] = useState({ accepted: 0, rejected: 0 });
  const [pit, setPit] = useState<{ id: string; ef: number; compound: Compound } | null>(null);
  const [starts, setStarts] = useState<Record<string, number>>({});
  const [snd, setSnd] = useState(soundOn());
  const qWet = useMemo(() => new Rng(base + 9).next() < weather.chance / 140, [base, weather.chance]);
  const [qRes, setQRes] = useState<{ order: string[]; times: Record<string, number | null> } | null>(null);
  const gridIds = useMemo(() => (qRes ? qRes.order : quali.map((q) => q.id)), [qRes, quali]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pitC, setPitC] = useState<Record<string, Compound>>({});
  const [t, setT] = useState(0), [running, setRunning] = useState(true), [speed, setSpeed] = useState(30);
  const [sel, setSel] = useState(parts.find((p) => p.mine)?.id ?? parts[0]?.id ?? '');
  const tyreRuns = fpRuns.filter((r) => r === 'tyres').length, paceRuns = fpRuns.filter((r) => r === 'pace').length;
  /** Tu forma real cuenta: ánimo y fatiga cambian tu ritmo en carrera. */
  const formOf = (p: Participant) => {
    if (game.mode !== 'driver') return 0;
    const d = game.drivers.find((x) => x.id === p.id), mood = game.career.life.mood;
    return (mood >= 70 ? 1 : mood < 30 ? -2 : 0) - (d?.fatigue ?? 0) * 0.04;
  };
  const simParts = useMemo(() => parts.map((p) => (p.mine ? { ...p, tyreMgmt: Math.min(99, p.tyreMgmt + 5 * tyreRuns), driverRating: p.driverRating + Math.min(3, paceRuns) + formOf(p) } : p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, tyreRuns, paceRuns, game.career.life.mood, game.drivers]);
  const sim = useMemo(() => (started ? simulateRace(simParts, gridIds, plans, laps, base, weather, decisions, starts) : null),
    [started, simParts, gridIds, plans, laps, base, weather, decisions, starts]);

  const rows = sim ? sim.traces.map((tr) => ({ tr, pp: parts.find((x) => x.id === tr.id)!, p: progress(tr, t, laps) })).sort((a, b) => b.p - a.p) : [];
  const lead = rows.length ? rows[0].p : 0;
  const curLap = Math.min(laps, Math.floor(lead) + 1);
  const mineNames = parts.filter((p) => p.mine).map((p) => p.name);
  const alertCount = sim ? sim.events.filter((e) => e.lap <= curLap && (/Safety|Virtual|roja|llover|seca/.test(e.text) || mineNames.some((n) => e.text.includes(n)))).length : 0;
  const mineE = rows.filter((r) => r.pp.mine);
  const mateE = mineE.length === 1 && game.mode === 'driver' ? rows.filter((r) => r.pp.team === mineE[0].pp.team && !r.pp.mine).sort((a, b) => Math.abs(a.p - mineE[0].p) - Math.abs(b.p - mineE[0].p))[0] : undefined;
  const medLap = (tr: Trace, k: number) => { const a = tr.lapTimes.slice(Math.max(0, k - 6), k).filter((x) => x > 0).sort((x, y) => x - y); return a.length >= 3 ? a[Math.floor(a.length / 2)] : null; };
  const candLap = sim && mateE && mineE.length === 1 && !mineE[0].tr.out && !mateE.tr.out && cards < 3 ? [0.3, 0.42, 0.54, 0.66, 0.78].map((f) => Math.round(laps * f)).find((l) => curLap >= l && !orderSeen.includes(l)) : undefined;
  /** Las órdenes dependen de la situación real: cercanía, ritmo, jerarquía del equipo y qué hay que ganar. */
  const orderPlan: OrderPlan = (() => {
    if (candLap === undefined || !mateE || !mineE[0]) return { kind: 'none' };
    const me = mineE[0], meAhead = me.p > mateE.p, k = Math.floor(Math.min(me.p, mateE.p)), front = meAhead ? me : mateE, back = meAhead ? mateE : me;
    const lf = medLap(front.tr, k), lb = medLap(back.tr, k);
    if (lf === null || lb === null) return { kind: 'none' };
    const fi = rows.findIndex((r) => r.pp.id === front.pp.id), carAhead = fi > 0 ? rows[fi - 1] : undefined;
    return decideOrder({ favor: teamFavor(game, mateE.pp.name).favor, lapsLeft: laps - curLap, meAhead, gap: Math.abs(me.p - mateE.p) * lf, paceEdge: lf - lb, gapAheadOfFront: carAhead ? (carAhead.p - front.p) * lf : null, frontPos: fi + 1, mate: mateE.pp.name });
  })();
  const orderLap = candLap !== undefined && orderPlan.kind !== 'none' ? candLap : undefined;
  const m0 = mineE[0], i0 = m0 ? rows.findIndex((r) => r.pp.id === m0.pp.id) : -1, ahead = i0 > 0 ? rows[i0 - 1] : undefined;
  const gapAhead = ahead && m0 ? (ahead.p - m0.p) * 90 : 99;
  const attackLap = sim && m0 && !m0.tr.out && curLap >= 3 && curLap % 3 === 0 && gapAhead < 2.5 && !attackSeen.includes(curLap) ? curLap : undefined;
  const speedOf = (p: number, carPerf: number, out: boolean) => (out ? 0 : Math.round(clamp(335 - 210 * Math.pow(track.curv[Math.floor((((p % 1) + 1) % 1) * track.curv.length) % track.curv.length], 0.6), 80, 335) * (0.93 + (carPerf / 100) * 0.07)));
  const wearOf = (tr: Trace, pp: Participant, p: number) => {
    const li = clamp(Math.floor(p), 0, laps - 1), ty = tr.tyres[li] ?? tr.tyres[tr.tyres.length - 1] ?? 'M', age = tr.ages[li] ?? 0;
    return { ty, age, li, wear: Math.round(clamp(age * TYRE[ty].wear * (1 + (100 - pp.tyreMgmt) / 200), 0, 100)) };
  };
  const wetNow = !!sim && sim.weather.rainStart > 0 && curLap >= sim.weather.rainStart && curLap <= sim.weather.rainEnd;
  /** Dirección de carrera: avisa de lluvia, de neumáticos, de la Safety Car y de daños al lado de tus coches. */
  const advice: string[] = [];
  if (sim) {
    const w = sim.weather;
    if (w.rainStart > 0 && curLap < w.rainStart && curLap >= w.rainStart - 3) advice.push(`Radar: nubes sobre el circuito, lluvia prevista en ${w.rainStart - curLap} vuelta(s). Prepara neumáticos de lluvia.`);
    mineE.forEach((r) => {
      if (r.tr.out) return;
      const { ty, wear, li } = wearOf(r.tr, r.pp, r.p), dmg = r.tr.dmgs[li] ?? 0;
      if (wetNow && ty !== 'W') advice.push(`${r.pp.name}: pista mojada, tus neumáticos de seco pierden mucho. Entra a boxes por lluvia.`);
      else if (w.rainStart > 0 && curLap > w.rainEnd && ty === 'W') advice.push(`${r.pp.name}: la pista se seca, cambia a neumáticos de seco.`);
      else if (wear >= 70) advice.push(`${r.pp.name}: neumático al ${wear} %, planifica la parada.`);
      if (dmg > 0) advice.push(`${r.pp.name}: daños en el coche (+${dmg.toFixed(1)} s/vuelta). Valora parar o retirar.`);
    });
    if (sim.scLaps.includes(curLap)) advice.push('Safety Car en pista: parar ahora cuesta menos tiempo.');
    if (sim.vscLaps.includes(curLap)) advice.push('Virtual Safety Car: ritmo reducido, buena ventana para parar.');
  }
  const adviceKey = advice.join('|');
  const selRow = rows.find((r) => r.pp.id === sel) ?? rows[0];
  const kmhE = selRow ? speedOf(selRow.p, selRow.pp.carPerf, selRow.tr.out && t >= selRow.tr.cum[selRow.tr.cum.length - 1]) : 0;
  const finishedE = !!sim && t >= sim.total;

  const seen = useRef(0), crashed = useRef(false);
  useEffect(() => { if (alertCount > seen.current) setRunning(false); seen.current = alertCount; }, [alertCount]);
  useEffect(() => { if (orderLap !== undefined) setRunning(false); else if (candLap !== undefined) setOrderSeen((v) => (v.includes(candLap) ? v : [...v, candLap])); }, [orderLap, candLap]);
  useEffect(() => { if (attackLap !== undefined && orderLap === undefined) setRunning(false); }, [attackLap, orderLap]);
  useEffect(() => { if (adviceKey) radio(); }, [adviceKey]);
  useEffect(() => {
    const hit = !!sim && sim.events.some((e) => e.lap <= curLap && e.text.includes('accidente') && mineNames.some((n) => e.text.includes(n)));
    if (hit && !crashed.current) crashSound();
    crashed.current = hit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, curLap]);
  useEffect(() => {
    if (!sim || !running || finishedE || !snd || pit) { stopEngine(); return; }
    startEngine(); setEngine(kmhE / 335);
  }, [sim, running, finishedE, snd, kmhE, pit]);
  useEffect(() => () => stopEngine(), []);
  useEffect(() => {
    if (!sim || !running || pit) return;
    const id = setInterval(() => setT((x) => Math.min(sim.total + 3, x + speed * 0.1)), 100);
    return () => clearInterval(id);
  }, [sim, running, speed, pit]);

  if (!ev) return null;
  if (parts.length === 0) return <p className="muted">No hay parrilla para esta carrera.</p>;
  const setPlan = (id: string, patch: Partial<Plan>) => setPlans({ ...plans, [id]: { ...plans[id], ...patch } });
  const add = (d: Decision) => setDecisions((prev) => [...prev, d]);
  const title = `${ev.name} · ${track.name} · ${CAT_LABEL[cat]} · ${laps} vueltas · Pronóstico de lluvia: ${weather.chance} %`;
  if (!sim && stage === 'fp') return <Practice game={game} parts={parts} evIdx={evIdx} base={base} runs={fpRuns} setRuns={setFpRuns} crashes={fpCrashes} setCrashes={setFpCrashes} wet={qWet} title={title} onDone={() => setStage('q')} />;
  if (!sim && stage === 'q') return <Qualifying game={game} parts={parts} quali={quali} base={base} runs={fpRuns} damage={fpCrashes * 0.1} wet={qWet} title={title} onDone={(r) => { setQRes(r); setStage('strategy'); }} />;
  if (!sim && stage === 'start') {
    return (
      <>
        <p className="muted">{title}</p>
        <StartLights onDone={(delta) => {
          const r = new Rng(base + 66), second = new Rng(base + 55).next() * 0.2, mineIds = parts.filter((q) => q.mine).map((q) => q.id);
          setStarts(Object.fromEntries(parts.map((p) => [p.id, p.mine ? delta + (mineIds.indexOf(p.id) > 0 ? second : 0) : (r.next() - 0.5) * 0.3])));
          setStarted(true);
        }} />
      </>
    );
  }
  if (!sim) {
    return (
      <>
        <p className="muted">{title}</p>
        <h2>Parrilla de salida</h2>
        <div className="card"><table className="data"><tbody>
          {gridIds.map((id, i) => { const p = parts.find((x) => x.id === id)!; const tm = qRes ? qRes.times[id] : quali.find((x) => x.id === id)?.time; return (
            <tr key={id}><td className="num">{i + 1}</td><td><i className="dot" style={{ background: p.color }} /> {p.name}{p.mine && <> <Ico name="star" size={12} className="you" /></>}</td><td className="muted">{p.team}</td><td className="num">{tm ? fmt(tm) : 'sin tiempo'}</td></tr>); })}
        </tbody></table></div>
        <h2>Estrategia de carrera</h2>
        <div className="card"><p className="muted">Elige el neumático de salida, la vuelta de parada y el neumático siguiente. Durante la carrera podrás pausar y cambiar ritmo, parar en boxes (con minijuego), atacar en las oportunidades, dar o recibir órdenes y retirar un coche.</p>
          {parts.filter((p) => p.mine).map((p) => (
            <div className="row" key={p.id}><strong>{p.name}</strong>
              <select value={plans[p.id].start} onChange={(e) => setPlan(p.id, { start: e.target.value as Compound })}>{(['S', 'M', 'H', 'W'] as Compound[]).map((c) => <option key={c} value={c}>Sale con {COMP[c]}</option>)}</select>
              <label className="inline">Parada en vuelta <input className="mini" type="number" min={2} max={laps - 1} value={plans[p.id].stopLap} onChange={(e) => setPlan(p.id, { stopLap: clamp(Number(e.target.value), 2, laps - 1) })} /></label>
              <select value={plans[p.id].next} onChange={(e) => setPlan(p.id, { next: e.target.value as Compound })}>{(['S', 'M', 'H', 'W'] as Compound[]).map((c) => <option key={c} value={c}>Pasa a {COMP[c]}</option>)}</select>
            </div>))}
        </div>
        <button className="btn primary" onClick={() => setStage('start')}>Ir a la salida</button>
      </>
    );
  }

  const finished = finishedE;
  const at = (p: number) => { const f = ((p % 1) + 1) % 1; return track.pts[Math.floor(f * track.pts.length) % track.pts.length]; };
  const cur = selRow;
  const cw = wearOf(cur.tr, cur.pp, cur.p), tyre = cw.ty, wear = cw.wear;
  const out = cur.tr.out && t >= cur.tr.cum[cur.tr.cum.length - 1];
  const kmh = kmhE, gear = out ? 0 : clamp(Math.ceil(kmh / 42), 1, 8);
  const done = Math.max(0, Math.min(cur.tr.lapTimes.length, Math.floor(cur.p)));
  const lastLap = done > 0 ? cur.tr.lapTimes[done - 1] : 0;
  const dmg = cur.tr.dmgs[cw.li] ?? 0;
  const log = sim.events.filter((e) => e.lap <= curLap).slice(-7).reverse();
  const w = sim.traces.find((x) => x.id === sim.result[0].id)!;
  const flags = [sim.scLaps.includes(curLap) && 'SAFETY CAR', sim.vscLaps.includes(curLap) && 'VSC', sim.redLaps.includes(curLap - 1) && 'RELANZAMIENTO', wetNow && 'LLUVIA'].filter(Boolean).join(' · ');
  const modeOf = (id: string): Mode => { const m = [...decisions].reverse().find((d) => d.id === id && d.kind === 'mode'); return m && m.kind === 'mode' ? m.mode : 'normal'; };
  const holdOf = (team: string): boolean => { const o = [...decisions].reverse().find((d) => d.kind === 'orders' && parts.find((p) => p.id === d.id)?.team === team); return !!o && o.kind === 'orders' && o.hold; };
  const mineRows = rows.filter((r) => r.pp.mine);
  const wx = sim.weather.rainStart === 0 ? 'Seco' : wetNow ? 'Pista mojada' : curLap < sim.weather.rainStart ? 'Seco · lluvia en camino' : 'Secándose';

  return (
    <>
      <p className="muted">{ev.name} · {track.name} · Vuelta {curLap}/{laps} · {wx}{flags && ` · ${flags}`}</p>
      <div className="row">
        <button className="btn" onClick={() => setRunning(!running)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pausar' : 'Reanudar'}</button>
        {[10, 30, 60, 120].map((v) => <button key={v} className={`btn ${speed === v ? 'primary' : ''}`} onClick={() => setSpeed(v)}>x{v}</button>)}
        <button className="btn" onClick={() => setT(sim.total + 3)}><FastForward size={14} />Final</button>
        <button className="btn" aria-label="Sonido" onClick={() => { const v = !snd; setSnd(v); setSound(v); if (v) unlock(); }}>{snd ? <Volume2 size={14} /> : <VolumeX size={14} />}</button>
      </div>
      {advice.length > 0 && !finished && <div className="card advisor"><strong>Dirección de carrera</strong>{advice.slice(0, 3).map((a, i) => <p key={i}>{a}</p>)}</div>}
      {!finished && orderLap !== undefined && mateE && mineRows.length === 1 && orderPlan.kind !== 'none' && (() => {
        const me = mineRows[0], ef = Math.min(laps, Math.floor(me.p) + 2), plan = orderPlan, st = teamFavor(game, mateE.pp.name);
        const choice = plan.kind === 'swap-me' || plan.kind === 'hold-me';
        const done = (accepted: number, rejected: number) => { setOrderSeen([...orderSeen, orderLap]); setCards(cards + 1); setOrdersLog({ accepted: ordersLog.accepted + accepted, rejected: ordersLog.rejected + rejected }); setRunning(true); };
        const accept = () => { add(plan.kind === 'swap-me' ? { lap: ef, id: me.pp.id, kind: 'swap' } : { lap: ef, id: me.pp.id, kind: 'orders', hold: true }); setOrderMsg(''); done(1, 0); };
        const reject = () => { if (plan.kind === 'hold-me') add({ lap: ef, id: me.pp.id, kind: 'orders', hold: false }); setOrderMsg(''); done(0, 1); };
        const ack = () => {
          if (plan.kind === 'yield-mate') {
            if (Math.random() < plan.refuseP) setOrderMsg(`${mateE.pp.name} ignora la orden del equipo y no te deja pasar.`);
            else { add({ lap: ef, id: mateE.pp.id, kind: 'swap' }); setOrderMsg(`${mateE.pp.name} acata la orden y te cederá la posición.`); }
          } else { add({ lap: ef, id: me.pp.id, kind: 'orders', hold: true }); setOrderMsg(''); }
          done(0, 0);
        };
        return (<div className="card order"><strong>{choice ? 'Orden del equipo' : 'Mensaje del equipo'}</strong><p>{plan.text}</p>
          <p className="muted">{hierLabel(st.hier)} ({st.myPts} frente a {st.matePts} puntos esta temporada).{choice ? ' Obedecer mejora tu relación con el equipo; ignorar la orden la empeora.' : ''}</p>
          <div className="row">{choice ? <><button className="btn primary" onClick={accept}>Aceptar</button><button className="btn" onClick={reject}>Rechazar</button></> : <button className="btn primary" onClick={ack}>Entendido</button>}</div></div>);
      })()}
      {orderMsg && !finished && <p className="muted" aria-live="polite">{orderMsg}</p>}
      {!finished && attackLap !== undefined && orderLap === undefined && ahead && m0 && (
        <div className="card order"><strong>Oportunidad de adelantamiento</strong><p>Estás a {gapAhead.toFixed(1)} s de {ahead.pp.name}. ¿Atacas esta vuelta? (−0.6 s, pero el doble de riesgo de accidente)</p>
          <div className="row"><button className="btn primary" onClick={() => { add({ lap: Math.min(laps, Math.floor(m0.p) + 2), id: m0.pp.id, kind: 'attack' }); setAttackSeen([...attackSeen, attackLap]); setRunning(true); }}>¡Atacar!</button>
            <button className="btn" onClick={() => { setAttackSeen([...attackSeen, attackLap]); setRunning(true); }}>Esperar</button></div></div>
      )}
      {!finished && (
        <div className="card decisions"><strong>Decisiones</strong> <span className="muted">(se aplican desde la siguiente vuelta)</span>
          {mineRows.map((r) => {
            const ef = Math.floor(r.p) + 2, isOut = r.tr.out && t >= r.tr.cum[r.tr.cum.length - 1], can = ef <= laps && !isOut, id = r.pp.id, ww = wearOf(r.tr, r.pp, r.p);
            return (
              <div className="row" key={id}><strong>{r.pp.name}</strong><span className="chip" style={{ background: COMP_COLOR[ww.ty], color: '#111' }}>{ww.ty} {ww.wear}%</span>
                {(Object.keys(MODES) as Mode[]).map((m) => <button key={m} disabled={!can} className={`btn ${modeOf(id) === m ? 'primary' : ''}`} onClick={() => add({ lap: ef, id, kind: 'mode', mode: m })}>{MODES[m]}</button>)}
                <select value={pitC[id] ?? 'M'} onChange={(e) => setPitC({ ...pitC, [id]: e.target.value as Compound })}>{(['S', 'M', 'H', 'W'] as Compound[]).map((c) => <option key={c} value={c}>{COMP[c]}</option>)}</select>
                <button className="btn primary" disabled={!can} onClick={() => { unlock(); setPit({ id, ef, compound: pitC[id] ?? 'M' }); setRunning(false); }}>Boxes (V{ef})</button>
                <button className="btn" disabled={!can} onClick={() => add({ lap: ef, id, kind: 'retire' })}>Retirar</button>
              </div>);
          })}
          {mineRows.length === 2 && mineRows[0].pp.team === mineRows[1].pp.team && (
            <div className="row"><strong>Órdenes de equipo</strong>
              <button className={`btn ${holdOf(mineRows[0].pp.team) ? 'primary' : ''}`} onClick={() => add({ lap: Math.min(laps, curLap + 1), id: mineRows[0].pp.id, kind: 'orders', hold: true })}>Mantener posiciones</button>
              <button className={`btn ${!holdOf(mineRows[0].pp.team) ? 'primary' : ''}`} onClick={() => add({ lap: Math.min(laps, curLap + 1), id: mineRows[0].pp.id, kind: 'orders', hold: false })}>Dejar luchar</button>
            </div>)}
        </div>
      )}
      <div className="race">
        <svg viewBox="0 0 100 100" className="track" role="img" aria-label="Mapa del circuito">
          <path d={track.d} fill="none" stroke={wetNow ? '#27456b' : '#2e3545'} strokeWidth="5" strokeLinejoin="round" />
          <path d={track.d} fill="none" stroke="#9aa4b8" strokeWidth="0.4" strokeDasharray="1 1.4" />
          {rows.map((r) => { const [x, y] = at(r.p); return <circle key={r.pp.id} cx={x} cy={y} r={r.pp.mine ? 2.1 : 1.5} fill={r.pp.color} stroke={r.pp.mine ? '#fff' : 'none'} strokeWidth="0.6" opacity={r.tr.out && t >= r.tr.cum[r.tr.cum.length - 1] ? 0.35 : 1} />; })}
        </svg>
        <div className="boardwrap"><table className="data board"><tbody>
          {rows.map((r, i) => {
            const o = r.tr.out && t >= r.tr.cum[r.tr.cum.length - 1], ww = wearOf(r.tr, r.pp, r.p);
            const boxing = ww.li > 0 && ww.age === 1 && r.tr.tyres[ww.li - 1] !== r.tr.tyres[ww.li];
            return (<tr key={r.pp.id} className={r.pp.id === sel ? 'sel' : ''} onClick={() => setSel(r.pp.id)}>
              <td className="num">{i + 1}</td><td><i className="dot" style={{ background: r.pp.color }} /> {r.pp.name}{r.pp.mine && <> <Ico name="star" size={12} className="you" /></>}</td>
              <td>{o ? <span className="chip out">ABD</span> : <><span className="chip" style={{ background: COMP_COLOR[ww.ty], color: '#111' }}>{ww.ty}{ww.age}</span>{boxing && <span className="chip box">BOX</span>}</>}</td>
              <td className="num muted">{o ? '' : i === 0 ? 'Líder' : `+${((lead - r.p) * 90).toFixed(1)}s`}</td></tr>);
          })}
        </tbody></table></div>
      </div>
      <div className="card">
        <strong>Telemetría · {cur.pp.name}</strong> <span className="muted">(derivada del modelo: curvatura del trazado, ritmo y neumáticos)</span>
        <div className="telem">
          <div><span>Velocidad</span><b>{kmh} km/h</b></div><div><span>Marcha</span><b>{gear || '—'}</b></div>
          <div><span>RPM</span><b>{out ? 0 : Math.round(7500 + ((kmh % 42) / 42) * 4500)}</b></div>
          <div><span>Neumático</span><b style={{ color: COMP_COLOR[tyre] }}>{COMP[tyre]} · {wear}% desgaste</b></div>
          <div><span>Combustible</span><b>{Math.round(100 * (1 - Math.min(1, cur.p / laps)))}%</b></div>
          <div><span>Motor</span><b>{out ? '—' : `${Math.round(100 + (kmh / 335) * 18)} °C`}</b></div>
          <div><span>Daños</span><b>{dmg > 0 ? `+${dmg.toFixed(1)} s/vuelta` : 'Sin daños'}</b></div>
          <div><span>Última vuelta</span><b>{lastLap ? fmt(lastLap) : '—'}</b></div><div><span>Paradas</span><b>{cur.tr.stops}</b></div>
        </div>
      </div>
      <div className="card"><strong>Incidencias</strong>{log.length === 0 ? <p className="muted">Sin incidencias.</p> : <ul className="log">{log.map((e, i) => <li key={i}><span className="muted">V{e.lap}</span> {e.text}</li>)}</ul>}</div>
      {finished && (
        <>
          <h2>Resultado</h2>
          <div className="card"><table className="data"><thead><tr><th>Pos</th><th>Piloto</th><th>Equipo</th><th>Diferencia</th><th>Mejor vuelta</th><th>Paradas</th><th>Pts</th></tr></thead><tbody>
            {sim.result.map((e) => { const tr = sim.traces.find((x) => x.id === e.id)!; return (
              <tr key={e.id}><td className="num">{e.pos}</td><td>{e.name}{parts.find((p) => p.id === e.id)?.mine && <> <Ico name="star" size={12} className="you" /></>}</td><td className="muted">{e.team}</td>
                <td className="num">{e.status === 'dnf' ? 'ABANDONO' : e.pos === 1 ? fmt(tr.cum[laps]) : `+${(tr.cum[laps] - w.cum[laps]).toFixed(3)}`}</td>
                <td className="num">{e.best ? fmt(e.best) : '—'}</td><td className="num">{e.stops}</td><td className="num">{e.pts}</td></tr>); })}
          </tbody></table></div>
          <button className="btn primary" onClick={() => gameStore.dispatch({ type: 'FINISH_RACE', result: { id: `${game.season}-${ev.id}`, season: game.season, date: game.date, name: ev.name, category: cat, entries: sim.result, hold: mineRows.length === 2 && holdOf(mineRows[0].pp.team), pole: gridIds[0], orders: ordersLog, penalties: sim.events.filter((e) => e.text.startsWith('Sanción')).map((e) => e.text) } })}>Confirmar resultado</button>
        </>
      )}
      {pit && <PitGame onCancel={() => { setPit(null); setRunning(true); }} onDone={(delta) => { add({ lap: pit.ef, id: pit.id, kind: 'pit', compound: pit.compound, delta }); setPit(null); setRunning(true); }} />}
    </>
  );
}
