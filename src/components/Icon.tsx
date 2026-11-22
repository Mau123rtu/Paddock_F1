import { Award, Banknote, BarChart3, CalendarDays, CarFront, Check, CheckSquare, Cog, Crown, DoorOpen, Dumbbell, FileText, Flag, FlaskConical, Flame, Gauge, Gem, Globe, GraduationCap, Handshake, Heart, Home, Landmark, Lock, Medal, Megaphone, Mic, PartyPopper, Rocket, ScrollText, Sparkles, Square, Star, Target, Timer, TrendingUp, Trophy, Wrench, X, Zap } from 'lucide-react';

export const ICONS = {
  award: Award, banknote: Banknote, chart: BarChart3, calendar: CalendarDays, car: CarFront, check: CheckSquare, cog: Cog, crown: Crown, door: DoorOpen, dumbbell: Dumbbell,
  file: FileText, flag: Flag, flask: FlaskConical, flame: Flame, gauge: Gauge, gem: Gem, globe: Globe, grad: GraduationCap, handshake: Handshake, heart: Heart, home: Home,
  landmark: Landmark, lock: Lock, medal: Medal, megaphone: Megaphone, mic: Mic, party: PartyPopper, rocket: Rocket, scroll: ScrollText, sparkles: Sparkles, square: Square,
  star: Star, tick: Check, target: Target, timer: Timer, trend: TrendingUp, trophy: Trophy, wrench: Wrench, close: X, zap: Zap,
} as const;
export type IconName = keyof typeof ICONS;

/** Icono de la interfaz (decorativo: el texto que lo acompaña ya dice lo mismo). */
export function Ico({ name, size = 18, className }: { name: IconName | string; size?: number; className?: string }) {
  const C = ICONS[name as IconName] ?? Star;
  return <C size={size} className={className} aria-hidden="true" focusable="false" />;
}
