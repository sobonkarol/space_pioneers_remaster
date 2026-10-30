/**
 * Wzory gry przepisane 1:1 z silnika (backend: engine/data, economy, fleet, special).
 * Wiki liczy z nich tabele na podstawie definicji z /api/config, wiec zawsze zgadza sie z serwerem.
 * Przy zmianie wzoru w silniku trzeba zmienic go tez tutaj (test: wikiMath.test.ts).
 */
import type { Resources, UniverseConfig } from '../../api/types';

export interface Growth {
  resource?: string;
  base: number;
  growth: number;
  temperatureDependent?: boolean;
  techBonusKey?: string;
  techBonusPerLevel?: number;
}

export interface WikiBuilding {
  key: string;
  category: string;
  branch: string;
  baseCost: Resources;
  costFactor: number;
  maxLevel?: number | null;
  location?: 'PLANET' | 'MOON' | 'ANY';
  production?: Growth | null;
  energyUse?: Growth | null;
  energyProduction?: Growth | null;
  tritiumUse?: Growth | null;
  storage?: { resource: string } | null;
  fieldsBonus?: number | null;
  requirements: { buildings: Record<string, number>; research: Record<string, number> };
}

export interface WikiResearch {
  key: string;
  branch: string;
  baseCost: Resources;
  costFactor: number;
  maxLevel?: number | null;
  requirements: { buildings: Record<string, number>; research: Record<string, number> };
}

export interface WikiUnit {
  key: string;
  type: 'SHIP' | 'DEFENSE' | 'MISSILE';
  branch: string;
  cost: Resources;
  attack: number;
  shield: number;
  cargo: number;
  speed: number;
  drive?: string | null;
  fuel: number;
  stationary?: boolean | null;
  maxCount?: number | null;
  missileSlots?: number | null;
  rapidFire: Record<string, number>;
  requirements: { buildings: Record<string, number>; research: Record<string, number> };
}

export interface WikiConfig {
  universeName: string;
  universe: UniverseConfig & { economySpeed: number; researchSpeed: number; fleetSpeed: number };
  branchMinPoints: number;
  buildings: WikiBuilding[];
  research: WikiResearch[];
  ships: WikiUnit[];
  defenses: WikiUnit[];
  missiles: WikiUnit[];
}

export const BASE_PRODUCTION = { metal: 30, crystal: 15 };
export const BASE_STORAGE = 10_000;
export const STORAGE_GROWTH = 1.8;
export const HOMEWORLD_FIELDS = 163;
export const MAX_BUILD_QUEUE = 5;
export const MAX_HOLD_HOURS = 32;
export const MAX_EXPEDITION_HOURS = 8;
export const MAX_PLANETS = 9;
export const MAX_BUDDIES = 50;
export const MOON_DEBRIS_PER_PERCENT = 100_000;
export const MOON_MAX_CHANCE = 20;
export const PHALANX_SCAN_COST = 5_000;
export const SILO_SLOTS_PER_LEVEL = 10;

const floorRes = (r: Resources): Resources => ({
  metal: Math.floor(r.metal),
  crystal: Math.floor(r.crystal),
  tritium: Math.floor(r.tritium),
});

/** Koszt poziomu L = koszt bazowy * wspolczynnik^(L-1), zaokraglony w dol. */
export function costForLevel(base: Resources, factor: number, level: number): Resources {
  const f = Math.pow(factor, level - 1);
  return floorRes({ metal: base.metal * f, crystal: base.crystal * f, tritium: base.tritium * f });
}

/** wartosc(L) = base * L * (growth + bonus*tech)^L */
export function growthAt(g: Growth | null | undefined, level: number, techLevel = 0): number {
  if (!g || level <= 0) return 0;
  let growth = g.growth;
  if (g.techBonusKey && g.techBonusPerLevel) growth += g.techBonusPerLevel * techLevel;
  return g.base * level * Math.pow(growth, level);
}

/** Czas budowy budynku (s): (metal+krysztal) / (2500 * (1+roboty) * 2^nanity) h / predkosc. */
export function buildingSeconds(cost: Resources, robotics: number, nanite: number, speed: number): number {
  const hours = (cost.metal + cost.crystal) / (2500 * (1 + robotics) * Math.pow(2, nanite));
  return Math.max(1, Math.round((hours * 3600) / speed));
}

/** Czas badania (s): (metal+krysztal) / (1000 * (1+laboratorium)) h / predkosc badan. */
export function researchSeconds(cost: Resources, lab: number, speed: number): number {
  const hours = (cost.metal + cost.crystal) / (1000 * (1 + lab));
  return Math.max(1, Math.round((hours * 3600) / speed));
}

