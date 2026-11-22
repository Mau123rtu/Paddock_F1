import type { Difficulty, GameState } from '../types';
/** ask: salario exigido · income/expense: finanzas del equipo · train: ritmo de mejora · scout: ojeadores · fire: puntos mínimos para no ser despedido · cap: límite de gasto en desarrollo (M) · offer: patrocinios personales */
export const DIFF: Record<Difficulty, { ask: number; income: number; expense: number; train: number; scout: number; fire: number; cap: number; offer: number }> = {
  easy: { ask: 0.85, income: 1.15, expense: 0.9, train: 1.3, scout: 1.5, fire: 3, cap: 35, offer: 1.2 },
  normal: { ask: 1, income: 1, expense: 1, train: 1, scout: 1, fire: 6, cap: 25, offer: 1 },
  hard: { ask: 1.15, income: 0.9, expense: 1.1, train: 0.85, scout: 0.7, fire: 10, cap: 20, offer: 0.9 },
  realistic: { ask: 1.3, income: 0.8, expense: 1.2, train: 0.7, scout: 0.5, fire: 14, cap: 16, offer: 0.8 },
};
export const dm = (s: GameState) => DIFF[s.difficulty];
