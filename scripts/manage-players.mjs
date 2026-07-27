import fs from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolvePlayer } from './resolve-player-ids.mjs';
import { discoverMissingUsPlayers, enrichPlayerDetails } from './discover-players.mjs';

const IDS_FILE = new URL('../src/data/usmntPlayerIds.js', import.meta.url);
const EXCLUDE_MLS = process.argv.includes('--exclude-mls');
const CATEGORIES = [
  { key: 'usmntPlayerIds', label: 'First Team' },
  { key: 'usmntCuspIds', label: 'On the Cusp' },
  { key: 'usmntProspectIds', label: 'Prospects' },
  { key: 'usmntDualIds', label: 'Dual Nats' },
];

const terminal = createInterface({ input, output });

async function ask(prompt) {
  return (await terminal.question(prompt)).trim();
}

async function choose(prompt, options, allowCancel = true) {
  console.log(`\n${prompt}`);
  options.forEach((option, index) => console.log(`  ${index + 1}) ${option}`));
  if (allowCancel) console.log('  0) Cancel');

  while (true) {
    const answer = Number(await ask('Choose an option: '));
    if (allowCancel && answer === 0) return -1;
    if (Number.isInteger(answer) && answer >= 1 && answer <= options.length) return answer - 1;
    console.log('Please enter one of the listed numbers.');
  }
}

function findStoredPlayer(source, id) {
  for (const category of CATEGORIES) {
    const pattern = new RegExp(`export const ${category.key} = \\[([\\s\\S]*?)\\];`);
    const block = source.match(pattern)?.[1] ?? '';
    if (new RegExp(`^\\s*${id}\\s*,?`, 'm').test(block)) return category;
  }
  return null;
}

function playersInCategory(source, category) {
  const pattern = new RegExp(`export const ${category.key} = \\[([\\s\\S]*?)\\];`);
  const block = source.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/^\s*(\d+)\s*,?\s*\/\/\s*(.+?)\s*$/gm)].map((match) => ({
    id: Number(match[1]),
    name: match[2].trim(),
  }));
}

function allStoredIds(source) {
  return new Set(
    CATEGORIES.flatMap((category) => playersInCategory(source, category).map((player) => player.id))
  );
}

