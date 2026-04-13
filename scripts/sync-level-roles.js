const { Client, Events, GatewayIntentBits } = require('discord.js');
const { closePool } = require('../data/db');
const { ensureGuild } = require('../repositories/guild-repository');
const { getProfilesByGuildId } = require('../repositories/leveling-repository');
const { applyRoleRewards } = require('../services/leveling-service');
const { getRequiredEnv } = require('../lib/env');
const { getTargetGuildId } = require('../lib/leveling-config');

const token = getRequiredEnv('DISCORD_TOKEN');
const discordGuildId = getTargetGuildId();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once(Events.ClientReady, async (readyClient) => {
  let assignedCount = 0;
  let skippedCount = 0;
  let missingMemberCount = 0;

  try {
    const discordGuild = await readyClient.guilds.fetch(discordGuildId);
    const guild = await ensureGuild(discordGuild.id, discordGuild.name || 'Unknown Guild');
    const profiles = await getProfilesByGuildId(guild.id);

    console.log(`Syncing leveling roles for ${profiles.length} profiles in guild ${discordGuild.id}.`);

    for (const profile of profiles) {
      try {
        const member = await discordGuild.members.fetch(profile.discordUserId);
        const beforeRoleCount = member.roles.cache.size;
        await applyRoleRewards(member, profile.discordUserId, profile.level);
        const afterRoleCount = member.roles.cache.size;

        if (afterRoleCount > beforeRoleCount) {
          assignedCount += afterRoleCount - beforeRoleCount;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        missingMemberCount += 1;
        console.warn(`Skipping member ${profile.discordUserId}:`, error.message);
      }
    }

    console.log(`Role sync complete. Assigned roles: ${assignedCount}. No changes: ${skippedCount}. Missing members: ${missingMemberCount}.`);
  } catch (error) {
    console.error('Role sync failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
    client.destroy();
  }
});

client.login(token);
