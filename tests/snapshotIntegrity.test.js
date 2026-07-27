import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dataRoot = path.resolve('public/data');

describe('production snapshot', () => {
  it('contains every manifest player and deep-stat competition', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(dataRoot, 'manifest.json'), 'utf8'));
    const missing = [];

    for (const id of manifest.playerIds) {
      const playerPath = path.join(dataRoot, 'players', `${id}.json`);
      let player;
      try {
        player = JSON.parse(await fs.readFile(playerPath, 'utf8'));
      } catch {
        missing.push(`player:${id}`);
        continue;
      }

      for (const season of player.statSeasons ?? []) {
        for (const competition of season.tournaments ?? []) {
          if (!competition.hasDeepStats || !competition.entryId) continue;
          const competitionPath = path.join(
            dataRoot,
            'competitions',
            String(id),
            `${encodeURIComponent(String(competition.entryId))}.json`
          );
          try {
            await fs.access(competitionPath);
          } catch {
            missing.push(`competition:${id}:${competition.entryId}`);
          }
        }
      }
    }

    expect(manifest.playerIds.length).toBeGreaterThan(0);
    expect(manifest.generatedAt).toBeTruthy();
    expect(missing).toEqual([]);
  });
});
