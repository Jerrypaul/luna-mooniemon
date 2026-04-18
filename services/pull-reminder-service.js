const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { ensureGuild } = require('../repositories/guild-repository');
const { getGuildSettings } = require('../repositories/guild-settings-repository');
const { getOrCreateGuildUser } = require('../repositories/guild-user-repository');
const {
  upsertPullReminder,
  getDuePullReminders,
  markPullReminderNotified
} = require('../repositories/pull-reminder-repository');

const PULL_NOTIFY_BUTTON_ID = 'pull_notify_me';
const REMINDER_POLL_INTERVAL_MS = 60 * 1000;

function buildPullCooldownRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PULL_NOTIFY_BUTTON_ID)
      .setLabel('Notify me by DM')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

async function handlePullNotifyButton(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This reminder button only works inside a server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const guild = await ensureGuild(interaction.guildId, interaction.guild?.name || 'Unknown Guild');
  const settings = await getGuildSettings(guild.id);
  const guildUser = await getOrCreateGuildUser(guild.id, interaction.user.id, interaction.user.username);

  if (!guildUser.lastPullAt) {
    await interaction.reply({
      content: 'You do not have an active pull cooldown right now.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const notifyAt = new Date(guildUser.lastPullAt.getTime() + settings.pullCooldownMs);
  if (notifyAt.getTime() <= Date.now()) {
    await interaction.reply({
      content: 'Your cooldown is already over. You can use `/pull` now.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await upsertPullReminder(guildUser.id, notifyAt.toISOString());

  await interaction.update({
    content: `You are on cooldown in this server. You can pull again <t:${Math.floor(notifyAt.getTime() / 1000)}:R> at <t:${Math.floor(notifyAt.getTime() / 1000)}:f>.\n\nI will DM you when your next pull is ready.`,
    components: [buildPullCooldownRow(true)]
  });
}

function startPullReminderWorker(client) {
  const interval = setInterval(async () => {
    try {
      const dueReminders = await getDuePullReminders();

      for (const reminder of dueReminders) {
        try {
          const user = await client.users.fetch(reminder.discordUserId);
          await user.send(`Your Mooniemon pull is ready again in **${reminder.guildName}**. Head back to the server and use \`/pull\`.`);
        } catch (error) {
          console.error(`Failed to send pull reminder DM to ${reminder.discordUserId}:`, error);
        } finally {
          await markPullReminderNotified(reminder.id);
        }
      }
    } catch (error) {
      console.error('Pull reminder worker error:', error);
    }
  }, REMINDER_POLL_INTERVAL_MS);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }
}

module.exports = {
  PULL_NOTIFY_BUTTON_ID,
  buildPullCooldownRow,
  handlePullNotifyButton,
  startPullReminderWorker
};
