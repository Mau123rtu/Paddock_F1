import { useMemo, useState } from 'react';
import type { Category, GameState, NewsItem } from '../types';
import { currentEra } from '../systems/legacy';
import { inferMeta } from '../systems/newsMeta';
import { Ico } from '../components/Icon';

type Tab = 'all' | 'important' | 'mine' | Category;
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'important', label: 'Importantes' }, { id: 'mine', label: 'Mi carrera' },
  { id: 'f1', label: 'F1' }, { id: 'f2', label: 'F2' }, { id: 'f3', label: 'F3' }, { id: 'f4', label: 'F4' }, { id: 'karting', label: 'Karting' },
];
const SHORT: Record<Category, string> = { f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', karting: 'Karting' };
const KIND: Record<NewsItem['category'], { icon: string; label: string }> = {
  race: { icon: 'flag', label: 'Carrera' }, transfer: { icon: 'handshake', label: 'Fichajes' }, finance: { icon: 'banknote', label: 'Dinero' }, system: { icon: 'megaphone', label: 'Actualidad' },
};
const TAGLINE: Partial<Record<Tab, string>> = {
  important: 'Lo que mueve el campeonato.', mine: 'Lo que se cuece a tu alrededor.', f1: 'El paddock de la F1, sin filtro.', f2: 'Los que llaman a la puerta de la F1.',
  f3: 'La cantera aprieta.', f4: 'Primeros pasos en monoplaza.', karting: 'Donde empieza todo.',
};
const PAGE = 30;

export default function NewsPage({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('all');
  const [shown, setShown] = useState(PAGE);
  const items = useMemo(() => game.news.map((n) => {
    const m = n.series !== undefined ? { series: n.series, important: !!n.important } : inferMeta(game, n);
    return { n, series: m.series, important: m.important, mine: n.involved.includes(game.player.name) };
  }), [game.news, game.player.name]);
  const inTab = (it: (typeof items)[number], t: Tab) =>
    t === 'all' ? true : t === 'important' ? it.important : t === 'mine' ? it.mine : it.series.includes(t) || it.important;
  const counts = Object.fromEntries(TABS.map((t) => [t.id, items.filter((it) => inTab(it, t.id)).length])) as Record<Tab, number>;
  const list = items.filter((it) => inTab(it, tab)), hero = items.find((it) => it.important);
  const era = currentEra(game.legacy), next = game.legacy.nextRegs;
  return (
    <>
      <div className="card regs">
        <div><span className="muted">Reglamento de la F1</span><strong>{era.name}</strong><small className="muted">Desde {era.start}</small></div>
        <div><span className="muted">Próximo cambio</span><strong>{next ? `${next.name} (${next.start})` : '—'}</strong>
          <small className="muted">{next ? (next.start === game.season + 1 && next.announced ? 'Aprobado por la FIA' : next.kind === 'major' ? 'Cambio grande: la parrilla puede saltar por los aires' : 'Ajuste menor') : ''}</small></div>
      </div>
      {hero && (
        <article className="hero" aria-label="Titular destacado">
          <span className="eyebrow"><Ico name="star" size={13} /> Titular del día · {hero.n.date}</span>
          <h2>{hero.n.headline}</h2><p>{hero.n.body}</p>
        </article>
      )}
      <div className="tabs newstabs" role="tablist" aria-label="Sección de noticias">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn ${tab === t.id ? 'primary' : ''}`} onClick={() => { setTab(t.id); setShown(PAGE); }}>
            {t.label} <span className="count">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      {TAGLINE[tab] && <p className="muted tagline">{TAGLINE[tab]}</p>}
      {list.length === 0 ? <p className="muted">Nada por aquí de momento.</p> : (
        <ul className="newslist">
          {list.slice(0, shown).map(({ n, series, important, mine }) => (
            <li key={n.id} className={`ncard ${important ? 'imp' : ''} ${mine ? 'mine' : ''} s-${series[0] ?? 'gen'}`}>
              <div className="nmeta">
                <span className="nk" title={KIND[n.category].label}><Ico name={KIND[n.category].icon} size={14} />{KIND[n.category].label}</span>
                {series.length === 0 ? <span className="chip">General</span> : series.slice(0, 2).map((c) => <span key={c} className={`chip ser s-${c}`}>{SHORT[c]}</span>)}
                {important && <span className="chip star" title="Se ve en todas las secciones"><Ico name="star" size={11} /> Importante</span>}
                {mine && <span className="chip you">Tú</span>}
                <time>{n.date}</time>
              </div>
              <strong>{n.headline}</strong>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      {list.length > shown && <div className="row"><button className="btn" onClick={() => setShown(shown + PAGE)}>Mostrar más ({list.length - shown})</button></div>}
    </>
  );
}
