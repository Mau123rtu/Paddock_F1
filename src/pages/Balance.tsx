import { useState } from 'react';
import type { Category, Difficulty } from '../types';
import { runBalance } from '../systems/balance';
import type { BotRun } from '../systems/balance';
import { CAT_LABEL, CATEGORIES } from '../systems/career';

const DIFFS: Record<Difficulty, string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', realistic: 'Realista' };

/** Laboratorio: pilotos robot juegan 12 temporadas para ver cómo de fácil o difícil llegar a F1 con cada dificultad. */
export default function Balance({ onBack }: { onBack: () => void }) {
  const [diff, setDiff] = useState<Difficulty>('normal'), [n, setN] = useState(6);
  const [runs, setRuns] = useState<BotRun[] | null>(null), [prog, setProg] = useState(0), [busy, setBusy] = useState(false);
  const start = async () => { setBusy(true); setRuns(null); setProg(0); setRuns(await runBalance(n, 12, diff, setProg)); setBusy(false); };
  const pct = (v: number) => `${Math.round((v / (runs?.length || 1)) * 100)} %`;
  const reached = (c: Category) => (runs ?? []).filter((r) => r.reached[c] !== undefined);
  return (
    <main className="form">
      <button className="btn" onClick={onBack}>Volver</button>
      <h1>Laboratorio de equilibrio</h1>
      <p className="muted">Pilotos robot (nivel inicial medio, empiezan a los 13 años en México) juegan 12 temporadas: entrenan, aceptan la mejor oferta y no usan academias ni patrocinadores. Sirve para ver tendencias, no para medir a un jugador real.</p>
      <div className="grid2">
        <label>Dificultad<select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}>{Object.entries(DIFFS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Carreras a simular<select value={n} onChange={(e) => setN(Number(e.target.value))}>{[4, 6, 10, 20].map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <button className="btn primary" disabled={busy} onClick={start}>{busy ? `Simulando… ${prog}/${n}` : 'Simular'}</button>
      {runs && (
        <div className="card"><table className="data"><thead><tr><th>Categoría</th><th>La alcanzan</th><th>Edad media al llegar</th><th>Terminan ahí</th></tr></thead><tbody>
          {CATEGORIES.map((c) => { const r = reached(c), ages = r.map((x) => x.reached[c] ?? 0); return (
            <tr key={c}><td>{CAT_LABEL[c]}</td><td className="num">{pct(r.length)}</td><td className="num">{ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—'}</td><td className="num">{pct(runs.filter((x) => x.final === c).length)}</td></tr>); })}
        </tbody></table>
          <p className="muted">Despidos por carrera: {(runs.reduce((a, r) => a + r.fired, 0) / runs.length).toFixed(1)} · Entran en una academia: {pct(runs.filter((r) => r.academy).length)}</p></div>
      )}
    </main>
  );
}
