const { Events } = require('discord.js');
const { getIntegerEnv, getRequiredEnv } = require('../../lib/env');
const {
  getLink,
  setWhitelistState,
  setGraceUntil,
  clearGraceUntil,
  setLastKnownSubRole
} = require('./linkStore');
const { whitelistAdd, whitelistRemove } = require('./whitelistService');

const DEFAULT_GRACE_PERIOD_HOURS = 48;

function getSubscriberRoleId() {
  return getRequiredEnv('TWITCH_SUB_ROLE_ID');
}

function getGracePeriodHours() {
  const hours = getIntegerEnv('GRACE_PERIOD_HOURS', DEFAULT_GRACE_PERIOD_HOURS);

  if (hours <= 0) {
    throw new Error('GRACE_PERIOD_HOURS must be greater than 0.');
  }

  return hours;
}

function memberHasSubscriberRole(member) {
  const roleId = getSubscriberRoleId();

  if (member?.roles?.cache) {
    return member.roles.cache.has(roleId);
  }

  if (Array.isArray(member?.roles)) {
    return member.roles.includes(roleId);
  }

  return false;
}

async function fetchLiveSubscriberRoleState(client, discordUserId) {
  const roleId = getSubscriberRoleId();

  for (const guild of client.guilds.cache.values()) {
    try {
      const member = guild.members.cache.get(discordUserId) ?? await guild.members.fetch(discordUserId);
      if (member.roles.cache.has(roleId)) {
        return true;
      }
    } catch (error) {
      if (error.code !== 10007) {
        console.error(`[minecraft] Failed to fetch member ${discordUserId} in guild ${guild.id}:`, error);
      }
    }
  }

  return false;
}

async function applySubscriberState(client, discordUserId, hasSubscriberRole, options = {}) {
  const { source = 'unknown', allowGracePeriod = true } = options;
  const link = await getLink(discordUserId);

  if (!link) {
    console.log(`[minecraft] Skipping ${source} for ${discordUserId}; no linked Minecraft account.`);
    return null;
  }

  await setLastKnownSubRole(discordUserId, hasSubscriberRole);

  if (hasSubscriberRole) {
    if (link.graceUntil !== null) {
      await clearGraceUntil(discordUserId);
      console.log(`[minecraft] Cleared grace period for ${link.minecraftUsername} (${discordUserId}).`);
    }

    if (!link.isWhitelisted) {
      await whitelistAdd(link.minecraftUsername);
      await setWhitelistState(discordUserId, true);
      console.log(`[minecraft] Whitelisted ${link.minecraftUsername} for ${source}.`);
    } else {
      console.log(`[minecraft] ${link.minecraftUsername} already whitelisted during ${source}; no action needed.`);
    }

    return getLink(discordUserId);
  }

  if (!link.isWhitelisted) {
    if (link.graceUntil !== null) {
      await clearGraceUntil(discordUserId);
      console.log(`[minecraft] Cleared stale grace period for unwhitelisted user ${link.minecraftUsername}.`);
    }

    console.log(`[minecraft] ${link.minecraftUsername} is linked but not whitelisted; no removal needed.`);
    return getLink(discordUserId);
  }

  if (allowGracePeriod) {
    if (link.graceUntil === null) {
      const graceUntil = Date.now() + (getGracePeriodHours() * 60 * 60 * 1000);
      await setGraceUntil(discordUserId, graceUntil);
      console.log(
        `[minecraft] Scheduled whitelist grace period for ${link.minecraftUsername} until ${new Date(graceUntil).toISOString()}.`
      );
    } else {
      console.log(
        `[minecraft] Grace period already active for ${link.minecraftUsername} until ${new Date(link.graceUntil).toISOString()}.`
      );
    }

    return getLink(discordUserId);
  }

  await whitelistRemove(link.minecraftUsername);
  await setWhitelistState(discordUserId, false);
  await clearGraceUntil(discordUserId);
  console.log(`[minecraft] Removed ${link.minecraftUsername} from whitelist after grace expiration.`);
  return getLink(discordUserId);
}

function registerMinecraftRoleSync(client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const hadSubscriberRole = memberHasSubscriberRole(oldMember);
      const hasSubscriberRole = memberHasSubscriberRole(newMember);

      if (hadSubscriberRole === hasSubscriberRole) {
        return;
      }

      await applySubscriberState(newMember.client, newMember.id, hasSubscriberRole, {
        source: 'guildMemberUpdate',
        allowGracePeriod: true
      });
    } catch (error) {
      console.error('[minecraft] Role sync failed:', error);
    }
  });
}

module.exports = {
  getGracePeriodHours,
  memberHasSubscriberRole,
  fetchLiveSubscriberRoleState,
  applySubscriberState,
  registerMinecraftRoleSync
};
