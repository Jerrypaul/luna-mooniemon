const { query } = require('../data/db');

async function getOrCreateGuildUser(guildId, discordUserId, username) {
  const result = await query(
    `INSERT INTO guild_users (guild_id, discord_user_id, username, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (guild_id, discord_user_id)
     DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()
     RETURNING *`,
    [guildId, discordUserId, username]
  );

  return mapGuildUser(result.rows[0]);
}

async function updateLastPullAt(guildUserId, timestamp) {
  const result = await query(
    `UPDATE guild_users
     SET last_pull_at = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [guildUserId, timestamp]
  );

  return result.rows[0] ? mapGuildUser(result.rows[0]) : null;
}

async function resetLastPullAtByGuildId(guildId) {
  const result = await query(
    `UPDATE guild_users
        SET last_pull_at = NULL, updated_at = NOW()
      WHERE guild_id = $1
        AND last_pull_at IS NOT NULL`,
    [guildId]
  );

  return result.rowCount || 0;
}

function mapGuildUser(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    discordUserId: row.discord_user_id,
    username: row.username,
    lastPullAt: row.last_pull_at ? new Date(row.last_pull_at) : null
  };
}

module.exports = {
  getOrCreateGuildUser,
  updateLastPullAt,
  resetLastPullAtByGuildId
};
