const { query } = require('../data/db');

async function getCardsByGuildId(guildId) {
  const result = await query(
    `SELECT *
     FROM cards
     WHERE guild_id = $1
     ORDER BY name ASC, rarity ASC, id ASC`,
    [guildId]
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

async function replaceCardsForGuild(guildId, cards) {
  await query('DELETE FROM cards WHERE guild_id = $1', [guildId]);

  for (const card of cards) {
    await query(
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
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
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
    metadata: row.metadata || {}
  };
}

module.exports = {
  getCardsByGuildId,
  findCardsByGuildAndName,
  replaceCardsForGuild
};
