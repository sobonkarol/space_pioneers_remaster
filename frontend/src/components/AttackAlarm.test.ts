import { describe, expect, it } from 'vitest';
import type { FleetMovement, Overview } from '../api/types';
import { incomingThreats } from './AttackAlarm';

const fleet = (p: Partial<FleetMovement>): FleetMovement => ({
  id: 1, mission: 'ATTACK', status: 'OUTBOUND', own: false, ownerName: 'X', origin: '1:1:1', target: '1:1:2',
  targetMoon: false, departAt: '2026-10-30T10:00:00Z', arriveAt: '2026-10-30T11:00:00Z', ships: {}, ...p,
});
const ov = (fleets: FleetMovement[]) => ({ fleets }) as unknown as Overview;

describe('alarm o ataku', () => {
  it('liczy tylko obce, lecace ataki i rakiety, najblizsze najpierw', () => {
    const { attacks, spies } = incomingThreats(ov([
      fleet({ id: 1, arriveAt: '2026-10-30T12:00:00Z' }),
      fleet({ id: 2, mission: 'MISSILE', arriveAt: '2026-10-30T11:30:00Z' }),
      fleet({ id: 3, own: true }),
      fleet({ id: 4, status: 'RETURNING' }),
      fleet({ id: 5, mission: 'HOLD' }),
      fleet({ id: 6, mission: 'TRANSPORT' }),
      fleet({ id: 7, mission: 'ESPIONAGE' }),
    ]));
    expect(attacks.map((f) => f.id)).toEqual([2, 1]);
    expect(spies.map((f) => f.id)).toEqual([7]);
  });
  it('bez przegladu nie ma zagrozen', () => {
    expect(incomingThreats(null)).toEqual({ attacks: [], spies: [] });
  });
});
