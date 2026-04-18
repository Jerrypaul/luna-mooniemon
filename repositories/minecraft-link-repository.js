const { query } = require('../data/db');

let initPromise = null;

function normalizeLink(row) {
  if (!row) {
    return null;
  }

  return {
    discordUserId: row.discord_user_id,
    minecraftUsername: row.minecraft_username,
    isWhitelisted: Boolean(row.is_whitelisted),
    graceUntil: row.grace_until === null || row.grace_until === undefined ? null : Number(row.grace_until),
    lastKnownSubRole: Boolean(row.last_known_sub_role)
  };
}

async function ensureMinecraftLinksTable() {
  if (!initPromise) {
    initPromise = query(
      `CREATE TABLE IF NOT EXISTS minecraft_links (
         discord_user_id TEXT PRIMARY KEY,
         minecraft_username TEXT NOT NULL,
         is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE,
         grace_until BIGINT,
         last_known_sub_role BOOLEAN NOT NULL DEFAULT FALSE,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    ).then(() => query(
      `CREATE INDEX IF NOT EXISTS idx_minecraft_links_grace_due
         ON minecraft_links (grace_until)
       WHERE grace_until IS NOT NULL`
    ));
  }

  return initPromise;
}

async function getMinecraftLink(discordUserId) {
  await ensureMinecraftLinksTable();

  const result = await query(
    `SELECT discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role
       FROM minecraft_links
      WHERE discord_user_id = $1`,
    [discordUserId]
  );

  return normalizeLink(result.rows[0]);
}

async function upsertMinecraftLink({ discordUserId, minecraftUsername, lastKnownSubRole = false }) {
  await ensureMinecraftLinksTable();

  const result = await query(
    `INSERT INTO minecraft_links (
       discord_user_id,
       minecraft_username,
       is_whitelisted,
       grace_until,
       last_known_sub_role,
       updated_at
     )
     VALUES ($1, $2, FALSE, NULL, $3, NOW())
     ON CONFLICT (discord_user_id)
     DO UPDATE SET
       minecraft_username = EXCLUDED.minecraft_username,
       last_known_sub_role = EXCLUDED.last_known_sub_role,
       updated_at = NOW()
     RETURNING discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role`,
    [discordUserId, minecraftUsername, lastKnownSubRole]
  );

  return normalizeLink(result.rows[0]);
}

async function deleteMinecraftLink(discordUserId) {
  await ensureMinecraftLinksTable();

  const result = await query(
    `DELETE FROM minecraft_links
      WHERE discord_user_id = $1
      RETURNING discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role`,
    [discordUserId]
  );

  return normalizeLink(result.rows[0]);
}

async function updateMinecraftLinkState(discordUserId, updates) {
  await ensureMinecraftLinksTable();

  const fields = [];
  const values = [];
  let parameterIndex = 1;

  if (updates.minecraftUsername !== undefined) {
    fields.push(`minecraft_username = $${parameterIndex++}`);
    values.push(updates.minecraftUsername);
  }

  if (updates.isWhitelisted !== undefined) {
    fields.push(`is_whitelisted = $${parameterIndex++}`);
    values.push(updates.isWhitelisted);
  }

  if (updates.graceUntil !== undefined) {
    fields.push(`grace_until = $${parameterIndex++}`);
    values.push(updates.graceUntil);
  }

  if (updates.lastKnownSubRole !== undefined) {
    fields.push(`last_known_sub_role = $${parameterIndex++}`);
    values.push(updates.lastKnownSubRole);
  }

  if (!fields.length) {
    return getMinecraftLink(discordUserId);
  }

  values.push(discordUserId);

  const result = await query(
    `UPDATE minecraft_links
        SET ${fields.join(', ')}, updated_at = NOW()
      WHERE discord_user_id = $${parameterIndex}
      RETURNING discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role`,
    values
  );

  return normalizeLink(result.rows[0]);
}

async function getExpiredMinecraftLinks(now = Date.now()) {
  await ensureMinecraftLinksTable();

  const result = await query(
    `SELECT discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role
       FROM minecraft_links
      WHERE grace_until IS NOT NULL
        AND grace_until <= $1
      ORDER BY grace_until ASC`,
    [now]
  );

  return result.rows.map(normalizeLink);
}

async function listMinecraftLinks() {
  await ensureMinecraftLinksTable();

  const result = await query(
    `SELECT discord_user_id, minecraft_username, is_whitelisted, grace_until, last_known_sub_role
       FROM minecraft_links
      ORDER BY discord_user_id ASC`
  );

  return result.rows.map(normalizeLink);
}

module.exports = {
  ensureMinecraftLinksTable,
  getMinecraftLink,
  upsertMinecraftLink,
  deleteMinecraftLink,
  updateMinecraftLinkState,
  getExpiredMinecraftLinks,
  listMinecraftLinks
};
