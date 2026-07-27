import { useState, useEffect } from 'react';

const CF_WORKER_URL = 'https://usmnt-fotmob-proxy.winring86.workers.dev';
// Snapshot data is the safe default in every environment. Live FotMob requests
// must be enabled explicitly with VITE_DATA_MODE=live.
const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'snapshot';
const USE_SNAPSHOTS = DATA_MODE === 'snapshot';
const SNAPSHOT_BASE = `${import.meta.env.BASE_URL}data`;

// FotMob's career and current-season payloads use slightly different shapes.
function parseRating(entry, mainLeagueStats = []) {
  if (entry?.rating != null) {
    if (typeof entry.rating === 'object' && entry.rating.num != null) {
      const r = parseFloat(entry.rating.num);
      if (!isNaN(r) && r > 0) return r.toFixed(2);
    }
    if (typeof entry.rating === 'number' && entry.rating > 0) {
      return entry.rating.toFixed(2);
    }
    if (typeof entry.rating === 'string') {
      const r = parseFloat(entry.rating);
      if (!isNaN(r) && r > 0) return r.toFixed(2);
    }
  }

  const ratingItem = mainLeagueStats.find(
    (s) =>
      s.title?.toLowerCase().includes('rating') ||
      s.localizedTitleId?.toLowerCase().includes('rating')
  );
  if (ratingItem && ratingItem.value != null) {
    const r = parseFloat(ratingItem.value);
    if (!isNaN(r) && r > 0) return r.toFixed(2);
  }

  return 'N/A';
}

function parseCards(entry, cardType, mainLeagueStats = []) {
  const isYellow = cardType === 'yellow';

  if (isYellow) {
    if (entry?.yellowCards != null) return Number(entry.yellowCards);
    if (entry?.yellow_cards != null) return Number(entry.yellow_cards);
    if (entry?.cards?.yellow != null) return Number(entry.cards.yellow);
  } else {
    if (entry?.redCards != null) return Number(entry.redCards);
    if (entry?.red_cards != null) return Number(entry.red_cards);
    if (entry?.cards?.red != null) return Number(entry.cards.red);
  }

  const targetLabel = isYellow ? 'yellow' : 'red';
  const cardItem = mainLeagueStats.find(
    (s) =>
      s.title?.toLowerCase().includes(targetLabel) ||
      s.localizedTitleId?.toLowerCase().includes(targetLabel)
  );
  if (cardItem && cardItem.value != null) {
    return Number(cardItem.value);
  }

  return 0;
}

function normalizeStatName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findStat(stats, ...keys) {
  const normalizedKeys = keys.map(normalizeStatName);
  return stats.find((stat) => {
    const candidates = [stat.localizedTitleId, stat.title].map(normalizeStatName);
    return candidates.some((candidate) => normalizedKeys.includes(candidate));
  });
}

function metricFromStat(stat, { per90 = true, suffix = '/90' } = {}) {
  if (!stat) return null;

  const total = Number(stat.statValue);
  const per90Value = Number(stat.per90);
  const defaultValue = per90 ? per90Value : total;
  if (!Number.isFinite(defaultValue)) return null;

  const totalPercentile = Number(stat.percentileRank);
  const per90Percentile = Number(stat.percentileRankPer90 ?? stat.percentileRank);

  return {
    total: Number.isFinite(total) ? total : defaultValue,
    per90: Number.isFinite(per90Value) ? per90Value : defaultValue,
    totalPercentile: Number.isFinite(totalPercentile) ? Math.round(totalPercentile) : null,
    per90Percentile: Number.isFinite(per90Percentile) ? Math.round(per90Percentile) : null,
    isRate: !per90,
    statFormat: stat.statFormat || (suffix === '%' ? 'percent' : 'number'),
    suffix,
  };
}

