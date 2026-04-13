const { DEFAULT_LEVELING_ROLE_REWARDS } = require('../lib/constants');
const { normalizeIgnoredChannelIds, normalizeRoleRewards } = require('../lib/leveling-config');
const { query } = require('../data/db');

async function getOrCreateGuildLevelingSettings(guildId) {
  const result = await query(
    `INSERT INTO guild_leveling_settings (guild_id, role_rewards)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (guild_id) DO NOTHING`,
    [guildId, JSON.stringify(DEFAULT_LEVELING_ROLE_REWARDS)]
  );

  const selected = await query(
    `SELECT guild_id, enabled, ignored_channel_ids, role_rewards
     FROM guild_leveling_settings
     WHERE guild_id = $1`,
    [guildId]
  );

  return mapSettings(selected.rows[0]);
}

async function updateGuildLevelingSettings(guildId, input) {
  const current = await getOrCreateGuildLevelingSettings(guildId);
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.enabled;
  const ignoredChannelIds = input.ignoredChannelIds ? normalizeIgnoredChannelIds(input.ignoredChannelIds) : current.ignoredChannelIds;
  const roleRewards = input.roleRewards ? normalizeRoleRewards({ ...current.roleRewards, ...input.roleRewards }) : current.roleRewards;

  const result = await query(
    `UPDATE guild_leveling_settings
     SET enabled = $2,
         ignored_channel_ids = $3::jsonb,
         role_rewards = $4::jsonb,
         updated_at = NOW()
     WHERE guild_id = $1
     RETURNING guild_id, enabled, ignored_channel_ids, role_rewards`,
    [guildId, enabled, JSON.stringify(ignoredChannelIds), JSON.stringify(roleRewards)]
  );

  return mapSettings(result.rows[0]);
}

async function getEnabledGuildLevelingSettings() {
  const result = await query(
    `SELECT gls.guild_id, gls.enabled, gls.ignored_channel_ids, gls.role_rewards, g.discord_guild_id, g.name
     FROM guild_leveling_settings gls
     INNER JOIN guilds g ON g.id = gls.guild_id
     WHERE gls.enabled = TRUE
     ORDER BY g.name ASC, gls.guild_id ASC`
  );

  return result.rows.map((row) => ({
    ...mapSettings(row),
    discordGuildId: row.discord_guild_id,
    guildName: row.name
  }));
}

function mapSettings(row) {
  return {
    guildId: row.guild_id,
    enabled: Boolean(row.enabled),
    ignoredChannelIds: normalizeIgnoredChannelIds(row.ignored_channel_ids),
    roleRewards: normalizeRoleRewards(row.role_rewards)
  };
}

module.exports = {
  getOrCreateGuildLevelingSettings,
  updateGuildLevelingSettings,
  getEnabledGuildLevelingSettings
};
