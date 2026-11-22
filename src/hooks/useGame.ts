import { useSyncExternalStore } from 'react';
import type { Action, GameState } from '../types';
import { reduce } from '../services/gameEngine';

let state: GameState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const gameStore = {
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  get: () => state,
  set: (s: GameState | null) => { state = s; emit(); },
  dispatch: (a: Action) => { if (state) { state = reduce(state, a); emit(); } },
};
export const useGame = () => useSyncExternalStore(gameStore.subscribe, gameStore.get);