// Normalize source-specific names into a stable card metric set.
export function parseAdvancedMetrics(firstSeasonStats) {
  const groups = firstSeasonStats?.statsSection?.items || firstSeasonStats?.statsSections || [];
  const stats = groups.flatMap((group) => group.items || group.stats || []);
  if (!stats.length) return {};

  const get = (keys, options) => metricFromStat(findStat(stats, ...keys), options);
  const metrics = {
    npxG: get(['non_penalty_xg', 'xg excl. penalty']),
    xGOT: get(['expected_goals_on_target', 'xgot']),
    xA: get(['expected_assists', 'xa']),
    shotsOnTarget: get(['ShotsOnTarget', 'shots_on_target', 'shots on target']),
    dribbles: get(['dribbles_succeeded', 'dribbles', 'successful dribbles']),
    touchesOppBox: get(['touches_opp_box', 'touches in opposition box']),
    chancesCreated: get(['chances_created', 'key_passes', 'chances created']),
    passAccuracy: get(['successful_passes_accuracy', 'pass accuracy'], { per90: false, suffix: '%' }),
    accurateLongBalls: get(['long_balls_accurate', 'accurate long balls']),
    tackles: get(['matchstats.headers.tackles', 'tackles']),
    recoveries: get(['recoveries']),
    aerialsWonPct: get(['aerials_won_percent', 'aerials won %'], { per90: false, suffix: '%' }),
    longBallAccuracy: get(['long_ball_succeeeded_accuracy', 'long ball accuracy'], { per90: false, suffix: '%' }),
    clearances: get(['clearances']),
    successfulCrosses: get(['crosses_succeeeded', 'successful crosses']),
    crossAccuracy: get(['crosses_succeeeded_accuracy', 'cross accuracy'], { per90: false, suffix: '%' }),
    goalsPrevented: get(['goals_prevented', 'psxg_minus_goals_allowed'], { per90: false, suffix: '' }),
    psxgPerShot: get(['post_shot_xg_per_shot', 'psxg_per_shot'], { per90: false, suffix: '' }),
    crossesStoppedPct: get(['crosses_stopped_percentage', 'crosses_stopped_pct'], { per90: false, suffix: '%' }),
    sweeperActions: get(['sweeper_actions']),
  };

  return Object.fromEntries(Object.entries(metrics).filter(([, metric]) => metric));
}

export function parseFullStatGroups(payload) {
  const groups = payload?.statsSection?.items || payload?.statsSections || [];

  return groups
    .map((group) => ({
      title: group.title || group.localizedTitleId || 'Other',
      metrics: (group.items || group.stats || [])
        .map((stat) => ({
          key: stat.localizedTitleId || stat.title,
          label: stat.title || stat.localizedTitleId || 'Metric',
          ...metricFromStat(stat, {
            per90: stat.statFormat !== 'percent',
            suffix: stat.statFormat === 'percent' ? '%' : '/90',
          }),
        }))
        .filter((metric) => Number.isFinite(metric.total) || Number.isFinite(metric.per90)),
    }))
    .filter((group) => group.metrics.length > 0);
}

function statValue(stats, ...keys) {
  const stat = findStat(stats, ...keys);
  return stat?.statValue ?? stat?.value ?? null;
}

export function parseCompetitionStats(payload) {
  const topStats = payload?.topStatCard?.items || [];
  const sectionStats = (payload?.statsSection?.items || [])
    .flatMap((group) => group.items || group.stats || []);
  const allStats = [...topStats, ...sectionStats];
  const advancedMetrics = parseAdvancedMetrics(payload);
  const fullStatGroups = parseFullStatGroups(payload);

  return {
    matches: Number(statValue(topStats, 'matches_uppercase', 'matches')) || 0,
    minutes: Number(statValue(topStats, 'minutes_played', 'minutes')) || 0,
    goals: Number(statValue(topStats, 'goals')) || 0,
    assists: Number(statValue(topStats, 'assists')) || 0,
    rating: statValue(topStats, 'rating') ?? 'N/A',
    cleanSheets: Number(statValue(allStats, 'clean_sheet_team_title', 'clean sheets')) || 0,
    savePct: statValue(allStats, 'save_percentage', 'save percentage'),
    yellowCards: Number(statValue(allStats, 'yellow_cards')) || 0,
    redCards: Number(statValue(allStats, 'red_cards')) || 0,
    advancedMetrics,
    fullStatGroups,
    hasAdvancedStats: Object.keys(advancedMetrics).length > 0,
  };
}

