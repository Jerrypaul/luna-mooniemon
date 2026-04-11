const { query } = require('../data/db');

async function createUserCardInstance(guildUserId, card) {
  const result = await query(
    `INSERT INTO user_card_instances (guild_user_id, card_id, instance_hp, is_holo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [guildUserId, card.dbId, card.current_hp || card.base_hp || 100, Boolean(card.is_holo)]
  );

  return mapInstance(result.rows[0]);
}

async function countUserCopiesForCard(guildUserId, cardId) {
  const result = await query(
    `SELECT COUNT(*)::int AS copy_count
     FROM user_card_instances
     WHERE guild_user_id = $1 AND card_id = $2`,
    [guildUserId, cardId]
  );

  return result.rows[0] ? result.rows[0].copy_count : 0;
}

async function getCollectionSummary(guildUserId) {
  const result = await query(
    `SELECT
        c.id AS card_db_id,
        c.external_card_id,
        c.name,
        c.rarity,
        c.type,
        c.description,
        c.image_url,
        c.base_hp,
        c.current_hp,
        c.is_holo,
        c.variant_key,
        COUNT(uci.id)::int AS copy_count
     FROM user_card_instances uci
     INNER JOIN cards c ON c.id = uci.card_id
     WHERE uci.guild_user_id = $1
     GROUP BY c.id
     ORDER BY copy_count DESC, c.name ASC, c.id ASC`,
    [guildUserId]
  );

  return result.rows.map((row) => ({
    card: {
      dbId: row.card_db_id,
      id: row.external_card_id,
      name: row.name,
      rarity: row.rarity,
      type: row.type,
      description: row.description,
      image_url: row.image_url,
      base_hp: row.base_hp,
      current_hp: row.current_hp,
      is_holo: row.is_holo,
      variant_key: row.variant_key
    },
    count: row.copy_count
  }));
}

function mapInstance(row) {
  return {
    id: row.id,
    guildUserId: row.guild_user_id,
    cardId: row.card_id,
    instanceHp: row.instance_hp,
    isHolo: row.is_holo,
    obtainedAt: row.obtained_at
  };
}

module.exports = {
  createUserCardInstance,
  countUserCopiesForCard,
  getCollectionSummary
};
