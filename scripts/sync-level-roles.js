const { Client, Events, GatewayIntentBits } = require('discord.js');
const { closePool } = require('../data/db');
const { ensureGuild, findGuildByDiscordId } = require('../repositories/guild-repository');
const { getProfilesByGuildId, getLevelingGuildsWithProfiles } = require('../repositories/leveling-repository');
const { getEnabledGuildLevelingSettings } = require('../repositories/guild-leveling-settings-repository');
const { applyRoleRewards } = require('../services/leveling-service');
const { getRequiredEnv } = require('../lib/env');

const token = getRequiredEnv('DISCORD_TOKEN');

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once(Events.ClientReady, async (readyClient) => {
  const args = parseArgs(process.argv.slice(2));

  try {
    const targets = await resolveTargetGuilds(args, readyClient);

    for (const target of targets) {
      await syncGuildRoles(readyClient, target);
    }
  } catch (error) {
    console.error('Role sync failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
    client.destroy();
  }
});

async function resolveTargetGuilds(args, readyClient) {
  if (args.guildId) {
    const discordGuild = await readyClient.guilds.fetch(String(args.guildId));
    const guild = await ensureGuild(discordGuild.id, discordGuild.name || 'Unknown Guild');
    const settingsRepo = require('../repositories/guild-leveling-settings-repository');
    const settings = await settingsRepo.getOrCreateGuildLevelingSettings(guild.id);
    return [{ discordGuild, guild, settings }];
  }

  const enabledSettings = await getEnabledGuildLevelingSettings();
  if (!enabledSettings.length) {
    const profiledGuildIds = await getLevelingGuildsWithProfiles();
    if (!profiledGuildIds.length) {
      return [];
    }

    const results = [];
    for (const guildId of profiledGuildIds) {
      const guildRow = await require('../data/db').query('SELECT id, discord_guild_id, name FROM guilds WHERE id = $1', [guildId]);
      if (!guildRow.rows.length) {
        continue;
      }
      const row = guildRow.rows[0];
      const discordGuild = await readyClient.guilds.fetch(row.discord_guild_id);
      const settingsRepo = require('../repositories/guild-leveling-settings-repository');
      const settings = await settingsRepo.getOrCreateGuildLevelingSettings(row.id);
      results.push({
        discordGuild,
        guild: { id: row.id, discord_guild_id: row.discord_guild_id, name: row.name },
        settings
      });
    }

    return results;
  }

  const targets = [];
  for (const settings of enabledSettings) {
    const discordGuild = await readyClient.guilds.fetch(settings.discordGuildId);
    const guild = await findGuildByDiscordId(settings.discordGuildId);
    targets.push({ discordGuild, guild, settings });
  }

  return targets;
}

async function syncGuildRoles(readyClient, target) {
  const profiles = await getProfilesByGuildId(target.guild.id);
  let assignedCount = 0;
  let unchangedCount = 0;
  let missingMemberCount = 0;

  console.log(`Syncing leveling roles for ${profiles.length} profiles in guild ${target.discordGuild.id}.`);

  for (const profile of profiles) {
    try {
      const member = await target.discordGuild.members.fetch(profile.discordUserId);
      const assigned = await applyRoleRewards(member, profile.discordUserId, profile.level, target.settings.roleRewards);
      if (assigned > 0) {
        assignedCount += assigned;
      } else {
        unchangedCount += 1;
      }
    } catch (error) {
      missingMemberCount += 1;
      console.warn(`Skipping member ${profile.discordUserId}:`, error.message);
    }
  }

  console.log(`Role sync complete for guild ${target.discordGuild.id}. Assigned roles: ${assignedCount}. No changes: ${unchangedCount}. Missing members: ${missingMemberCount}.`);
}

client.login(token);