export async function fetchCompetitionStats(playerId, entryId) {
  const response = USE_SNAPSHOTS
    ? await fetch(
      `${SNAPSHOT_BASE}/competitions/${playerId}/${encodeURIComponent(String(entryId))}.json`
    )
    : await fetch(
      `${CF_WORKER_URL}/?url=${encodeURIComponent(
        `https://www.fotmob.com/api/data/playerStats?playerId=${playerId}&seasonId=${entryId}&isFirstSeason=false`
      )}`
    );
  if (!response.ok) throw new Error(`Failed fetching competition stats: ${response.status}`);
  return parseCompetitionStats(await response.json());
}

export function transformPlayerData(raw) {
  if (!raw) return [];

  const mainLeagueStats = raw.mainLeague?.stats || [];
  const findMainLeagueStat = (title) =>
    mainLeagueStats.find((stat) =>
      stat.title?.toLowerCase() === title || stat.localizedTitleId?.toLowerCase() === title
    )?.value;
  const currentSeasonName = raw.mainLeague?.season || raw.statSeasons?.[0]?.seasonName || '';
  const rawEntries = raw.careerHistory?.careerItems?.senior?.seasonEntries || [];
  const seasonDefinitions = (raw.statSeasons || []).map((season) => ({
    ...season,
    tournaments: [...(season.tournaments || [])],
  }));

  // FotMob lists the World Cup under a calendar year (for example, 2026),
  // even though it belongs in the surrounding club season for this UI.
  // Move only the tournament itself; calendar-year domestic seasons (MLS, etc.)
  // remain untouched.
  seasonDefinitions.forEach((calendarSeason) => {
    if (!/^\d{4}$/.test(calendarSeason.seasonName || '')) return;

    const worldCupTournaments = calendarSeason.tournaments.filter(
      (tournament) => /^World Cup$/i.test(tournament.name || '')
    );
    if (!worldCupTournaments.length) return;

    const clubSeason = seasonDefinitions.find(
      (season) => season.seasonName === `${Number(calendarSeason.seasonName) - 1}/${calendarSeason.seasonName}`
    );
    if (!clubSeason) return;

    clubSeason.tournaments.push(...worldCupTournaments);
    calendarSeason.tournaments = calendarSeason.tournaments.filter(
      (tournament) => !worldCupTournaments.includes(tournament)
    );
    calendarSeason.worldCupMerged = true;
  });

  rawEntries.forEach((entry) => {
    if (entry.seasonName && !seasonDefinitions.some((season) => season.seasonName === entry.seasonName)) {
      seasonDefinitions.push({ seasonName: entry.seasonName, tournaments: [] });
    }
  });

  return seasonDefinitions.filter((season) => !season.worldCupMerged || season.tournaments.length > 0).map((season) => {
    const historyRows = rawEntries.filter((entry) => entry.seasonName === season.seasonName);
    const isCurrentSeason = season.seasonName === currentSeasonName;
    const sum = (keys) => historyRows.reduce((total, entry) => {
      const value = keys.map((key) => entry?.[key]).find((candidate) => candidate != null);
      return total + (Number(value) || 0);
    }, 0);
    const competitions = (season.tournaments || []).map((tournament) => ({
      name: tournament.name,
      tournamentId: tournament.tournamentId,
      entryId: tournament.entryId,
      hasDeepStats: Boolean(tournament.hasDeepStats),
    }));
    const defaultCompetition = competitions.find(
      (competition) => competition.tournamentId === raw.mainLeague?.leagueId
    ) || competitions.find((competition) => competition.hasDeepStats) || competitions[0];
    const representativeEntry = historyRows[0] || {};

    return {
      seasonName: season.seasonName,
      isCurrentSeason,
      teamName: isCurrentSeason
        ? raw.primaryTeam?.teamName || 'N/A'
        : representativeEntry.teamName || representativeEntry.team || raw.primaryTeam?.teamName || 'N/A',
      leagueName: isCurrentSeason ? raw.mainLeague?.leagueName || 'N/A' : representativeEntry.leagueName || 'Season totals',
      matches: isCurrentSeason ? Number(findMainLeagueStat('matches_uppercase') ?? findMainLeagueStat('matches')) || 0 : sum(['appearances', 'matches']),
      minutes: isCurrentSeason ? Number(findMainLeagueStat('minutes played') ?? findMainLeagueStat('minutes_played')) || 0 : sum(['minutesPlayed', 'minutes']),
      goals: isCurrentSeason ? Number(findMainLeagueStat('goals')) || 0 : sum(['goals']),
      assists: isCurrentSeason ? Number(findMainLeagueStat('assists')) || 0 : sum(['assists']),
      cleanSheets: isCurrentSeason ? Number(findMainLeagueStat('clean sheets')) || 0 : sum(['cleanSheets']),
      savePct: isCurrentSeason ? findMainLeagueStat('save percentage') : representativeEntry.savePercentage ?? representativeEntry.savePct ?? null,
      rating: parseRating(representativeEntry, isCurrentSeason ? mainLeagueStats : []),
      yellowCards: historyRows.reduce((total, entry) => total + parseCards(entry, 'yellow'), 0),
      redCards: historyRows.reduce((total, entry) => total + parseCards(entry, 'red'), 0),
      competitions,
      defaultCompetitionId: defaultCompetition?.entryId || '',
      advancedMetrics: {},
      hasAdvancedStats: false,
    };
  });
}

function cmToFeetInches(cm) {
  if (!cm) return 'N/A';
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

function formatCurrencyUSD(eurAmount, exchangeRate = 1.14) {
  const value = Number(eurAmount);
  if (!Number.isFinite(value) || value <= 0) return 'N/A';
  const usdAmount = value * exchangeRate;
  if (usdAmount >= 100_000_000) return `$${Math.round(usdAmount / 1_000_000)}m`;
  if (usdAmount >= 1_000_000) return `$${(usdAmount / 1_000_000).toFixed(1)}m`;
  return `$${Math.round(usdAmount / 1_000)}k`;
}

async function fetchExchangeRate() {
  if (USE_SNAPSHOTS) {
    try {
      const response = await fetch(`${SNAPSHOT_BASE}/manifest.json`);
      if (!response.ok) throw new Error(`Snapshot manifest unavailable: ${response.status}`);
      const manifest = await response.json();
      return Number(manifest.exchangeRateEurToUsd) || 1.14;
    } catch {
      return 1.14;
    }
  }

  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
    const data = await response.json();
    return data?.rates?.USD || 1.14;
  } catch {
    return 1.14;
  }
}

export function usePlayersData(playerIds = []) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerIds || playerIds.length === 0) {
      return;
    }

    let isMounted = true;

    async function fetchAllPlayers() {
      try {
        const exchangeRate = await fetchExchangeRate();
        const results = await Promise.all(
          playerIds.map(async (id) => {
            const res = USE_SNAPSHOTS
              ? await fetch(`${SNAPSHOT_BASE}/players/${id}.json`)
              : await fetch(
                `${CF_WORKER_URL}/?url=${encodeURIComponent(
                  `https://www.fotmob.com/api/data/playerData?id=${id}`
                )}`
              );
            
            if (!res.ok) {
              const source = USE_SNAPSHOTS ? 'snapshot' : 'FotMob';
              throw new Error(`Failed fetching ${source} data for player ID: ${id}`);
            }

            const rawData = await res.json();
            const seasonEntries = transformPlayerData(rawData);
            const playerInfo = rawData.playerInformation || [];
            const getInfo = (title) => playerInfo.find((info) => info.title === title)?.value;
            const currentStats = rawData.mainLeague?.stats || [];
            const getLeagueStat = (title) => currentStats.find((stat) => stat.title === title)?.value;

            return {
              id,
              name: rawData.name || rawData.playerInformation?.name || 'Unknown Player',
              position: rawData.positionDescription?.primaryPosition?.label || rawData.playerInformation?.position?.label || 'N/A',
              teamName: rawData.primaryTeam?.teamName || rawData.mainLeague?.teamName || 'N/A',
              photoUrl: USE_SNAPSHOTS
                ? `${SNAPSHOT_BASE}/player-images/${id}.png`
                : `https://images.fotmob.com/image_resources/playerimages/${id}.png`,
              age: getInfo('Age')?.fallback ?? 'N/A',
              height: cmToFeetInches(getInfo('Height')?.numberValue),
              marketValue: formatCurrencyUSD(getInfo('Market value')?.numberValue, exchangeRate),
              marketValueAmount: Number(getInfo('Market value')?.numberValue) * exchangeRate || 0,
              leagueName: rawData.mainLeague?.leagueName || 'N/A',
              rating: getLeagueStat('Rating') ?? 'N/A',
              matchesPlayed: getLeagueStat('Matches') ?? 0,
              goals: getLeagueStat('Goals') ?? 0,
              assists: getLeagueStat('Assists') ?? 0,
              season: rawData.mainLeague?.season || seasonEntries[0]?.seasonName || '',
              availableSeasons: [...new Set(seasonEntries.map((entry) => entry.seasonName).filter(Boolean))],
              seasonEntries
            };
          })
        );

        if (isMounted) {
          setPlayers(results);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchAllPlayers();

    return () => {
      isMounted = false;
    };
  }, [playerIds]);

  return { players, loading, error };
}

export default usePlayersData;
