import { useState } from 'react';
import type { GameState, NewsItem } from '../types';

const tagOf = (n: NewsItem): string =>
  /retirada|se retira/i.test(n.headline) ? 'Retiro' : /sanci[óo]n|penaliz/i.test(n.headline) ? 'Sanción'
  : n.category === 'transfer' ? 'Fichajes' : n.category === 'race' ? 'Carrera' : 'Actualidad';

/** Panel de noticias a la derecha: titular del día y últimas noticias. Se pliega y se despliega. */
export default function Headlines({ game, go }: { game: GameState; go: (id: string) => void }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1500);
  const news = game.news.filter((n) => !/^Hoy:/.test(n.headline));
  const top = news.find((n) => n.important) ?? news[0];
  const rest = news.filter((n) => n !== top).slice(0, 6);
  return (
    <aside className={`newsdock ${open ? 'open' : ''}`} aria-label="Noticias">
      <button className="dock-tab" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Cerrar ›' : '‹ Noticias'}</button>
      {open && (
        <div className="dock-body">
          {top ? (
            <article className="dock-top">
              <span className="eyebrow">Titular del día · {top.date}</span>
              <strong>{top.headline}</strong>
              <p className="muted">{top.body}</p>
            </article>
          ) : <p className="muted">Sin noticias todavía.</p>}
          {rest.length > 0 && <ul>
            {rest.map((n) => (
              <li key={n.id}><span className="dock-tag">{tagOf(n)}</span><strong>{n.headline}</strong><time className="muted">{n.date}</time></li>
            ))}
          </ul>}
          <button className="btn" onClick={() => go('news')}>Ver todas</button>
        </div>
      )}
    </aside>
  );
}
