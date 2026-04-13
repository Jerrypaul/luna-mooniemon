const { query } = require('../data/db');

async function getOrCreateLevelingProfile(guildId, discordUserId, username) {
  const result = await query(
    `INSERT INTO guild_leveling_profiles (guild_id, discord_user_id, username, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (guild_id, discord_user_id)
     DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()
     RETURNING *`,
    [guildId, discordUserId, username]
  );

  return mapProfile(result.rows[0]);
}

async function hasRecentDuplicateMessage(guildId, discordUserId, contentHash) {
  const result = await query(
    `SELECT 1
     FROM leveling_message_hashes
     WHERE guild_id = $1
       AND discord_user_id = $2
       AND content_hash = $3
       AND created_at >= NOW() - INTERVAL '7 days'
     LIMIT 1`,
    [guildId, discordUserId, contentHash]
  );

  return result.rows.length > 0;
}

async function recordMessageHash(guildId, discordUserId, contentHash, sourceMessageId) {
  await query(
    `INSERT INTO leveling_message_hashes (guild_id, discord_user_id, content_hash, source_message_id)
     VALUES ($1, $2, $3, $4)`,
    [guildId, discordUserId, contentHash, sourceMessageId]
  );
}

async function awardXp(profileId, xpToAdd, lastXpMessageAt, nextLevel) {
  const result = await query(
    `UPDATE guild_leveling_profiles
     SET xp = xp + $2,
         level = $3,
         last_xp_message_at = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [profileId, xpToAdd, nextLevel, lastXpMessageAt]
  );

  return mapProfile(result.rows[0]);
}

async function getProfilesByGuildId(guildId) {
  const result = await query(
    `SELECT *
     FROM guild_leveling_profiles
     WHERE guild_id = $1
     ORDER BY level DESC, xp DESC, id ASC`,
    [guildId]
  );

  return result.rows.map(mapProfile);
}

function mapProfile(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    discordUserId: row.discord_user_id,
    username: row.username,
    xp: row.xp,
    level: row.level,
    lastXpMessageAt: row.last_xp_message_at ? new Date(row.last_xp_message_at) : null
  };
}

module.exports = {
  getOrCreateLevelingProfile,
  hasRecentDuplicateMessage,
  recordMessageHash,
  awardXp,
  getProfilesByGuildId
};
