const crypto = require('node:crypto');
const { ensureGuild } = require('../repositories/guild-repository');
const {
  getOrCreateLevelingProfile,
  hasRecentDuplicateMessage,
  recordMessageHash,
  awardXp
} = require('../repositories/leveling-repository');
const { getConfiguredRoleRewards, getIgnoredChannelIds, getTargetGuildId } = require('../lib/leveling-config');

const MIN_MESSAGE_LENGTH = 8;
const XP_COOLDOWN_MS = 60 * 1000;
const MIN_XP_AWARD = 15;
const MAX_XP_AWARD = 25;

async function handleMessageForLeveling(message) {
  if (!shouldInspectMessage(message)) {
    return;
  }

  const guild = await ensureGuild(message.guild.id, message.guild.name || 'Unknown Guild');
  const profile = await getOrCreateLevelingProfile(guild.id, message.author.id, message.author.username);
  const normalizedContent = normalizeMessageContent(message.content);

  if (!qualifiesForXp(message, normalizedContent)) {
    return;
  }

  const now = new Date();
  if (isOnCooldown(profile.lastXpMessageAt, now)) {
    return;
  }

  const contentHash = hashMessage(normalizedContent);
  if (await hasRecentDuplicateMessage(guild.id, message.author.id, contentHash)) {
    return;
  }

  const xpAward = randomIntInclusive(MIN_XP_AWARD, MAX_XP_AWARD);
  const previousLevel = profile.level;
  const updatedProfile = await awardXp(profile.id, xpAward, now.toISOString(), calculateLevel(profile.xp + xpAward));
  await recordMessageHash(guild.id, message.author.id, contentHash, message.id);

  if (updatedProfile.level > previousLevel) {
    await applyRoleRewards(message.member, message.author.id, updatedProfile.level);
  }
}

function shouldInspectMessage(message) {
  return Boolean(message.guildId)
    && message.guildId === getTargetGuildId()
    && !message.author.bot;
}

function qualifiesForXp(message, normalizedContent) {
  if (!normalizedContent || normalizedContent.length < MIN_MESSAGE_LENGTH) {
    return false;
  }

  if (!message.content || !message.content.trim()) {
    return false;
  }

  if (getIgnoredChannelIds().has(message.channelId)) {
    return false;
  }

  return true;
}

function normalizeMessageContent(content) {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isOnCooldown(lastXpMessageAt, now) {
  if (!lastXpMessageAt) {
    return false;
  }

  return now.getTime() - new Date(lastXpMessageAt).getTime() < XP_COOLDOWN_MS;
}

function hashMessage(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function applyRoleRewards(member, discordUserId, level) {
  if (!member) {
    return;
  }

  for (const reward of getConfiguredRoleRewards()) {
    if (level < reward.level || member.roles.cache.has(reward.roleId)) {
      continue;
    }

    try {
      await member.roles.add(reward.roleId, `Reached Mooniemon community level ${reward.level}`);
    } catch (error) {
      console.error(`Failed to award ${reward.label} role to ${discordUserId}:`, error);
    }
  }
}

module.exports = {
  handleMessageForLeveling,
  calculateLevel,
  applyRoleRewards
};
