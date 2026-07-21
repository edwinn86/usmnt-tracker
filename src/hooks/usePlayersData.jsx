import { useState, useEffect } from 'react';

const isProd = import.meta.env.PROD;

function cmToFeetInches(cm) {
  if (!cm) return 'N/A';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function extractPlayerStats(raw) {
  const findInfo = (title) =>
    raw.playerInformation?.find((info) => info.title === title)?.value?.fallback;
  const findInfoNumber = (title) =>
    raw.playerInformation?.find((info) => info.title === title)?.value?.numberValue;
  const findLeagueStat = (title) =>
    raw.mainLeague?.stats?.find((stat) => stat.title === title)?.value;

  return {
    id: raw.id,
    name: raw.name,
    photoUrl: `https://images.fotmob.com/image_resources/playerimages/${raw.id}.png`,
    teamName: raw.primaryTeam?.teamName ?? 'Unknown',
    position: raw.positionDescription?.primaryPosition?.label ?? 'Unknown',
    age: findInfo('Age') ?? 'N/A',
    height: cmToFeetInches(findInfoNumber('Height')),
    marketValue: findInfo('Market value') ?? 'N/A',
    marketValueRaw: findInfoNumber('Market value') ?? 0, // used for sorting only
    leagueName: raw.mainLeague?.leagueName ?? 'N/A',
    season: raw.mainLeague?.season ?? '',
    rating: findLeagueStat('Rating') ?? 'N/A',
    matchesPlayed: findLeagueStat('Matches') ?? 0,
    goals: findLeagueStat('Goals') ?? 0,
    assists: findLeagueStat('Assists') ?? 0,
  };
}

async function fetchPlayer(playerId) {
  const baseFotMobUrl = `https://www.fotmob.com/api/data/playerData?id=${playerId}`;
  const fetchUrl = isProd
    ? `https://corsproxy.io/?url=${encodeURIComponent(baseFotMobUrl)}`
    : `/api-fotmob/api/data/playerData?id=${playerId}`;

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const raw = await response.json();
  return extractPlayerStats(raw);
}

function usePlayersData(playerIds) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerIds || playerIds.length === 0) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled(playerIds.map(fetchPlayer));
      const successful = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);

      successful.sort((a, b) => b.marketValueRaw - a.marketValueRaw); // highest value first

      if (cancelled) return;

      setPlayers(successful);
      const failedCount = results.length - successful.length;
      if (failedCount > 0) setError(`${failedCount} player(s) failed to load`);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [playerIds]);

  return { players, loading, error };
}

export default usePlayersData;