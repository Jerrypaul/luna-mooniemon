const { DEFAULT_PULL_COOLDOWN_MS, DEFAULT_WEIGHTS } = require('../lib/constants');
const { query } = require('../data/db');

async function getGuildSettings(guildId) {
  const result = await query(
    `SELECT guild_id, pull_cooldown_ms, rarity_weights
     FROM guild_settings
     WHERE guild_id = $1`,
    [guildId]
  );

  if (result.rows.length) {
    return normalizeSettings(result.rows[0]);
  }

  const inserted = await query(
    `INSERT INTO guild_settings (guild_id, pull_cooldown_ms, rarity_weights)
     VALUES ($1, $2, $3::jsonb)
     RETURNING guild_id, pull_cooldown_ms, rarity_weights`,
    [guildId, DEFAULT_PULL_COOLDOWN_MS, JSON.stringify(DEFAULT_WEIGHTS)]
  );

  return normalizeSettings(inserted.rows[0]);
}

function normalizeSettings(row) {
  return {
    guildId: row.guild_id,
    pullCooldownMs: Number(row.pull_cooldown_ms) || DEFAULT_PULL_COOLDOWN_MS,
    rarityWeights: row.rarity_weights || DEFAULT_WEIGHTS
  };
}

module.exports = {
  getGuildSettings
};
