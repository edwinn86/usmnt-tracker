import { describe, expect, it } from 'vitest';
import {
  parseAdvancedMetrics,
  parseCompetitionStats,
  transformPlayerData,
} from '../src/hooks/usePlayersData';

describe('FotMob data normalization', () => {
  it('normalizes totals, per-90 values, and percentiles', () => {
    const metrics = parseAdvancedMetrics({
      statsSection: {
        items: [{
          items: [{
            title: 'Non-penalty xG',
            localizedTitleId: 'non_penalty_xg',
            statValue: 8,
            per90: 0.42,
            percentileRank: 91,
            percentileRankPer90: 87,
            statFormat: 'number',
          }],
        }],
      },
    });

    expect(metrics.npxG).toEqual({
      total: 8,
      per90: 0.42,
      totalPercentile: 91,
      per90Percentile: 87,
      isRate: false,
      statFormat: 'number',
      suffix: '/90',
    });
  });

  it('parses base and advanced competition statistics', () => {
    const result = parseCompetitionStats({
      topStatCard: {
        items: [
          { localizedTitleId: 'matches_uppercase', statValue: 12 },
          { localizedTitleId: 'minutes_played', statValue: 820 },
          { localizedTitleId: 'goals', statValue: 4 },
          { localizedTitleId: 'assists', statValue: 3 },
          { localizedTitleId: 'rating', statValue: 7.21 },
        ],
      },
      statsSection: {
        items: [{
          items: [{
            localizedTitleId: 'recoveries',
            title: 'Recoveries',
            statValue: 54,
            per90: 5.93,
            percentileRank: 72,
            percentileRankPer90: 76,
          }],
        }],
      },
    });

    expect(result).toMatchObject({
      matches: 12,
      minutes: 820,
      goals: 4,
      assists: 3,
      rating: 7.21,
      hasAdvancedStats: true,
    });
    expect(result.advancedMetrics.recoveries.per90).toBe(5.93);
  });

  it('builds stable season entries from a player profile', () => {
    const seasons = transformPlayerData({
      primaryTeam: { teamName: 'Test FC' },
      mainLeague: {
        leagueId: 130,
        leagueName: 'MLS',
        season: '2026',
        stats: [
          { title: 'Matches', localizedTitleId: 'matches_uppercase', value: 10 },
          { title: 'Minutes played', localizedTitleId: 'minutes_played', value: 700 },
          { title: 'Rating', localizedTitleId: 'rating', value: 7.05 },
        ],
      },
      statSeasons: [{
        seasonName: '2026',
        tournaments: [{
          name: 'MLS',
          tournamentId: 130,
          entryId: '2026-130',
          hasDeepStats: true,
        }],
      }],
      careerHistory: { careerItems: { senior: { seasonEntries: [] } } },
    });

    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({
      seasonName: '2026',
      teamName: 'Test FC',
      leagueName: 'MLS',
      matches: 10,
      minutes: 700,
      rating: '7.05',
      defaultCompetitionId: '2026-130',
    });
  });
});
