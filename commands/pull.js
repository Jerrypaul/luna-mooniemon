const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCardEmbedPayload } = require('../lib/card-presenter');
const { pullCardForInteraction } = require('../services/game-service');
const { buildPullCooldownRow } = require('../services/pull-reminder-service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pull')
    .setDescription('Pull one card (4-hour cooldown).'),

  async execute(interaction) {
    const result = await pullCardForInteraction(interaction);
    if (!result) {
      return;
    }

    if (result.status === 'cooldown') {
      const readyAtUnix = Math.floor(result.readyAt.getTime() / 1000);
      await interaction.reply({
        content: `You are on cooldown in this server. You can pull again <t:${readyAtUnix}:R> at <t:${readyAtUnix}:f>.\n\nThat is about ${result.remainingText} from now.`,
        components: [buildPullCooldownRow()],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (result.status === 'no_cards') {
      await interaction.reply({
        content: 'No cards are available for this server yet. Import cards into Postgres first.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (result.status !== 'ok') {
      await interaction.reply({
        content: 'Could not select a card. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const { embed, files } = buildCardEmbedPayload(result.card, result.ownedCopies, {
      title: `You Pulled: ${result.card.name}`,
      pulledBy: interaction.user.username
    });

    await interaction.reply({ embeds: [embed], files });
  }
};
