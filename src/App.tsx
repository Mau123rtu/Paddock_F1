import { useState } from 'react';
import { useGame } from './hooks/useGame';
import MainMenu from './pages/MainMenu';
import NewGame from './pages/NewGame';
import Dashboard from './pages/Dashboard';
import Balance from './pages/Balance';

export default function App() {
  const game = useGame();
  const [screen, setScreen] = useState<'menu' | 'new' | 'lab'>('menu');
  if (game) return <Dashboard game={game} onExit={() => { import('./hooks/useGame').then((m) => m.gameStore.set(null)); setScreen('menu'); }} />;
  if (screen === 'lab') return <Balance onBack={() => setScreen('menu')} />;
  return screen === 'new' ? <NewGame onBack={() => setScreen('menu')} /> : <MainMenu onNew={() => setScreen('new')} onLab={() => setScreen('lab')} />;
}