function addPlayerToCategory(source, category, player) {
  const pattern = new RegExp(`(export const ${category.key} = \\[)([\\s\\S]*?)(\\n\\];)`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${category.key} in the roster file.`);

  let entries = match[2].replace(/\s+$/, '');
  entries = entries.replace(/(\d+)(\s*\/\/[^\n]*)$/, '$1,$2');
  const addition = `  ${player.id} // ${player.name}`;
  return source.replace(pattern, `$1${entries}\n${addition}$3`);
}

function removePlayerFromCategory(source, category, player) {
  const categoryPattern = new RegExp(`(export const ${category.key} = \\[)([\\s\\S]*?)(\\n\\];)`);
  const match = source.match(categoryPattern);
  if (!match) throw new Error(`Could not find ${category.key} in the roster file.`);

  const playerPattern = new RegExp(
    `^[ \\t]*${player.id}[ \\t]*,?[ \\t]*\\/\\/[^\\r\\n]*(?:\\r?\\n|$)`,
    'm'
  );
  if (!playerPattern.test(match[2])) {
    throw new Error(`${player.name} was not found in ${category.label}.`);
  }

  const updatedEntries = match[2].replace(playerPattern, '');
  return source.replace(categoryPattern, `$1${updatedEntries}$3`);
}

function candidateLabel(candidate) {
  return `${candidate.name} — ${candidate.teamName ?? 'No club listed'} (ID ${candidate.id})`;
}

function formatMarketValue(value) {
  if (!Number.isFinite(value) || value <= 0) return 'N/A';
  if (value >= 100_000_000) return `$${Math.round(value / 1_000_000)}m`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  return `$${Math.round(value / 1_000)}k`;
}

async function snapshotExchangeRate() {
  try {
    const manifest = JSON.parse(
      await fs.readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8')
    );
    return Number(manifest.exchangeRateEurToUsd) || 1.14;
  } catch {
    return 1.14;
  }
}

async function selectCandidate(name) {
  console.log(`\nSearching FotMob for "${name}"...`);
  const result = await resolvePlayer(name);
  if (!result.match) {
    console.log('No FotMob player was found. Try the player’s full official name.');
    return null;
  }

  const candidates = [result.match, ...result.alternatives];
  console.log(
    result.status === 'automatic'
      ? 'One unique exact match was found.'
      : 'This match needs review. Check the club before continuing.'
  );
  const choice = await choose('Select the correct player:', candidates.map(candidateLabel));
  return choice < 0 ? null : candidates[choice];
}

async function verifyOrAddPlayer() {
  const name = await ask('\nPlayer name: ');
  if (!name) return;

  const candidate = await selectCandidate(name);
  if (!candidate) return;

  const source = await fs.readFile(IDS_FILE, 'utf8');
  const existingCategory = findStoredPlayer(source, candidate.id);
  if (existingCategory) {
    console.log(`\nAlready stored in ${existingCategory.label}: ${candidateLabel(candidate)}`);
    return;
  }

  const shouldAdd = (await ask('\nThis player is not in the roster. Add them? (y/N): ')).toLowerCase();
  if (shouldAdd !== 'y' && shouldAdd !== 'yes') {
    console.log('No changes made.');
    return;
  }

  const categoryIndex = await choose(
    'Where should this player go?',
    CATEGORIES.map((category) => category.label)
  );
  if (categoryIndex < 0) {
    console.log('No changes made.');
    return;
  }

  const category = CATEGORIES[categoryIndex];
  const confirmation = await ask(
    `\nAdd ${candidate.name} (ID ${candidate.id}) to ${category.label}? (y/N): `
  );
  if (!['y', 'yes'].includes(confirmation.toLowerCase())) {
    console.log('No changes made.');
    return;
  }

  const updatedSource = addPlayerToCategory(source, category, candidate);
  await fs.writeFile(IDS_FILE, updatedSource, 'utf8');
  console.log(`\nAdded ${candidate.name} to ${category.label}.`);
}

async function addDiscoveredPlayer(player) {
  const source = await fs.readFile(IDS_FILE, 'utf8');
  const existingCategory = findStoredPlayer(source, player.id);
  if (existingCategory) {
    console.log(`\n${player.name} is already stored in ${existingCategory.label}.`);
    return false;
  }

  const categoryIndex = await choose(
    `Where should ${player.name} go?`,
    CATEGORIES.map((category) => category.label)
  );
  if (categoryIndex < 0) return false;

  const category = CATEGORIES[categoryIndex];
  const confirmation = await ask(
    `\nAdd ${player.name} (ID ${player.id}) to ${category.label}? (y/N): `
  );
  if (!['y', 'yes'].includes(confirmation.toLowerCase())) {
    console.log('No changes made.');
    return false;
  }

  await fs.writeFile(IDS_FILE, addPlayerToCategory(source, category, player), 'utf8');
  console.log(`\nAdded ${player.name} to ${category.label}.`);
  return true;
}

async function findMissingPlayers() {
  const excludeProspectsAnswer = await ask('\nExclude under-21 prospects? (y/N): ');
  const excludeProspects = ['y', 'yes'].includes(excludeProspectsAnswer.toLowerCase());

  let parsedMinutes = 450;
  let parsedYouthMinutes = 180;
  const customMinutes = await ask('Use custom minimum minutes? (y/N): ');
  if (['y', 'yes'].includes(customMinutes.toLowerCase())) {
    const minutesAnswer = await ask('Senior minimum minutes [450]: ');
    parsedMinutes = minutesAnswer ? Number(minutesAnswer) : 450;
    if (!excludeProspects) {
      const youthMinutesAnswer = await ask('Under-21 minimum minutes [180]: ');
      parsedYouthMinutes = youthMinutesAnswer ? Number(youthMinutesAnswer) : 180;
    }
  } else {
    console.log(
      excludeProspects
        ? 'Using 450 minimum minutes.'
        : 'Using 450 senior minutes and 180 under-21 minutes.'
    );
  }
  if (
    !Number.isFinite(parsedMinutes)
    || parsedMinutes < 0
    || !Number.isFinite(parsedYouthMinutes)
    || parsedYouthMinutes < 0
  ) {
    console.log('Minimum minutes must be zero or a positive number.');
    return;
  }

  let parsedRating = 6.8;
  const customRating = await ask('Use a custom minimum rating? (y/N): ');
  if (['y', 'yes'].includes(customRating.toLowerCase())) {
    const ratingAnswer = await ask('Minimum FotMob rating [6.80]: ');
    parsedRating = ratingAnswer ? Number(ratingAnswer) : 6.8;
  } else {
    console.log('Using a 6.80 minimum rating.');
  }
  if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 10) {
    console.log('Minimum rating must be between 0 and 10.');
    return;
  }

  let minimumMarketValueUsd = 0;
  const filterByMarketValue = await ask('Filter by a minimum market value? (y/N): ');
  if (['y', 'yes'].includes(filterByMarketValue.toLowerCase())) {
    const marketValueAnswer = await ask('Minimum market value in USD [1000000]: ');
    minimumMarketValueUsd = marketValueAnswer ? Number(marketValueAnswer) : 1_000_000;
    if (!Number.isFinite(minimumMarketValueUsd) || minimumMarketValueUsd < 0) {
      console.log('Minimum market value must be zero or a positive number.');
      return;
    }
  } else {
    console.log('No minimum market value filter will be applied.');
  }

  const limitAnswer = await ask('Maximum recommendations [30]: ');
  const parsedLimit = limitAnswer ? Number(limitAnswer) : 30;
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    console.log('Maximum recommendations must be a positive whole number.');
    return;
  }

  const source = await fs.readFile(IDS_FILE, 'utf8');
  console.log(
    EXCLUDE_MLS
      ? '\nScanning US players across supported leagues (MLS excluded)...'
      : '\nScanning US players across supported leagues...'
  );
  const missing = await discoverMissingUsPlayers(allStoredIds(source), (progress) => {
    const suffix = progress.warning ? ' (skipped)' : '';
    console.log(`  [${progress.current}/${progress.total}] ${progress.league}${suffix}`);
  }, { excludeLeagueIds: EXCLUDE_MLS ? [130] : [] });
  const establishedQualifiers = missing.filter(
    (player) => player.minutes >= parsedMinutes
      && (parsedRating === 0 || (player.rating ?? 0) >= parsedRating)
  );
  const establishedIds = new Set(establishedQualifiers.map((player) => player.id));
  const potentialYouth = excludeProspects
    ? []
    : missing.filter(
      (player) => player.minutes >= parsedYouthMinutes && !establishedIds.has(player.id)
    );
  let youthQualifiers = [];
  if (potentialYouth.length) {
    console.log(`\nChecking ages for ${potentialYouth.length} potential youth exceptions...`);
    youthQualifiers = (await enrichPlayerDetails(potentialYouth))
      .filter((player) => player.age !== null && player.age < 21);
  }

  let establishedWithAges = establishedQualifiers.map(
    (player) => ({ ...player, age: null, youthException: false })
  );
  if (establishedWithAges.length) {
    console.log(`\nLoading ages and market values for ${establishedWithAges.length} qualifying players...`);
    establishedWithAges = (await enrichPlayerDetails(establishedWithAges))
      .filter((player) => !excludeProspects || player.age === null || player.age >= 21)
      .map((player) => ({ ...player, youthException: false }));
  }

  const exchangeRate = await snapshotExchangeRate();
  const recommendations = [
    ...youthQualifiers.map((player) => ({ ...player, youthException: true })),
    ...establishedWithAges,
  ]
    .map((player) => ({
      ...player,
      marketValueUsd: Number.isFinite(player.marketValueEur)
        ? player.marketValueEur * exchangeRate
        : null,
    }))
    .filter(
      (player) => minimumMarketValueUsd === 0
        || (player.marketValueUsd ?? 0) >= minimumMarketValueUsd
    )
    .sort((a, b) => {
      return (b.marketValueUsd ?? 0) - (a.marketValueUsd ?? 0)
        || b.minutes - a.minutes
        || (b.rating ?? 0) - (a.rating ?? 0)
        || a.name.localeCompare(b.name);
    })
    .slice(0, parsedLimit);

  if (!recommendations.length) {
    const thresholds = excludeProspects
      ? `${parsedMinutes}+ minutes, ${parsedRating.toFixed(2)}+ rating, age 21+`
      : `seniors (${parsedMinutes}+ min, ${parsedRating.toFixed(2)}+ rating)`
        + ` or under-21 players (${parsedYouthMinutes}+ min)`;
    const valueThreshold = minimumMarketValueUsd
      ? ` and ${formatMarketValue(minimumMarketValueUsd)}+ market value`
      : '';
    console.log(`\nNo missing US players met the selected thresholds: ${thresholds}${valueThreshold}.`);
    return;
  }

  while (recommendations.length) {
    const thresholdLabel = excludeProspects
      ? `${parsedMinutes}+ min / ${parsedRating.toFixed(2)}+ rating / age 21+`
      : `senior ${parsedMinutes}+ min / ${parsedRating.toFixed(2)}+ rating; U21 ${parsedYouthMinutes}+ min`;
    const marketValueLabel = minimumMarketValueUsd
      ? ` / ${formatMarketValue(minimumMarketValueUsd)}+ value`
      : '';
    const playerIndex = await choose(
      `Top missing US players (${thresholdLabel}${marketValueLabel}):`,
      recommendations.map((player) => {
        const rating = player.rating ? ` · ${player.rating.toFixed(2)} rating` : '';
        const age = ` · age ${player.age ?? 'N/A'}${player.youthException ? ' (youth exception)' : ''}`;
        const marketValue = ` · ${formatMarketValue(player.marketValueUsd)} value`;
        return `${player.name} — ${player.teamName} · ${player.leagueName} · ${player.minutes} min${rating}${age}${marketValue}`;
      })
    );
    if (playerIndex < 0) return;

    const [player] = recommendations.splice(playerIndex, 1);
    console.log(
      `\n${player.name}\n`
      + `  Club: ${player.teamName}\n`
      + `  Competition: ${player.leagueName} (${player.season})\n`
      + `  Matches: ${player.matches}\n`
      + `  Minutes: ${player.minutes}\n`
      + `  Rating: ${player.rating?.toFixed(2) ?? 'N/A'}\n`
      + `  Age: ${player.age ?? 'N/A'}\n`
      + `  Market value: ${formatMarketValue(player.marketValueUsd)}\n`
      + `  FotMob ID: ${player.id}`
    );
    const shouldAdd = await ask('\nAdd this player to the roster? (y/N): ');
    if (['y', 'yes'].includes(shouldAdd.toLowerCase())) {
      await addDiscoveredPlayer(player);
    }
  }
}

