import { useState } from 'react';
import { STAT_KEYS, STAT_LABELS } from '../types';
import type { Difficulty, Mode, NewGameSetup, Personality, Principal, Stats } from '../types';
import { createGame } from '../services/gameEngine';
import { saveGame } from '../services/storage/saves';
import { gameStore } from '../hooks/useGame';
import { NATIONALITIES, TEAMS } from '../data/world';
import { acceptance } from '../systems/fia';

const BASE = 40, MAX = 70, POINTS = 40;
const PERSONALITIES: Record<Personality, string> = { humble: 'Humilde', egocentric: 'Egocéntrico', competitive: 'Competitivo', professional: 'Profesional', charismatic: 'Carismático', reserved: 'Reservado' };
const DIFFS: Record<Difficulty, string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', realistic: 'Realista' };
const PROFILE: Record<keyof Principal, string> = { experience: 'Experiencia', reputation: 'Reputación', management: 'Capacidad de gestión', technical: 'Conocimientos técnicos' };
const baseStats = () => Object.fromEntries(STAT_KEYS.map((k) => [k, BASE])) as Stats;

export default function NewGame({ onBack }: { onBack: () => void }) {
  const [f, setF] = useState<NewGameSetup>({
    mode: 'driver', firstName: '', lastName: '', nationality: NATIONALITIES[0], age: 15, season: 2026, difficulty: 'normal', personality: 'professional',
    stats: baseStats(), teamId: TEAMS[TEAMS.length - 1].id, teamMode: 'existing', profile: { experience: 30, reputation: 30, management: 30, technical: 30 },
    newTeam: { name: '', color: '#e8002d', philosophy: 'Técnica', logo: '◆', budget: 90 },
  });
  const set = <K extends keyof NewGameSetup>(k: K, v: NewGameSetup[K]) => setF((p) => ({ ...p, [k]: v }));
  const setMode = (m: Mode) => setF((p) => ({ ...p, mode: m, age: m === 'driver' ? 15 : 38 }));
  const left = POINTS - STAT_KEYS.reduce((a, k) => a + f.stats[k] - BASE, 0);
  const pLeft = 40 - (Object.values(f.profile) as number[]).reduce((a, v) => a + v - 30, 0);
  const bump = (k: (typeof STAT_KEYS)[number], d: number) => { const v = f.stats[k] + d; if (v >= BASE && v <= MAX && !(d > 0 && left <= 0)) set('stats', { ...f.stats, [k]: v }); };
  const bumpP = (k: keyof Principal, d: number) => { const v = f.profile[k] + d; if (v >= 30 && v <= 70 && !(d > 0 && pLeft <= 0)) set('profile', { ...f.profile, [k]: v }); };
  const team = TEAMS.find((t) => t.id === f.teamId) ?? TEAMS[0];
  const acc = acceptance(team, f.profile, f.difficulty);
  const named = f.firstName.trim() !== '' && f.lastName.trim() !== '';
  const valid = named && (f.mode === 'driver' || (f.teamMode === 'new' ? f.newTeam.name.trim() !== '' : acc.ok));
  const start = async () => { const g = createGame(f); await saveGame(g); gameStore.set(g); };
  const nt = f.newTeam;
  return (
    <main className="form">
      <button className="btn" onClick={onBack}>Volver</button>
      <h1>Nueva partida</h1>
      <div className="seg" role="radiogroup" aria-label="Modo">
        <button className={f.mode === 'driver' ? 'on' : ''} onClick={() => setMode('driver')}>Piloto</button>
        <button className="soon" disabled aria-disabled="true" title="Próximamente">Jefe de equipo <em>Próximamente</em></button>
      </div>
      <div className="grid2">
        <label>Nombre<input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></label>
        <label>Apellido<input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></label>
        <label>Nacionalidad<select value={f.nationality} onChange={(e) => set('nationality', e.target.value)}>{NATIONALITIES.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Edad<input type="number" min={f.mode === 'driver' ? 8 : 25} max={f.mode === 'driver' ? 25 : 70} value={f.age} onChange={(e) => set('age', Number(e.target.value))} /></label>
        <label>Temporada inicial<input type="number" min={2000} max={2040} value={f.season} onChange={(e) => set('season', Number(e.target.value))} /></label>
        <label>Dificultad<select value={f.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>{Object.entries(DIFFS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Personalidad<select value={f.personality} onChange={(e) => set('personality', e.target.value as Personality)}>{Object.entries(PERSONALITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {f.mode === 'driver' && (
        <section><h2>Características <span className="muted">({left} puntos por repartir)</span></h2>
          <table className="stats"><tbody>{STAT_KEYS.map((k) => (<tr key={k}><td>{STAT_LABELS[k]}</td><td className="bar"><i style={{ width: `${f.stats[k]}%` }} /></td><td className="num">{f.stats[k]}</td>
            <td><button className="icon" aria-label={`Bajar ${STAT_LABELS[k]}`} onClick={() => bump(k, -1)}>−</button><button className="icon" aria-label={`Subir ${STAT_LABELS[k]}`} onClick={() => bump(k, 1)}>+</button></td></tr>))}</tbody></table></section>
      )}
      {f.mode === 'principal' && (
        <section>
          <h2>Tu perfil <span className="muted">({pLeft} puntos por repartir)</span></h2>
          <table className="stats"><tbody>{(Object.keys(PROFILE) as (keyof Principal)[]).map((k) => (<tr key={k}><td>{PROFILE[k]}</td><td className="bar"><i style={{ width: `${f.profile[k]}%` }} /></td><td className="num">{f.profile[k]}</td>
            <td><button className="icon" aria-label={`Bajar ${PROFILE[k]}`} onClick={() => bumpP(k, -1)}>−</button><button className="icon" aria-label={`Subir ${PROFILE[k]}`} onClick={() => bumpP(k, 1)}>+</button></td></tr>))}</tbody></table>
          <div className="seg"><button className={f.teamMode === 'existing' ? 'on' : ''} onClick={() => set('teamMode', 'existing')}>Escudería existente</button>
            <button className={f.teamMode === 'new' ? 'on' : ''} onClick={() => set('teamMode', 'new')}>Crear escudería</button></div>
          {f.teamMode === 'existing' ? (
            <div className="card"><label>Escudería<select value={f.teamId} onChange={(e) => set('teamId', e.target.value)}>{TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <p className={acc.ok ? '' : 'muted'}>{acc.ok ? `Los propietarios te aceptan (tu nivel ${acc.score}, exigen ${acc.need}).` : `Los propietarios no te aceptan: tu nivel es ${acc.score} y exigen ${acc.need}. Sube tu perfil o elige un equipo menor.`}</p></div>
          ) : (
            <div className="card"><div className="grid2">
              <label>Nombre de la escudería<input value={nt.name} onChange={(e) => set('newTeam', { ...nt, name: e.target.value })} /></label>
              <label>Color<input type="color" value={nt.color} onChange={(e) => set('newTeam', { ...nt, color: e.target.value })} /></label>
              <label>Logotipo<select value={nt.logo} onChange={(e) => set('newTeam', { ...nt, logo: e.target.value })}>{['◆', '▲', '●', '■', '★', '✦'].map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Filosofía deportiva<select value={nt.philosophy} onChange={(e) => set('newTeam', { ...nt, philosophy: e.target.value })}>{['Técnica', 'Cantera', 'Comercial'].map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Presupuesto inicial: {nt.budget} M<input type="range" min={60} max={150} value={nt.budget} onChange={(e) => set('newTeam', { ...nt, budget: Number(e.target.value) })} /></label>
            </div><p className="muted">Crear un equipo no te mete en la F1: deberás cumplir los requisitos de la FIA (finanzas, instalaciones, personal y apoyo) y esperar su aprobación. Necesitas presupuesto de sobra para invertir y pagar la cuota.</p></div>
          )}
        </section>
      )}
      <button className="btn primary" disabled={!valid} onClick={start}>Empezar carrera</button>
      {!valid && <p className="muted">Completa nombre y apellido{f.mode === 'principal' && (f.teamMode === 'new' ? ', y el nombre de tu escudería' : ' y elige un equipo que te acepte')}.</p>}
    </main>
  );
}
