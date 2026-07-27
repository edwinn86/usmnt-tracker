import { describe, expect, it } from 'vitest';
import {
  usmntPlayerIds,
  usmntProspectIds,
  usmntCuspIds,
  usmntDualIds,
} from '../src/data/usmntPlayerIds';

const rosters = {
  firstTeam: usmntPlayerIds,
  prospects: usmntProspectIds,
  cusp: usmntCuspIds,
  dualNats: usmntDualIds,
};

describe('roster ID integrity', () => {
  it.each(Object.entries(rosters))('%s contains valid unique IDs', (_name, ids) => {
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
