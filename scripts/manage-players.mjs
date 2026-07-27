import fs from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolvePlayer } from './resolve-player-ids.mjs';

const IDS_FILE = new URL('../src/data/usmntPlayerIds.js', import.meta.url);
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

function addPlayerToCategory(source, category, player) {
  const pattern = new RegExp(`(export const ${category.key} = \\[)([\\s\\S]*?)(\\n\\];)`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${category.key} in the roster file.`);

  let entries = match[2].replace(/\s+$/, '');
  entries = entries.replace(/(\d+)(\s*\/\/[^\n]*)$/, '$1,$2');
  const addition = `  ${player.id} // ${player.name}`;
  return source.replace(pattern, `$1${entries}\n${addition}$3`);
}

function candidateLabel(candidate) {
  return `${candidate.name} — ${candidate.teamName ?? 'No club listed'} (ID ${candidate.id})`;
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

async function main() {
  console.log('\nUSMNT Player Manager');
  console.log('Search results are never written without your confirmation.');

  try {
    while (true) {
      const action = await choose(
        'What would you like to do?',
        ['Verify or add a player', 'Exit'],
        false
      );
      if (action === 1) break;
      await verifyOrAddPlayer();
    }
  } finally {
    terminal.close();
  }
}

await main();
