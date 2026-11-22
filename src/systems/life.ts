import type { GameState, LifeEvent, LifeOption, NewsItem } from '../types';
import type { Rng } from './rng';
import { playerOf } from './career';

export type ServiceKey = 'coach' | 'physio' | 'mental' | 'media';
export const SERVICES: Record<ServiceKey, { label: string; cost: number; desc: string }> = {
  coach: { label: 'Entrenador personal', cost: 0.001, desc: '+25 % de mejora al entrenar.' },
  physio: { label: 'Fisioterapeuta', cost: 0.001, desc: 'Reduce a la mitad el riesgo de lesión al entrenar.' },
  mental: { label: 'Psicólogo deportivo', cost: 0.001, desc: 'Estabiliza tu ánimo y lo sube poco a poco.' },
  media: { label: 'Gestor de redes', cost: 0.0015, desc: '+1 de popularidad cada mes.' },
};
export const defaultLife = () => ({ mood: 60, services: { coach: false, physio: false, mental: false, media: false } });
const clamp = (v: number) => Math.min(100, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const O = (label: string, mood: number, popularity: number, money: number, fatigue: number, team: number, media: number, rep: number): LifeOption => ({ label, mood, popularity, money, fatigue, team, media, rep });
const EVENTS: Omit<LifeEvent, 'id'>[] = [
  { title: 'Evento benéfico', body: 'Te invitan a un evento benéfico con aficionados y prensa.', options: [O('Asistir y firmar autógrafos', 3, 4, 0, 6, 0, 3, 0), O('Enviar un mensaje de apoyo', 0, 1, 0, 0, 0, 1, 0), O('Rechazar la invitación', 0, 0, 0, 0, 0, -1, 0)] },
  { title: 'Polémica en redes', body: 'Un comentario tuyo se ha sacado de contexto y se hace viral.', options: [O('Responder con humor', 2, 3, 0, 0, -1, 1, 0), O('Pedir disculpas', -2, 0, 0, 0, 1, 3, 0), O('Ignorarlo', 0, -1, 0, 0, 0, -2, 0)] },
  { title: 'Apoyo a tu familia', body: 'Tu familia atraviesa un momento difícil y necesita ayuda económica.', options: [O('Ayudar (gasto de 3 k)', 6, 0, -0.003, 0, 0, 0, 0), O('No puedes ayudar ahora', -6, 0, 0, 0, 0, 0, 0)] },
  { title: 'Anuncio publicitario', body: 'Una marca te ofrece grabar un anuncio durante la semana.', options: [O('Aceptar (ingresas 4 k)', 0, 3, 0.004, 8, -3, 1, 0), O('Rechazar y centrarte en la pista', 1, 0, 0, 0, 1, 0, 0)] },
  { title: 'Fiesta con amigos', body: 'Tus amigos organizan una fiesta antes de la próxima carrera.', options: [O('Ir y desconectar', 6, 0, 0, 8, -2, 0, 0), O('Quedarte entrenando', -2, 0, 0, 3, 0, 0, 1)] },
  { title: 'Entrevista exclusiva', body: 'Un periodista te pide una entrevista exclusiva en profundidad.', options: [O('Aceptar', 0, 2, 0, 4, 0, 4, 0), O('Rechazar', 0, 0, 0, 0, 0, -1, 0)] },
  { title: 'Estudios', body: 'Tienes exámenes y la preparación choca con tus entrenamientos.', options: [O('Priorizar los estudios', 3, 0, 0, -4, 0, 0, 0), O('Priorizar la pista', -4, 0, 0, 4, 0, 0, 1)] },
  { title: 'Cena con un patrocinador', body: 'Un directivo de una marca te invita a cenar.', options: [O('Asistir', 0, 2, 0.001, 3, 0, 2, 0), O('Excusarte', 1, 0, 0, 0, 0, 0, 0)] },
];
const nw = (s: GameState, id: string, headline: string, body: string): NewsItem => ({ id: `${id}-${s.date}`, date: s.date, category: 'system', headline, body, involved: [s.player.name] });

/** Cada mes: gastos de tus servicios, ánimo, popularidad por redes y, a veces, un suceso de tu vida fuera de la pista. */
export function lifeMonthly(s: GameState, rng: Rng): { state: GameState; news: NewsItem[] } {
  const out: NewsItem[] = [];
  if (s.mode !== 'driver' || !playerOf(s)) return { state: s, news: out };
  const c = s.career, services = { ...c.life.services };
  let money = c.money;
  (Object.keys(SERVICES) as ServiceKey[]).forEach((k) => {
    if (!services[k]) return;
    if (money >= SERVICES[k].cost) money -= SERVICES[k].cost;
    else { services[k] = false; out.push(nw(s, `svc-${k}`, `Cancelas: ${SERVICES[k].label}`, 'No tienes fondos para pagarlo este mes.')); }
  });
  const mood = clamp(Math.round(c.life.mood + (60 - c.life.mood) * 0.1 + (services.mental ? 3 : 0)));
  const rs = c.reserve;
  const test: Omit<LifeEvent, 'id'> | null = rs && !s.lifeEvent && rng.next() < 0.5 ? {
    title: `Test con ${rs.team}`, body: `${rs.team} te invita a una sesión de pruebas con su monoplaza de F1. ¿En qué te centras?`,
    options: [{ ...O('Priorizar el ritmo', 2, 1, 0, 6, 0, 0, 1), stat: 'speed', gain: 1 }, { ...O('Priorizar los datos y el feedback', 1, 0, 0, 3, 3, 0, 0), stat: 'adaptability', gain: 1 }, { ...O('Arriesgar para impresionar', 3, 2, 0, 9, 0, 1, 2), stat: 'pressure', gain: 1 }],
  } : null;
  const event = test ?? (!s.lifeEvent && rng.next() < 0.35 ? EVENTS[rng.int(0, EVENTS.length - 1)] : null);
  return {
    state: { ...s, lifeEvent: event ? { ...event, id: `life-${s.date}` } : s.lifeEvent, career: { ...c, money: r3(money), popularity: clamp(c.popularity + (services.media ? 1 : 0)), life: { mood, services } } },
    news: out,
  };
}
export function answerLife(s: GameState, index: number): GameState {
  const ev = s.lifeEvent, o = ev?.options[index], p = playerOf(s);
  if (!ev || !o || !p) return s;
  const c = s.career;
  return {
    ...s, lifeEvent: null,
    career: { ...c, money: r3(c.money + o.money), popularity: clamp(c.popularity + o.popularity),
      relations: { ...c.relations, team: clamp(c.relations.team + o.team), media: clamp(c.relations.media + o.media) }, life: { ...c.life, mood: clamp(c.life.mood + o.mood) } },
    drivers: s.drivers.map((d) => (d.id === p.id ? { ...d, fatigue: clamp(d.fatigue + o.fatigue), reputation: clamp(d.reputation + o.rep), stats: o.stat ? { ...d.stats, [o.stat]: Math.min(99, d.stats[o.stat] + (o.gain ?? 1)) } : d.stats } : d)),
    news: [nw(s, 'life', `Vida personal: ${ev.title}`, `«${o.label}»`), ...s.news],
  };
}
export const toggleService = (s: GameState, key: ServiceKey): GameState =>
  (s.mode !== 'driver' ? s : { ...s, career: { ...s.career, life: { ...s.career.life, services: { ...s.career.life.services, [key]: !s.career.life.services[key] } } } });
