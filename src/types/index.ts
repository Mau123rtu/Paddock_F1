export type Mode = 'driver' | 'principal';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'realistic';
export type Personality = 'humble' | 'egocentric' | 'competitive' | 'professional' | 'charismatic' | 'reserved';

export const STAT_KEYS = [
  'speed', 'braking', 'cornering', 'overtaking', 'defense', 'consistency',
  'tyreManagement', 'fuelManagement', 'adaptability', 'pressure', 'focus', 'experience',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  speed: 'Velocidad', braking: 'Frenada', cornering: 'Trazada', overtaking: 'Adelantamientos',
  defense: 'Defensa', consistency: 'Consistencia', tyreManagement: 'Gestión de neumáticos',
  fuelManagement: 'Gestión de combustible', adaptability: 'Adaptabilidad',
  pressure: 'Rendimiento bajo presión', focus: 'Concentración', experience: 'Experiencia',
};

export type Category = 'karting' | 'f4' | 'f3' | 'f2' | 'f1';

export type TrainingId = 'simulator' | 'fitness' | 'reflexes' | 'focus' | 'telemetry' | 'mental';
export interface Offer { id: string; category: Category; teamName: string; teamId?: string; salary: number; years: number; academy?: string; replaces?: string; reserve?: boolean; }
export interface Candidacy { id: string; target: string; kind: 'team' | 'academy' | 'sponsor'; category: Category; reply: string; pitch?: string; }
export interface Alert { id: string; title: string; body: string; tone: 'good' | 'bad' | 'info'; }
export interface PlayerContract { teamName: string; category: Category; salary: number; endSeason: number; }
export interface Career {
  training: TrainingId | null; contract: PlayerContract | null; points: number; races: number;
  popularity: number; relations: { team: number; media: number; rivals: number }; sponsors: SponsorDeal[]; money: number;
  setup: { aero: number; suspension: number; brakes: number };
  agent: { hired: boolean; nextAsk: string }; engineer: string;
  academy: string | null; candidacies: Candidacy[]; cooldown: Record<string, string>; slPoints: { season: number; pts: number }[];
  history: SeasonRecord[]; stats: { wins: number; podiums: number; races: number; dnfs: number; poles: number }; objective: { rank: number } | null;
  skillPoints: number; reserve: { team: string; since: number } | null;
  camp: Camp | null; life: { mood: number; services: { coach: boolean; physio: boolean; mental: boolean; media: boolean } };
}
export interface InterviewOption { label: string; media: number; team: number; rivals: number; rep: number; }
export interface Interview { rivals: string[]; id: string; question: string; options: InterviewOption[]; }
export type StaffRole = 'aero' | 'engineering' | 'design' | 'strategy' | 'mechanics' | 'marketing';
export interface Staff { id: string; name: string; role: StaffRole; skill: number; salary: number; }
export interface CarComponent { id: string; label: string; performance: number; reliability: number; level: number; }
export interface Project { id: string; componentId: string; label: string; daysLeft: number; cost: number; }
export interface SponsorDeal { id: string; name: string; pay: number; endSeason: number; }
export interface Ledger { month: string; income: number; expenses: number; }
export interface TeamOps { staff: Staff[]; car: CarComponent[]; projects: Project[]; sponsors: SponsorDeal[]; ledger: Ledger[]; devSpent: number; academy: Driver[]; }
export type Compound = 'S' | 'M' | 'H' | 'W';
export interface RaceEntry { id: string; name: string; team: string; color: string; pos: number; pts: number; status: 'finished' | 'dnf'; cause?: 'accident' | 'mechanical' | 'retired'; best: number; stops: number; }
export interface RaceResult { id: string; season: number; date: string; name: string; category: Category; entries: RaceEntry[]; hold?: boolean; pole?: string; orders?: { accepted: number; rejected: number }; penalties?: string[]; }
export interface Principal { experience: number; reputation: number; management: number; technical: number; }
export interface Application { status: 'draft' | 'review' | 'approved'; facilities: number; support: number; daysLeft: number; reasons: string[]; attempts: number; }
export interface Rival { id: string; name: string; nationality: string; birthYear: number; rating: number; potential: number; team: string; cat: Exclude<Category, 'f1'>; }
export interface Rumor { id: string; driverId: string; toTeam: string; resolve: string; real: boolean; }
export interface SeasonRecord { season: number; category: Category; team: string; rank: number | null; points: number; }
export interface CampCandidate { name: string; score: number; }
export interface Camp { academy: string; category: Category; pitch: string; step: number; level: number; scores: number[]; candidates: CampCandidate[]; spots: number; }
export interface LifeOption { label: string; mood: number; popularity: number; money: number; fatigue: number; team: number; media: number; rep: number; stat?: StatKey; gain?: number; }
export interface LifeEvent { id: string; title: string; body: string; options: LifeOption[]; }
export interface Contract { teamId: string; salary: number; endSeason: number; }
export interface Driver {
  contract: Contract | null; fatigue: number; injuryDays: number; reputation: number;
  id: string; name: string; nationality: string; birthYear: number; number: number;
  teamId: string | null; category: Category; stats: Stats; personality: Personality; potential?: number;
}
export interface Team { id: string; name: string; color: string; budget: number; reputation: number; carPerf: number; entered: boolean; logo?: string; philosophy?: string; }
export interface CalendarEvent { id: string; date: string; name: string; kind: 'race' | 'test'; done: boolean; circuit: string; cn: number; cats: Category[]; }
export type NewsCategory = 'race' | 'transfer' | 'finance' | 'system';
export interface NewsItem {
  id: string; date: string; category: NewsCategory; headline: string; body: string; involved: string[];
  /** Categorías a las que pertenece la noticia (vacío = general) y si es lo bastante importante para verse en todas. */
  series?: Category[]; important?: boolean;
}

