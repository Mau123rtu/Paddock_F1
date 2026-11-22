import type { CalendarEvent, Team } from '../types';
import { F1_TEAMS } from './real';
import { buildSeasonCalendar } from './circuits';
export const TEAMS: Team[] = F1_TEAMS.map((t) => ({ id: t.id, name: t.name, color: t.color, budget: t.budget, reputation: t.reputation, carPerf: t.carPerf, entered: true }));
export const FIRST_NAMES = ['Mateo', 'Lukas', 'Ethan', 'Hugo', 'Tomás', 'Kenji', 'Rafael', 'Niklas'];
export const LAST_NAMES = ['Varga', 'Moreau', 'Salvatore', 'Lindqvist', 'Okafor', 'Reyes', 'Brandt', 'Tanaka'];
export const NATIONALITIES = ['México', 'España', 'Argentina', 'Brasil', 'Reino Unido', 'Francia', 'Italia', 'Alemania', 'Países Bajos', 'Japón', 'Australia', 'Canadá', 'Estados Unidos'];
/** Calendario de la temporada para todas las categorías (ver circuits.ts). La primera temporada usa los 24 circuitos reales; después puede rotar. */
export const buildCalendar = (season: number, seed: number, rotate = true): CalendarEvent[] => buildSeasonCalendar(season, seed, rotate);
