import { useState, useEffect } from 'react';

const isProd = import.meta.env.PROD;

function cmToFeetInches(cm) {
  if (!cm) return 'N/A';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

// 1. ADDED BACK: Currency formatting helper
function formatCurrencyUSD(eurAmount, exchangeRate = 1.14) {
  if (!eurAmount || isNaN(eurAmount)) return 'N/A';
  
  const usdAmount = eurAmount * exchangeRate;

  if (usdAmount >= 100_000_000) {
    return `$${Math.round(usdAmount / 1_000_000)}m`; // Yields $100m instead of $100.0m
  }

  if (usdAmount >= 1_000_000) {
    return `$${(usdAmount / 1_000_000).toFixed(1)}m`;
  } else if (usdAmount >= 1_000) {
    return `$${Math.round(usdAmount / 1_000)}k`;
  }
  
  return `$${Math.round(usdAmount)}`;
}

async function fetchExchangeRate() {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
    const data = await res.json();
    return data?.rates?.USD || 1.14;
  } catch {
    return 1.14; // Fallback immediately if offline/blocked
  }
}

function extractPlayerStats(raw, exchangeRate) {
  const findInfo = (title) =>
    raw.playerInformation?.find((info) => info.title === title)?.value?.fallback;
  const findInfoNumber = (title) =>
    raw.playerInformation?.find((info) => info.title === title)?.value?.numberValue;
  const findLeagueStat = (title) =>
    raw.mainLeague?.stats?.find((stat) => stat.title === title)?.value;

  const rawEurValue = findInfoNumber('Market value') ?? 0;

  return {
    id: raw.id,
    name: raw.name,
    photoUrl: `https://images.fotmob.com/image_resources/playerimages/${raw.id}.png`,
    teamName: raw.primaryTeam?.teamName ?? 'Unknown',
    position: raw.positionDescription?.primaryPosition?.label ?? 'Unknown',
    age: findInfo('Age') ?? 'N/A',
    height: cmToFeetInches(findInfoNumber('Height')),
    marketValue: formatCurrencyUSD(rawEurValue, exchangeRate),
    marketValueRaw: rawEurValue,
    leagueName: raw.mainLeague?.leagueName ?? 'N/A',
    season: raw.mainLeague?.season ?? '',
    rating: findLeagueStat('Rating') ?? 'N/A',
    matchesPlayed: findLeagueStat('Matches') ?? 0,
    goals: findLeagueStat('Goals') ?? 0,
    assists: findLeagueStat('Assists') ?? 0,
  };
}

async function fetchPlayer(playerId, exchangeRate) {
  const baseFotMobUrl = `https://www.fotmob.com/api/data/playerData?id=${playerId}`;
  const fetchUrl = isProd
    ? `https://corsproxy.io/?url=${encodeURIComponent(baseFotMobUrl)}`
    : `/api-fotmob/api/data/playerData?id=${playerId}`;

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const raw = await response.json();
  return extractPlayerStats(raw, exchangeRate);
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

      const exchangeRate = await fetchExchangeRate(); 

      const results = await Promise.allSettled(
        playerIds.map((id) => fetchPlayer(id, exchangeRate))
      );

      const successful = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);

      successful.sort((a, b) => b.marketValueRaw - a.marketValueRaw);

      if (cancelled) return;

      setPlayers(successful);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [playerIds]);

  return { players, loading, error };
}

export default usePlayersData;