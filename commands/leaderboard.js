const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getLeaderboardDataForInteraction } = require('../services/game-service');

const MEDAL_EMOJIS = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top leveling members in this server.'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await getLeaderboardDataForInteraction(interaction, 10);
    if (!result) {
      await interaction.editReply({
        content: 'This command can only be used inside a server.',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    if (result.status === 'empty') {
      await interaction.editReply({
        content: 'No leveling data exists for this server yet.',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    const lines = result.profiles.map((profile, index) => {
      const prefix = MEDAL_EMOJIS[index] || `#${index + 1}`;
      return `${prefix} <@${profile.discordUserId}>  Level ${profile.level}  (${profile.xp} XP)`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild?.name || 'Server'} Leaderboard`)
      .setColor(0xf1c40f)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Top 10 by level, then XP' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    await interaction.deleteReply().catch(() => {});
  }
};
