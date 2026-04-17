const { withTransaction, query } = require('../data/db');

async function getCardsByGuildId(guildId, options = {}) {
  const { pullableOnly = false } = options;
  const result = await query(
    `SELECT *
     FROM cards
     WHERE guild_id = $1
       AND ($2::boolean = FALSE OR is_pullable = TRUE)
     ORDER BY name ASC, rarity ASC, id ASC`,
    [guildId, pullableOnly]
  );

  return result.rows.map(mapCard);
}

async function findCardsByGuildAndName(guildId, name) {
  const result = await query(
    `SELECT *
     FROM cards
     WHERE guild_id = $1 AND LOWER(name) = LOWER($2)
     ORDER BY id ASC`,
    [guildId, name]
  );

  return result.rows.map(mapCard);
}

async function syncCardsForGuild(guildId, cards) {
  return withTransaction(async (client) => {
    const activeCardIds = [];

    for (const card of cards) {
      activeCardIds.push(card.id);

      await client.query(
        `INSERT INTO cards (
           guild_id,
           external_card_id,
           name,
           rarity,
           type,
           description,
           image_url,
           base_hp,
           current_hp,
           is_holo,
           variant_key,
           is_pullable,
           retired_at,
           metadata,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, NULL, $12::jsonb, NOW())
         ON CONFLICT (guild_id, external_card_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           rarity = EXCLUDED.rarity,
           type = EXCLUDED.type,
           description = EXCLUDED.description,
           image_url = EXCLUDED.image_url,
           base_hp = EXCLUDED.base_hp,
           current_hp = EXCLUDED.current_hp,
           is_holo = EXCLUDED.is_holo,
           variant_key = EXCLUDED.variant_key,
           is_pullable = TRUE,
           retired_at = NULL,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          guildId,
          card.id,
          card.name,
          card.rarity,
          card.type,
          card.description,
          card.image_url || null,
          card.base_hp || 100,
          card.current_hp || card.base_hp || 100,
          Boolean(card.is_holo || inferHolo(card)),
          card.variant_key || inferVariantKey(card),
          JSON.stringify(card.metadata || {})
        ]
      );
    }

    const retireQuery = activeCardIds.length
      ? {
          text: `UPDATE cards
                 SET is_pullable = FALSE,
                     retired_at = COALESCE(retired_at, NOW()),
                     updated_at = NOW()
                 WHERE guild_id = $1
                   AND external_card_id <> ALL($2::text[])`,
          values: [guildId, activeCardIds]
        }
      : {
          text: `UPDATE cards
                 SET is_pullable = FALSE,
                     retired_at = COALESCE(retired_at, NOW()),
                     updated_at = NOW()
                 WHERE guild_id = $1`,
          values: [guildId]
        };

    const retireResult = await client.query(retireQuery);
    return {
      importedCount: cards.length,
      retiredCount: retireResult.rowCount || 0
    };
  });
}

function inferHolo(card) {
  return typeof card.image_url === 'string' && /holo/i.test(card.image_url)
    || typeof card.name === 'string' && /holo/i.test(card.name)
    || typeof card.id === 'string' && /holo/i.test(card.id);
}

function inferVariantKey(card) {
  return inferHolo(card) ? 'holo' : 'standard';
}

function mapCard(row) {
  return {
    dbId: row.id,
    guildId: row.guild_id,
    id: row.external_card_id,
    name: row.name,
    rarity: row.rarity,
    type: row.type,
    description: row.description,
    image_url: row.image_url,
    base_hp: row.base_hp,
    current_hp: row.current_hp,
    is_holo: row.is_holo,
    variant_key: row.variant_key,
    is_pullable: row.is_pullable,
    retired_at: row.retired_at,
    metadata: row.metadata || {}
  };
}

module.exports = {
  getCardsByGuildId,
  findCardsByGuildAndName,
  syncCardsForGuild
};