async function removePlayer() {
  const categoryIndex = await choose(
    'Which roster should the player be removed from?',
    CATEGORIES.map((category) => category.label)
  );
  if (categoryIndex < 0) return;

  const category = CATEGORIES[categoryIndex];
  const source = await fs.readFile(IDS_FILE, 'utf8');
  const players = playersInCategory(source, category);
  if (!players.length) {
    console.log(`\nThere are no players in ${category.label}.`);
    return;
  }

  const playerIndex = await choose(
    `Select a player to remove from ${category.label}:`,
    players.map((player) => `${player.name} (ID ${player.id})`)
  );
  if (playerIndex < 0) return;

  const player = players[playerIndex];
  const confirmation = await ask(
    `\nRemove ${player.name} (ID ${player.id}) from ${category.label}? (y/N): `
  );
  if (!['y', 'yes'].includes(confirmation.toLowerCase())) {
    console.log('No changes made.');
    return;
  }

  const updatedSource = removePlayerFromCategory(source, category, player);
  await fs.writeFile(IDS_FILE, updatedSource, 'utf8');
  console.log(`\nRemoved ${player.name} from ${category.label}.`);
}

async function main() {
  console.log('\nUSMNT Player Manager');
  console.log('Search results are never written without your confirmation.');

  try {
    if (process.argv.includes('--discover')) {
      await findMissingPlayers();
      return;
    }

    while (true) {
      const action = await choose(
        'What would you like to do?',
        ['Verify or add a player', 'Remove a player', 'Find missing US players', 'Exit'],
        false
      );
      if (action === 3) break;
      if (action === 0) await verifyOrAddPlayer();
      if (action === 1) await removePlayer();
      if (action === 2) await findMissingPlayers();
    }
  } finally {
    terminal.close();
  }
}

await main();
