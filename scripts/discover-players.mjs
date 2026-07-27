const PROXY_URL = 'https://usmnt-fotmob-proxy.winring86.workers.dev';

// Broad starting set of leagues where US players commonly appear. Additional
// FotMob league IDs can be added here without changing the discovery logic.
const LEAGUES = [
  { id: 130, label: 'MLS' },
  { id: 47, label: 'Premier League' },
  { id: 48, label: 'Championship' },
  { id: 54, label: 'Bundesliga' },
  { id: 146, label: '2. Bundesliga' },
  { id: 87, label: 'LaLiga' },
  { id: 140, label: 'LaLiga 2' },
  { id: 55, label: 'Serie A' },
  { id: 86, label: 'Serie B' },
  { id: 53, label: 'Ligue 1' },
  { id: 110, label: 'Ligue 2' },
  { id: 57, label: 'Eredivisie' },
  { id: 61, label: 'Liga Portugal' },
  { id: 40, label: 'Belgian Pro League' },
  { id: 64, label: 'Scottish Premiership' },
  { id: 38, label: 'Austrian Bundesliga' },
  { id: 46, label: 'Danish Superliga' },
  { id: 59, label: 'Eliteserien' },
  { id: 67, label: 'Allsvenskan' },
  { id: 69, label: 'Swiss Super League' },
];

async function fetchFotMobJson(target) {
  const response = await fetch(`${PROXY_URL}/?url=${encodeURIComponent(target)}`);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${target}`);
  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function populatedLeague(league) {
  const initial = await fetchFotMobJson(
    `https://www.fotmob.com/api/data/leagues?id=${league.id}&ccode3=USA_MA`
  );
  const seasons = [
    initial.details?.selectedSeason,
    ...(initial.allAvailableSeasons ?? []),
  ].filter((season, index, all) => season && all.indexOf(season) === index);

  for (const season of seasons.slice(0, 3)) {
    const data = season === initial.details?.selectedSeason
      ? initial
      : await fetchFotMobJson(
        `https://www.fotmob.com/api/data/leagues?id=${league.id}&ccode3=USA_MA&season=${encodeURIComponent(season)}`
      );
    if (Array.isArray(data.stats?.players) && data.stats.players.length) {
      return { data, season };
    }
  }
  return null;
}

function statUrl(leagueData, title) {
  return leagueData.stats.players.find((stat) => stat.header === title)?.fetchAllUrl ?? null;
}

function statEntries(payload) {
  return payload.TopLists?.flatMap((list) => list.StatList ?? []) ?? [];
}

async function scanLeague(league) {
  const populated = await populatedLeague(league);
  if (!populated) return [];

  const minutesUrl = statUrl(populated.data, 'Minutes played');
  const ratingUrl = statUrl(populated.data, 'FotMob rating');
  if (!minutesUrl) return [];

  const [minutesPayload, ratingPayload] = await Promise.all([
    fetchFotMobJson(minutesUrl),
    ratingUrl ? fetchFotMobJson(ratingUrl) : Promise.resolve(null),
  ]);
  const ratings = new Map(
    statEntries(ratingPayload ?? {}).map((entry) => [Number(entry.ParticiantId), Number(entry.StatValue)])
  );

  return statEntries(minutesPayload)
    .filter((entry) => entry.ParticipantCountryCode === 'USA')
    .map((entry) => ({
      id: Number(entry.ParticiantId),
      name: entry.ParticipantName,
      teamName: entry.TeamName,
      leagueName: populated.data.details?.name ?? league.label,
      season: populated.season,
      minutes: Number(entry.MinutesPlayed ?? entry.StatValue ?? 0),
      matches: Number(entry.MatchesPlayed ?? entry.SubStatValue ?? 0),
      rating: ratings.get(Number(entry.ParticiantId)) ?? null,
    }));
}

export async function discoverMissingUsPlayers(
  existingIds,
  onProgress = () => {},
  { excludeLeagueIds = [] } = {}
) {
  const discovered = new Map();
  const leaguesToScan = LEAGUES.filter((league) => !excludeLeagueIds.includes(league.id));

  for (let index = 0; index < leaguesToScan.length; index += 1) {
    const league = leaguesToScan[index];
    onProgress({ current: index + 1, total: leaguesToScan.length, league: league.label });
    try {
      const players = await scanLeague(league);
      for (const player of players) {
        const current = discovered.get(player.id);
        if (!current || player.minutes > current.minutes) discovered.set(player.id, player);
      }
    } catch (error) {
      onProgress({
        current: index + 1,
        total: leaguesToScan.length,
        league: league.label,
        warning: error.message,
      });
    }
  }

  return [...discovered.values()]
    .filter((player) => !existingIds.has(player.id))
    .sort((a, b) => b.minutes - a.minutes || (b.rating ?? 0) - (a.rating ?? 0));
}

export async function enrichPlayerDetails(players) {
  return mapWithConcurrency(players, 8, async (player) => {
    try {
      const data = await fetchFotMobJson(
        `https://www.fotmob.com/api/data/playerData?id=${player.id}`
      );
      const ageInfo = data.playerInformation?.find((info) => info.title === 'Age')?.value;
      const marketValueInfo = data.playerInformation
        ?.find((info) => info.title === 'Market value')?.value;
      const age = Number(ageInfo?.numberValue ?? ageInfo?.fallback);
      const marketValueEur = Number(marketValueInfo?.numberValue);
      return {
        ...player,
        age: Number.isFinite(age) ? age : null,
        marketValueEur: Number.isFinite(marketValueEur) ? marketValueEur : null,
      };
    } catch {
      return { ...player, age: null, marketValueEur: null };
    }
  });
}
