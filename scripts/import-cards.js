const path = require('node:path');
const { closePool } = require('../data/db');
const { readJsonFile } = require('../lib/json-file');
const { ensureGuild } = require('../repositories/guild-repository');
const { syncCardsForGuild } = require('../repositories/card-repository');

function parseArgs(argv) {
  const parsed = {};

  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      parsed[key.slice(2)] = value;
    }
  }

  return parsed;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const guildId = args.guildId || args.guild || process.env.SEED_GUILD_ID;
  const guildName = args.guildName || process.env.SEED_GUILD_NAME || 'Seeded Guild';
  const filePath = path.resolve(args.file || 'cards.json');

  if (!guildId) {
    throw new Error('Please provide --guildId=<discord guild id> when importing cards.');
  }

  const cards = readJsonFile(filePath, []);
  if (!Array.isArray(cards) || !cards.length) {
    throw new Error(`No cards found in ${filePath}.`);
  }

  const guild = await ensureGuild(guildId, guildName);
  const result = await syncCardsForGuild(guild.id, cards);

  console.log(
    `Synced ${result.importedCount} active cards for guild ${guildId} (${guildName}); retired ${result.retiredCount} cards from future pulls.`
  );
  await closePool();
})().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
