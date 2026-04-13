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
  const roleRewards = {};

  if (args.level1RoleId !== undefined) {
    roleRewards[1] = args.level1RoleId || null;
  }

  if (args.verifiedRoleId !== undefined) {
    roleRewards[3] = args.verifiedRoleId || null;
  }

  if (args.regularRoleId !== undefined) {
    roleRewards[5] = args.regularRoleId || null;
  }

  if (args.starlightRoleId !== undefined) {
    roleRewards[10] = args.starlightRoleId || null;
  }

  const updateInput = {};

  if (args.enabled !== undefined) {
    updateInput.enabled = String(args.enabled) === 'true';
  }

  if (args.ignoredChannels !== undefined) {
    updateInput.ignoredChannelIds = parseCsv(args.ignoredChannels);
  }

  if (Object.keys(roleRewards).length > 0) {
    updateInput.roleRewards = roleRewards;
  }

  const settings = await updateGuildLevelingSettings(guild.id, {
    ...updateInput
  });

  console.log(`Configured leveling for guild ${discordGuildId}.`);
  console.log(JSON.stringify(settings, null, 2));
  await closePool();
})().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
