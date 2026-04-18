const { query } = require('../data/db');

async function upsertPullReminder(guildUserId, notifyAt) {
  const result = await query(
    `INSERT INTO pull_reminders (guild_user_id, notify_at, notified_at, updated_at)
     VALUES ($1, $2, NULL, NOW())
     ON CONFLICT (guild_user_id)
     DO UPDATE SET notify_at = EXCLUDED.notify_at, notified_at = NULL, updated_at = NOW()
     RETURNING *`,
    [guildUserId, notifyAt]
  );

  return mapPullReminder(result.rows[0]);
}

async function deletePullReminderByGuildUserId(guildUserId) {
  await query(
    `DELETE FROM pull_reminders
     WHERE guild_user_id = $1`,
    [guildUserId]
  );
}

async function getDuePullReminders(limit = 25) {
  const result = await query(
    `SELECT pr.id,
            pr.guild_user_id,
            pr.notify_at,
            pr.notified_at,
            gu.discord_user_id,
            gu.username,
            g.name AS guild_name
       FROM pull_reminders pr
       JOIN guild_users gu ON gu.id = pr.guild_user_id
       JOIN guilds g ON g.id = gu.guild_id
      WHERE pr.notified_at IS NULL
        AND pr.notify_at <= NOW()
      ORDER BY pr.notify_at ASC
      LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    ...mapPullReminder(row),
    discordUserId: row.discord_user_id,
    username: row.username,
    guildName: row.guild_name
  }));
}

async function markPullReminderNotified(reminderId, notifiedAt = new Date()) {
  await query(
    `UPDATE pull_reminders
        SET notified_at = $2, updated_at = NOW()
      WHERE id = $1`,
    [reminderId, notifiedAt]
  );
}

function mapPullReminder(row) {
  return {
    id: row.id,
    guildUserId: row.guild_user_id,
    notifyAt: new Date(row.notify_at),
    notifiedAt: row.notified_at ? new Date(row.notified_at) : null
  };
}

module.exports = {
  upsertPullReminder,
  deletePullReminderByGuildUserId,
  getDuePullReminders,
  markPullReminderNotified
};