/** Czas budowy jednej jednostki (s): jak budynki, ale z poziomem stoczni. */
export function unitSeconds(cost: Resources, shipyard: number, nanite: number, speed: number): number {
  const hours = (cost.metal + cost.crystal) / (2500 * (1 + shipyard) * Math.pow(2, nanite));
  return Math.max(1, Math.round((hours * 3600) / speed));
}

export const storageForLevel = (level: number) => Math.floor(BASE_STORAGE * Math.pow(STORAGE_GROWTH, level));
export const satelliteEnergy = (tMax: number) => Math.max(1, Math.floor((tMax + 140) / 6));
export const tritiumFactor = (tMax: number) => Math.max(0.1, 1.44 - 0.004 * tMax);

/** Punkty: 1 za kazde 1000 wydanych surowcow. */
export const pointsFor = (r: Resources) => (r.metal + r.crystal + r.tritium) / 1000;

export function cumulativeCost(base: Resources, factor: number, level: number): Resources {
  const sum = { metal: 0, crystal: 0, tritium: 0 };
  for (let l = 1; l <= level; l++) {
    const c = costForLevel(base, factor, l);
    sum.metal += c.metal;
    sum.crystal += c.crystal;
    sum.tritium += c.tritium;
  }
  return sum;
}

// ---------- floty ----------
export function distance(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return 20_000 * Math.abs(a[0] - b[0]);
  if (a[1] !== b[1]) return 2_700 + 95 * Math.abs(a[1] - b[1]);
  if (a[2] !== b[2]) return 1_000 + 5 * Math.abs(a[2] - b[2]);
  return 5;
}

export function driveBonus(drive?: string | null): number {
  switch (drive) {
    case 'combustion_drive':
      return 0.1;
    case 'impulse_drive':
      return 0.2;
    case 'hyperspace_drive':
      return 0.3;
    default:
      return 0;
  }
}

export function unitSpeed(u: WikiUnit, driveLevel: number, warrior = false): number {
  if (u.type !== 'SHIP' || u.stationary || u.speed <= 0) return 0;
  return Math.round(u.speed * (1 + driveBonus(u.drive) * driveLevel + (warrior ? 0.1 : 0)));
}

/** Czas lotu w jedna strone (s). */
export function flightSeconds(dist: number, speed: number, percent: number, fleetSpeed: number): number {
  const s = ((35_000 / percent) * Math.sqrt((dist * 10) / speed) + 10) / fleetSpeed;
  return Math.max(1, Math.round(s));
}

/** Zuzycie trytu w jedna strone. */
export function fuel(units: { fuel: number; count: number }[], dist: number, percent: number): number {
  const f = Math.pow(percent / 100 + 1, 2);
  let total = 0;
  for (const u of units) total += (u.count * u.fuel * dist) / 35_000 * f;
  return 1 + Math.round(total);
}

// ---------- reszta zasad ----------
export const fleetSlots = (computer: number) => 1 + computer;
export const maxPlanets = (astro: number) => Math.min(MAX_PLANETS, 1 + Math.floor((astro + 1) / 2));
export const maxExpeditions = (astro: number) => Math.floor(Math.sqrt(astro));
export const phalanxRange = (level: number) => (level <= 0 ? -1 : level * level - 1);
export const missileRange = (impulse: number) => Math.max(0, impulse * 5 - 1);
export const marketFee = (tradeCenter: number) => Math.max(0.05, 0.1 - 0.005 * tradeCenter);
export const baseHull = (u: WikiUnit) => (u.cost.metal + u.cost.crystal) / 10;

/** Zakres pol i temperatur nowej kolonii wg pozycji (PlanetGenerator). */
export function fieldRange(position: number): [number, number] {
  if (position <= 3) return [50, 80];
  if (position <= 6) return [120, 180];
  if (position <= 9) return [140, 200];
  if (position <= 12) return [100, 160];
  return [60, 140];
}

export function temperatureRange(position: number): [number, number] {
  const base = 240 - 18 * (position - 1);
  return [base - 20, base + 20];
}

export function planetType(position: number): string {
  if (position <= 3) return 'gorąca';
  if (position <= 6) return 'sucha';
  if (position <= 9) return 'umiarkowana';
  if (position <= 12) return 'wodna';
  return 'lodowa';
}

/** Raport szpiegowski: ktore sekcje widac przy danej liczbie sond i roznicy technologii. */
export function espionageEffective(probes: number, diff: number): number {
  return probes + diff * Math.abs(diff);
}
