import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  usmntPlayerIds,
  usmntProspectIds,
  usmntCuspIds,
  usmntDualIds,
} from '../src/data/usmntPlayerIds.js';

const PROXY_URL = 'https://usmnt-fotmob-proxy.winring86.workers.dev';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(PROJECT_ROOT, 'public', 'data');
const PLAYERS_DIR = path.join(DATA_ROOT, 'players');
const COMPETITIONS_DIR = path.join(DATA_ROOT, 'competitions');
const IMAGES_DIR = path.join(DATA_ROOT, 'player-images');
const PLAYER_IDS = [...new Set([
  ...usmntPlayerIds,
  ...usmntCuspIds,
  ...usmntProspectIds,
  ...usmntDualIds,
])];

const forceHistory = process.argv.includes('--refresh-history');

function competitionFilename(entryId) {
  return `${encodeURIComponent(String(entryId))}.json`;
}

async function fetchJson(target) {
  const response = await fetch(`${PROXY_URL}/?url=${encodeURIComponent(target)}`);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${target}`);
  return response.json();
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8');
  await fs.rename(temporary, destination);
}

async function pathExists(destination) {
  try {
    await fs.access(destination);
    return true;
  } catch {
    return false;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function snapshotImage(playerId) {
  const destination = path.join(IMAGES_DIR, `${playerId}.png`);
  if (await pathExists(destination)) return;

  const response = await fetch(
    `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
  );
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function competitionJobs(playerId, playerData) {
  const currentSeason = playerData.mainLeague?.season;
  return (playerData.statSeasons ?? []).flatMap((season) =>
    (season.tournaments ?? [])
      .filter((competition) => competition.hasDeepStats && competition.entryId)
      .map((competition) => ({
        playerId,
        entryId: competition.entryId,
        seasonName: season.seasonName,
        isCurrentSeason: season.seasonName === currentSeason,
      }))
  );
}

async function snapshotCompetition(job) {
  const directory = path.join(COMPETITIONS_DIR, String(job.playerId));
  const destination = path.join(directory, competitionFilename(job.entryId));
  const shouldReuseHistory = !forceHistory && !job.isCurrentSeason && await pathExists(destination);
  if (shouldReuseHistory) return { reused: true };

  const target = `https://www.fotmob.com/api/data/playerStats?playerId=${job.playerId}`
    + `&seasonId=${encodeURIComponent(job.entryId)}&isFirstSeason=false`;
  const payload = await fetchJson(target);
  await writeJsonAtomic(destination, payload);
  return { reused: false };
}

async function fetchExchangeRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
    const payload = await response.json();
    return Number(payload?.rates?.USD) || 1.14;
  } catch {
    return 1.14;
  }
}

async function main() {
  await Promise.all([
    fs.mkdir(PLAYERS_DIR, { recursive: true }),
    fs.mkdir(COMPETITIONS_DIR, { recursive: true }),
    fs.mkdir(IMAGES_DIR, { recursive: true }),
  ]);

  console.log(`Refreshing ${PLAYER_IDS.length} player snapshots...`);
  const playerSnapshots = await mapWithConcurrency(PLAYER_IDS, 6, async (playerId, index) => {
    const data = await fetchJson(`https://www.fotmob.com/api/data/playerData?id=${playerId}`);
    await writeJsonAtomic(path.join(PLAYERS_DIR, `${playerId}.json`), data);
    try {
      await snapshotImage(playerId);
    } catch (error) {
      console.warn(`  Image ${playerId}: ${error.message}`);
    }
    console.log(`  [${index + 1}/${PLAYER_IDS.length}] ${data.name ?? playerId}`);
    return { playerId, data };
  });

  const jobsByKey = new Map();
  for (const snapshot of playerSnapshots) {
    for (const job of competitionJobs(snapshot.playerId, snapshot.data)) {
      jobsByKey.set(`${job.playerId}:${job.entryId}`, job);
    }
  }
  const jobs = [...jobsByKey.values()];
  console.log(`Refreshing ${jobs.length} competition snapshots...`);

  let reusedHistory = 0;
  const warnings = [];
  await mapWithConcurrency(jobs, 6, async (job, index) => {
    try {
      const result = await snapshotCompetition(job);
      if (result.reused) reusedHistory += 1;
    } catch (error) {
      warnings.push(`${job.playerId}/${job.entryId}: ${error.message}`);
    }
    if ((index + 1) % 25 === 0 || index + 1 === jobs.length) {
      console.log(`  [${index + 1}/${jobs.length}] competitions processed`);
    }
  });

  console.log('Finalizing snapshots: fetching the EUR/USD exchange rate...');
  const exchangeRateEurToUsd = await fetchExchangeRate();

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    playerIds: PLAYER_IDS,
    exchangeRateEurToUsd,
    competitionSnapshots: jobs.length - warnings.length,
    reusedHistoricalSnapshots: reusedHistory,
    warnings,
  };
  console.log('Writing snapshot manifest...');
  await writeJsonAtomic(path.join(DATA_ROOT, 'manifest.json'), manifest);

  console.log(`Snapshot complete: ${PLAYER_IDS.length} players, ${jobs.length - warnings.length} competitions.`);
  if (warnings.length) {
    console.warn(`${warnings.length} competition snapshots failed; previous files were retained where available.`);
  }
}

main().catch((error) => {
  console.error(`Snapshot refresh failed: ${error.message}`);
  process.exitCode = 1;
});
