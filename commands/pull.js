const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCardEmbedPayload } = require('../lib/card-presenter');
const { pullCardForInteraction } = require('../services/game-service');
const { buildPullCooldownRow } = require('../services/pull-reminder-service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pull')
    .setDescription('Pull one card (4-hour cooldown).'),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await pullCardForInteraction(interaction);
    if (!result) {
      await interaction.editReply({
        content: 'This command can only be used inside a server.',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    if (result.status === 'cooldown') {
      const readyAtUnix = Math.floor(result.readyAt.getTime() / 1000);
      await replaceWithEphemeralReply(interaction, {
        content: `You are on cooldown in this server. You can pull again <t:${readyAtUnix}:R> at <t:${readyAtUnix}:f>.\n\nThat is about ${result.remainingText} from now.`,
        components: [buildPullCooldownRow()],
      });
      return;
    }

    if (result.status === 'no_cards') {
      await replaceWithEphemeralReply(interaction, {
        content: 'No cards are available for this server yet. Import cards into Postgres first.',
      });
      return;
    }

    if (result.status !== 'ok') {
      await replaceWithEphemeralReply(interaction, {
        content: 'Could not select a card. Please try again later.',
      });
      return;
    }

    const { embed, files } = buildCardEmbedPayload(result.card, result.ownedCopies, {
      title: `You Pulled: ${result.card.name}`,
      pulledBy: interaction.user.username
    });

    await interaction.editReply({ content: '', embeds: [embed], files, components: [] });
  }
};

async function replaceWithEphemeralReply(interaction, payload) {
  await interaction.deleteReply().catch(() => {});
  await interaction.followUp({
    ...payload,
    flags: MessageFlags.Ephemeral
  });
}