/** Campeón de una categoría y temporada (nivel y edad en el momento del título). */
export interface ChampionRec { season: number; category: Category; driver: string; team: string; pts: number; wins: number; rating: number; age: number; player?: boolean; }
export interface DriverLog { wins: number; poles: number; podiums: number; races: number; titles: number; birthYear: number; firstWin?: { season: number; age: number }; }
export interface RecordEntry { key: string; holder: string; value: number; season: number | null; real: boolean; }
export interface TrophyRec { id: string; season: number; date: string; }
export interface SeasonSummary {
  season: number; category: Category; team: string; rank: number | null; points: number; wins: number; podiums: number; poles: number; dnfs: number;
  races: { name: string; pos: number | null; pts: number; cum: number; leaderCum: number }[];
  table: { name: string; pts: number; me: boolean }[]; ratingStart: number; ratingEnd: number; champion: string; headline: string;
}
export interface RegEra { start: number; name: string; kind: 'major' | 'minor'; desc: string; announced?: boolean; }
export interface Celebration { icon?: string; id: string; kind: 'win' | 'pole' | 'title' | 'promo' | 'record' | 'trophy' | 'hall'; title: string; sub: string; }
export interface FPRun { program: 'pace' | 'long' | 'aero' | 'tyres'; tyre: Compound; mode: 'normal' | 'push' | 'risk'; time: number | null; crashed: boolean; note: string; }
export interface ReserveFP { id: string; eventId: string; eventName: string; team: string; teamId: string; replaces: string; season: number; runsLeft: number; log: FPRun[]; rank: number | null; summary: string | null; }
export interface HallEntry { name: string; season: number; age: number; titles: number; wins: number; podiums: number; poles: number; peak: number; verdict: string; player?: boolean; teams?: string; }
export interface Legacy {
  startSeason: number; tutorialDone: boolean; champions: ChampionRec[]; constructors: { season: number; team: string; pts: number }[];
  logs: Record<string, DriverLog>; records: RecordEntry[]; trophies: TrophyRec[]; seen: string[];
  summaries: SeasonSummary[]; pendingSummary: SeasonSummary | null; celebrations: Celebration[];
  fp: ReserveFP | null; fpDone: number; fpSeason: { season: number; n: number }; impression: number; fpBest: number | null;
  retired: { season: number; age: number; score: number; verdict: string } | null; hall: HallEntry[]; ratingStart: number; f1Age: number | null;
  /** Jerarquía en tu equipo y reglamento técnico de la F1. */
  hier: 'me' | 'even' | 'mate'; regs: RegEra[]; nextRegs: RegEra | null;
}
export interface GameState {
  legacy: Legacy;
  schemaVersion: number; id: string; label: string; mode: Mode; difficulty: Difficulty;
  seed: number; date: string; season: number;
  player: { name: string; driverId: string | null; teamId: string | null };
  offers: Offer[]; career: Career; ops: TeamOps; staffPool: Staff[]; sponsorOffers: SponsorDeal[]; pendingRace: string | null; interview: Interview | null; lifeEvent: LifeEvent | null; alerts: Alert[]; rivals: Record<Exclude<Category, 'f1'>, Rival[]>; rivalSeq: number; rumors: Rumor[]; application: Application | null; principal: Principal | null; bonds: Record<string, number>; youth: Driver[]; results: RaceResult[]; teams: Team[]; drivers: Driver[]; calendar: CalendarEvent[]; news: NewsItem[];
}
export interface NewGameSetup {
  mode: Mode; firstName: string; lastName: string; nationality: string; age: number;
  season: number; difficulty: Difficulty; personality: Personality; stats: Stats; teamId: string;
  teamMode: 'existing' | 'new'; profile: Principal; newTeam: { name: string; color: string; philosophy: string; logo: string; budget: number };
}
export type Action =
  | { type: 'ADVANCE_DAYS'; days: number }
  | { type: 'SKIP_TO_NEXT_EVENT' }
  | { type: 'SIGN_DRIVER'; driverId: string; salary: number; years: number }
  | { type: 'RELEASE_DRIVER'; driverId: string }
  | { type: 'SET_TRAINING'; plan: TrainingId | null }
  | { type: 'ACCEPT_OFFER'; offerId: string; salary: number | null }
  | { type: 'DECLINE_OFFER'; offerId: string }
  | { type: 'HIRE_STAFF'; staffId: string }
  | { type: 'FIRE_STAFF'; staffId: string }
  | { type: 'START_PROJECT'; componentId: string }
  | { type: 'ACCEPT_SPONSOR'; id: string }
  | { type: 'DECLINE_SPONSOR'; id: string }
  | { type: 'DROP_SPONSOR'; id: string }
  | { type: 'FINISH_RACE'; result: RaceResult }
  | { type: 'ANSWER_INTERVIEW'; index: number }
  | { type: 'SET_SETUP'; setup: Career['setup'] }
  | { type: 'ACCEPT_PSPONSOR'; id: string }
  | { type: 'DROP_PSPONSOR'; id: string }
  | { type: 'INVEST_FACILITIES'; amount: number } | { type: 'LOBBY_FIA' } | { type: 'SUBMIT_APPLICATION' }
  | { type: 'SIGN_YOUTH'; id: string } | { type: 'RELEASE_YOUTH'; id: string } | { type: 'PROMOTE_YOUTH'; id: string }
  | { type: 'RENEW_DRIVER'; driverId: string; salary: number; years: number }
  | { type: 'APPLY_TO'; target: string; kind: 'team' | 'academy'; pitch?: string } | { type: 'ANSWER_LIFE'; index: number } | { type: 'TOGGLE_SERVICE'; key: 'coach' | 'physio' | 'mental' | 'media' } | { type: 'CAMP_TEST'; approach: number } | { type: 'SPEND_POINT'; stat: StatKey } | { type: 'REQUEST_RESERVE' } | { type: 'APPLY_SPONSOR'; name: string } | { type: 'DISMISS_ALERT' }
  | { type: 'HIRE_AGENT' } | { type: 'FIRE_AGENT' } | { type: 'ASK_AGENT' }
  | { type: 'DISMISS_CELEBRATION' } | { type: 'DISMISS_SUMMARY' } | { type: 'TUTORIAL_DONE' } | { type: 'RETIRE' }
  | { type: 'FP_RUN'; program: FPRun['program']; tyre: Compound; mode: FPRun['mode'] } | { type: 'FP_FINISH' } | { type: 'FP_SKIP' };
