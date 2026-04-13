const { DEFAULT_WEIGHTS } = require('../lib/constants');
const { query } = require('../data/db');

async function ensureGuild(discordGuildId, name) {
  const result = await query(
    `INSERT INTO guilds (discord_guild_id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (discord_guild_id)
     DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING *`,
    [discordGuildId, name || 'Unknown Guild']
  );

  const guild = result.rows[0];
  await query(
    `INSERT INTO guild_settings (guild_id, rarity_weights)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (guild_id) DO NOTHING`,
    [guild.id, JSON.stringify(DEFAULT_WEIGHTS)]
  );
  await query(
    `INSERT INTO guild_leveling_settings (guild_id)
     VALUES ($1)
     ON CONFLICT (guild_id) DO NOTHING`,
    [guild.id]
  );

  return guild;
}

async function findGuildByDiscordId(discordGuildId) {
  const result = await query(
    `SELECT *
     FROM guilds
     WHERE discord_guild_id = $1`,
    [discordGuildId]
  );

  return result.rows[0] || null;
}

module.exports = {
  ensureGuild,
  findGuildByDiscordId
};
