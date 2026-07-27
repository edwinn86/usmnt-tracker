import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PROXY_URL = 'https://usmnt-fotmob-proxy.winring86.workers.dev';
const CURRENT_IDS_FILE = new URL('../src/data/usmntPlayerIds.js', import.meta.url);
const FIRST_NAME_EQUIVALENTS = [
  ['gio', 'giovanni'],
  ['joe', 'joseph'],
  ['josh', 'joshua'],
  ['tim', 'timothy'],
];

function normalize(value = '') {
  return value
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenScore(left, right) {
  const a = new Set(normalize(left).split(' ').filter(Boolean));
  const b = new Set(normalize(right).split(' ').filter(Boolean));
  const shared = [...a].filter((token) => b.has(token)).length;
  const total = new Set([...a, ...b]).size;
  return total ? shared / total : 0;
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + Number(left[i - 1] !== right[j - 1])
      );
      diagonal = above;
    }
  }
  return row[right.length];
}

function candidateScore(query, candidate) {
  const wanted = normalize(query);
  const found = normalize(candidate.name);
  if (wanted === found) return 100;
  if (wanted.includes(found) || found.includes(wanted)) return 85;
  const wantedParts = wanted.split(' ');
  const foundParts = found.split(' ');
  const explicitNicknameMatch = FIRST_NAME_EQUIVALENTS.some(
    (names) => names.includes(wantedParts[0]) && names.includes(foundParts[0])
  );
  const firstNamesMatch = explicitNicknameMatch
    || editDistance(wantedParts[0], foundParts[0]) <= 2
    || (wantedParts[0].length >= 3
    && (
      wantedParts[0].startsWith(foundParts[0])
      || foundParts[0].startsWith(wantedParts[0])
    ));
  const surnamesNearlyMatch = editDistance(wantedParts.at(-1), foundParts.at(-1)) <= 2;
  if (firstNamesMatch && surnamesNearlyMatch) return 92;
  return Math.round(tokenScore(wanted, found) * 70);
}

async function searchPlayers(query) {
  const target = `https://www.fotmob.com/api/data/search/suggest?term=${encodeURIComponent(query)}`;
  const response = await fetch(`${PROXY_URL}/?url=${encodeURIComponent(target)}`);
  if (!response.ok) throw new Error(`FotMob search failed (${response.status}) for "${query}"`);

  const groups = await response.json();
  const unique = new Map();
  for (const group of groups) {
    for (const suggestion of group.suggestions ?? []) {
      if (suggestion.type === 'player' && !unique.has(String(suggestion.id))) {
        unique.set(String(suggestion.id), suggestion);
      }
    }
  }
  return [...unique.values()];
}

export async function resolvePlayer(query) {
  let searchResults = await searchPlayers(query);
  let usedSurnameFallback = false;
  const normalizedQuery = normalize(query);
  const hasExactResult = searchResults.some(
    (candidate) => normalize(candidate.name) === normalizedQuery
  );
  const surname = normalizedQuery.split(' ').at(-1);
  if (!hasExactResult && surname && surname !== normalizedQuery) {
    const surnameResults = await searchPlayers(surname);
    const merged = new Map(
      [...searchResults, ...surnameResults].map((candidate) => [String(candidate.id), candidate])
    );
    searchResults = [...merged.values()];
    usedSurnameFallback = true;
  }

  const candidates = searchResults
    .map((candidate) => ({ ...candidate, matchScore: candidateScore(query, candidate) }))
    .sort((a, b) => b.matchScore - a.matchScore || (b.score ?? 0) - (a.score ?? 0));

  const best = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const exact = best && normalize(best.name) === normalize(query);
  const uniqueExact = exact && (!runnerUp || normalize(runnerUp.name) !== normalize(query));

  return {
    query,
    status: uniqueExact && !usedSurnameFallback ? 'automatic' : best ? 'review' : 'not-found',
    match: best && {
      id: Number(best.id),
      name: best.name,
      teamName: best.teamName ?? null,
      teamId: best.teamId ?? null,
      score: best.matchScore,
    },
    alternatives: candidates.slice(1, 4).map((candidate) => ({
      id: Number(candidate.id),
      name: candidate.name,
      teamName: candidate.teamName ?? null,
      score: candidate.matchScore,
    })),
  };
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

export async function currentPlayers() {
  const source = await fs.readFile(CURRENT_IDS_FILE, 'utf8');
  return [...source.matchAll(/^\s*(\d+)\s*,?\s*\/\/\s*(.+?)\s*$/gm)].map((match) => ({
    expectedId: Number(match[1]),
    query: match[2].trim(),
  }));
}

async function verifyCurrentRoster() {
  const players = await currentPlayers();
  const results = await mapWithConcurrency(players, 6, async (player) => {
    try {
      const result = await resolvePlayer(player.query);
      return {
        ...player,
        ...result,
        correct: result.match?.id === player.expectedId,
      };
    } catch (error) {
      return { ...player, status: 'error', correct: false, error: error.message };
    }
  });

  const correct = results.filter((result) => result.correct).length;
  const automatic = results.filter((result) => result.status === 'automatic').length;
  const review = results.filter((result) => result.status === 'review').length;
  const incorrectAutomatic = results.filter(
    (result) => result.status === 'automatic' && !result.correct
  );
  const unresolved = results.filter((result) => !result.correct);

  console.log(JSON.stringify({
    summary: {
      tested: results.length,
      correct,
      accuracy: `${((correct / results.length) * 100).toFixed(1)}%`,
      automatic,
      review,
      incorrectAutomatic: incorrectAutomatic.length,
      unresolved: unresolved.length,
    },
    unresolved,
  }, null, 2));

  if (incorrectAutomatic.length) process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--verify-current')) {
    await verifyCurrentRoster();
  } else if (args.length) {
    const results = await mapWithConcurrency(args, 4, resolvePlayer);
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.error('Usage: npm run resolve-ids -- "Player Name" [...names] | --verify-current');
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
