import { describe, expect, it } from 'vitest';
import { covers, duration, fmt, parseAmount } from './format';

describe('format', () => {
  it('formats thousands with dots', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(999)).toBe('999');
    expect(fmt(1000)).toBe('1.000');
    expect(fmt(1234567.89)).toBe('1.234.567');
    expect(fmt(-2500)).toBe('-2.500');
    expect(fmt(undefined)).toBe('0');
    expect(fmt(Number.NaN)).toBe('0');
  });

  it('formats durations', () => {
    expect(duration(5)).toBe('5s');
    expect(duration(65)).toBe('1m 05s');
    expect(duration(3725)).toBe('1h 02m 05s');
    expect(duration(90061)).toBe('1d 1h 01m 01s');
    expect(duration(-3)).toBe('0s');
  });

  it('checks affordability', () => {
    expect(covers({ metal: 10, crystal: 5, tritium: 0 }, { metal: 10, crystal: 5, tritium: 0 })).toBe(true);
    expect(covers({ metal: 9, crystal: 5, tritium: 0 }, { metal: 10, crystal: 5, tritium: 0 })).toBe(false);
  });

  it('parses user amounts', () => {
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('2k')).toBe(2000);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('-5')).toBe(0);
    expect(parseAmount('')).toBe(0);
  });
});
