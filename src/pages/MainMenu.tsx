import { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import type { GameState } from '../types';
import { deleteGame, listGames, loadGame } from '../services/storage/saves';
import { gameStore } from '../hooks/useGame';

export default function MainMenu({ onNew, onLab }: { onNew: () => void; onLab: () => void }) {
  const [saves, setSaves] = useState<GameState[]>([]);
  const refresh = () => listGames().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { refresh(); }, []);
  return (
    <main className="menu">
      <h1>Paddock</h1>
      <p className="muted">Simulador de carrera: del kart a la parrilla, o desde el muro de boxes.</p>
      <div className="row"><button className="btn primary" onClick={onNew}>Nueva partida</button><button className="btn" onClick={onLab}>Laboratorio de equilibrio</button></div>
      <h2>Partidas guardadas</h2>
      {saves.length === 0 && <p className="muted">No hay partidas. Crea una para empezar.</p>}
      <ul className="saves">
        {saves.map((s) => (
          <li key={s.id}>
            <span>{s.label}</span>
            <span className="muted">{s.mode === 'driver' ? 'Piloto' : 'Jefe de equipo (próximamente)'} · {s.date}</span>
            <button className="icon" aria-label={s.mode === 'driver' ? 'Continuar' : 'Próximamente'} title={s.mode === 'driver' ? undefined : 'Modo jefe de equipo: próximamente'} disabled={s.mode !== 'driver'} onClick={async () => { const g = await loadGame(s.id); if (g) gameStore.set(g); }}><Play size={16} /></button>
            <button className="icon" aria-label="Eliminar" onClick={async () => { await deleteGame(s.id); refresh(); }}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </main>
  );
}
