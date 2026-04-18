const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const { ensureGuild } = require('../repositories/guild-repository');
const { resetLastPullAtByGuildId } = require('../repositories/guild-user-repository');
const { deletePullRemindersByGuildId } = require('../repositories/pull-reminder-repository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-pull-cooldowns')
    .setDescription('Reset pull cooldowns for everyone in this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the Manage Server permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = await ensureGuild(interaction.guildId, interaction.guild?.name || 'Unknown Guild');
    const resetCount = await resetLastPullAtByGuildId(guild.id);
    const reminderCount = await deletePullRemindersByGuildId(guild.id);

    await interaction.editReply({
      content: `Reset pull cooldowns for ${resetCount} member${resetCount === 1 ? '' : 's'} in this server and cleared ${reminderCount} pending reminder${reminderCount === 1 ? '' : 's'}.`,
      embeds: [],
      components: [],
      files: []
    });
  }
};
