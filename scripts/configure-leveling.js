const { closePool } = require('../data/db');
const { ensureGuild } = require('../repositories/guild-repository');
const { updateGuildLevelingSettings } = require('../repositories/guild-leveling-settings-repository');

function parseArgs(argv) {
  const parsed = {};

  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      parsed[key.slice(2)] = value === undefined ? true : value;
    }
  }

  return parsed;
}

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const discordGuildId = args.guildId || args.guild;
  const guildName = args.guildName || 'Configured Guild';

  if (!discordGuildId) {
    throw new Error('Please provide --guildId=<discord guild id>.');
  }

  const guild = await ensureGuild(String(discordGuildId), guildName);
  const settings = await updateGuildLevelingSettings(guild.id, {
    enabled: args.enabled === undefined ? true : String(args.enabled) === 'true',
    ignoredChannelIds: parseCsv(args.ignoredChannels),
    roleRewards: {
      1: args.level1RoleId || null,
      3: args.verifiedRoleId || null,
      5: args.regularRoleId || null,
      10: args.starlightRoleId || null
    }
  });

  console.log(`Configured leveling for guild ${discordGuildId}.`);
  console.log(JSON.stringify(settings, null, 2));
  await closePool();
})().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
