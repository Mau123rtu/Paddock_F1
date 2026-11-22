import { Ico } from './Icon';
export interface Series { name: string; color: string; values: (number | null)[]; dashed?: boolean }

/** Gráfica de líneas SVG. `invert` pone los valores bajos arriba (para posiciones de carrera). */
export function LineChart({ labels, series, height = 190, invert = false, label }: { labels: string[]; series: Series[]; height?: number; invert?: boolean; label: string }) {
  const W = 620, L = 34, R = 10, T = 10, B = 26, H = height;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0 || labels.length === 0) return <p className="muted">Sin datos suficientes.</p>;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (invert) { lo = Math.min(1, lo); } else lo = Math.min(0, lo);
  if (hi === lo) hi = lo + 1;
  const x = (i: number) => L + (labels.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1));
  const y = (v: number) => { const t = (v - lo) / (hi - lo); return invert ? T + t * (H - T - B) : H - B - t * (H - T - B); };
  const ticks = [lo, lo + (hi - lo) / 2, hi].map((v) => Math.round(v));
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="tick">{t}</text></g>))}
        {labels.map((l, i) => (labels.length <= 10 || i % 2 === 0) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="tick">{l.slice(0, 8)}</text>)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const d = pts.reduce((a, p, i) => (p ? `${a}${a && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : a), '');
          return (<g key={s.name}><path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round" className="draw" />
            {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.2} fill={s.color} />)}</g>);
        })}
      </svg>
      <figcaption>{series.map((s) => <span key={s.name} className="legend"><i style={{ background: s.color }} />{s.name}</span>)}</figcaption>
    </figure>
  );
}

/** Barras horizontales; la barra marcada (`hi`) es la tuya. */
export function BarList({ items, unit = '' }: { items: { label: string; value: number; hi?: boolean }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className={`barrow ${i.hi ? 'me' : ''}`} key={i.label}>
          <span className="bl">{i.label}{i.hi && <> <Ico name="star" size={12} className="you" /></>}</span>
          <div className="bt"><i style={{ width: `${(i.value / max) * 100}%` }} /></div>
          <b className="num">{i.value}{unit}</b>
        </div>
      ))}
    </div>
  );
}
