// import { useState, useEffect } from 'react';

// function usePlayerData(playerId) {
//   const [player, setPlayer] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     if (!playerId) return;

//     async function fetchPlayer() {
//       setLoading(true);
//       setError(null);
//       try {
//         // TODO: point this at whichever backend route/API you land on
//         // const response = await fetch(`https://www.fotmob.com/api/data/playerData?id=${playerId}`);
//         const response = await fetch(`/api-fotmob/api/data/playerData?id=${playerId}`);
//         if (!response.ok) throw new Error(`Request failed: ${response.status}`);
//         const raw = await response.json();

//         setPlayer(extractPlayerStats(raw)); // TODO: fill in once you know the real shape
//       } catch (err) {
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     }

//     fetchPlayer();
//   }, [playerId]);

//   return { player, loading, error };
// }

// // TODO: adjust field paths to match your actual API response

// function extractPlayerStats(raw) {
//   // playerInformation is an array of {title, value} pairs — find the one we want
//   const findInfo = (title) =>
//     raw.playerInformation?.find((info) => info.title === title)?.value?.fallback;

//   // mainLeague.stats follows the same {title, value} array pattern
//   const findLeagueStat = (title) =>
//     raw.mainLeague?.stats?.find((stat) => stat.title === title)?.value;

//   return {
//     name: raw.name,
//     photoUrl: `https://images.fotmob.com/image_resources/playerimages/${raw.id}.png`,
//     teamName: raw.primaryTeam?.teamName ?? 'Unknown',
//     position: raw.positionDescription?.primaryPosition?.label ?? 'Unknown',
//     marketValue: findInfo('Market value') ?? 'N/A',
//     leagueName: raw.mainLeague?.leagueName ?? 'N/A',
//     season: raw.mainLeague?.season ?? '',
//     rating: findLeagueStat('Rating') ?? 'N/A',
//     goals: findLeagueStat('Goals') ?? 0,
//     assists: findLeagueStat('Assists') ?? 0,
//   };
// }
// export default usePlayerData;








import { useState, useEffect } from 'react';

// Vite sets import.meta.env.PROD to true when you build the site for production
const isProd = import.meta.env.PROD;

function usePlayerData(playerId) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    if (!playerId) return;

    async function fetchPlayer() {
      setLoading(true);
      setError(null);
      try {
        const baseFotMobUrl = `https://www.fotmob.com/api/data/playerData?id=${playerId}`;
        
        // Use the public CORS proxy in production, and your local Vite proxy in development
        const fetchUrl = isProd 
          ? `https://corsproxy.io/?url=${encodeURIComponent(baseFotMobUrl)}`
          : `/api-fotmob/api/data/playerData?id=${playerId}`;

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const raw = await response.json();

        setPlayer(extractPlayerStats(raw)); 
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayer();
  }, [playerId]);

  return { player, loading, error };
}

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
    name: raw.name,
    photoUrl: `https://images.fotmob.com/image_resources/playerimages/${raw.id}.png`,
    teamName: raw.primaryTeam?.teamName ?? 'Unknown',
    position: raw.positionDescription?.primaryPosition?.label ?? 'Unknown',
    age: findInfo('Age') ?? 'N/A',
    height: cmToFeetInches(findInfoNumber('Height')),
    marketValue: findInfo('Market value') ?? 'N/A',
    leagueName: raw.mainLeague?.leagueName ?? 'N/A',
    season: raw.mainLeague?.season ?? '',
    rating: findLeagueStat('Rating') ?? 'N/A',
    matchesPlayed: findLeagueStat('Matches') ?? 0,
    goals: findLeagueStat('Goals') ?? 0,
    assists: findLeagueStat('Assists') ?? 0,
  };
}



export default usePlayerData;





// useEffect(() => {
//   if (!playerId) return;

//   async function fetchPlayer() {
//     setLoading(true);
//     setError(null);
//     try {
//       // Fetch the static JSON file from your own public folder
//       const response = await fetch(`/data/${playerId}.json`);
//       if (!response.ok) throw new Error(`Player data file not found`);
//       const raw = await response.json();

//       setPlayer(extractPlayerStats(raw));[cite: 5]
//     } catch (err) {
//       setError(err.message);[cite: 5]
//     } finally {
//       setLoading(false);[cite: 5]
//     }
//   }

//   fetchPlayer();[cite: 5]
  
// }, [playerId]);[cite: 5]