import { describe, expect, it } from 'vitest';
import {
  buildingSeconds, costForLevel, distance, flightSeconds, fuel, growthAt, maxExpeditions, maxPlanets, missileRange,
  phalanxRange, researchSeconds, satelliteEnergy, storageForLevel, tritiumFactor,
} from './wikiMath';

/** Te same wartosci co w testach silnika (backend) - wiki musi liczyc identycznie. */
describe('wzory wiki zgodne z silnikiem', () => {
  it('koszty i czasy', () => {
    expect(costForLevel({ metal: 60, crystal: 15, tritium: 0 }, 1.5, 3)).toEqual({ metal: 135, crystal: 33, tritium: 0 });
    // (135+33)/2500 h = 241,92 s
    expect(buildingSeconds({ metal: 135, crystal: 33, tritium: 0 }, 0, 0, 1)).toBe(242);
    expect(buildingSeconds({ metal: 135, crystal: 33, tritium: 0 }, 1, 1, 1)).toBe(60);
    expect(researchSeconds({ metal: 800, crystal: 400, tritium: 0 }, 1, 1)).toBe(2160);
  });
  it('produkcja, energia, magazyny', () => {
    expect(growthAt({ base: 30, growth: 1.1 }, 1)).toBeCloseTo(33);
    expect(growthAt({ base: 30, growth: 1.05, techBonusKey: 'energy_tech', techBonusPerLevel: 0.01 }, 2, 5)).toBeCloseTo(60 * 1.1 * 1.1);
    expect(storageForLevel(0)).toBe(10000);
    expect(storageForLevel(1)).toBe(18000);
    expect(satelliteEnergy(40)).toBe(30);
    expect(satelliteEnergy(-200)).toBe(1);
    expect(tritiumFactor(400)).toBe(0.1);
  });
  it('floty', () => {
    expect(distance([1, 1, 1], [2, 1, 1])).toBe(20000);
    expect(distance([1, 1, 1], [1, 3, 1])).toBe(2890);
    expect(distance([1, 1, 1], [1, 1, 4])).toBe(1015);
    expect(distance([1, 1, 1], [1, 1, 1])).toBe(5);
    expect(flightSeconds(2890, 5000, 100, 1)).toBe(Math.round(350 * Math.sqrt(28900 / 5000) + 10));
    expect(fuel([{ fuel: 10, count: 1 }], 35000, 100)).toBe(41);
  });
  it('limity', () => {
    expect(maxPlanets(0)).toBe(1);
    expect(maxPlanets(1)).toBe(2);
    expect(maxPlanets(3)).toBe(3);
    expect(maxPlanets(30)).toBe(9);
    expect(maxExpeditions(4)).toBe(2);
    expect(phalanxRange(3)).toBe(8);
    expect(missileRange(2)).toBe(9);
  });
});
