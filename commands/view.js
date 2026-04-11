const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { buildCardEmbedPayload } = require('../lib/card-presenter');
const { getViewDataForInteraction } = require('../services/game-service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('View your collection or details for one card.')
    .addStringOption((option) =>
      option
        .setName('card')
        .setDescription('Optional card name to inspect')
        .setRequired(false)
    ),

  async execute(interaction) {
    const cardName = interaction.options.getString('card');
    const result = await getViewDataForInteraction(interaction, cardName);
    if (!result) {
      return;
    }

    if (result.status === 'card_not_found') {
      await interaction.reply({
        content: `No card found with name "${cardName}" in this server's card pool.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (result.status === 'empty') {
      await interaction.reply({
        content: 'Your collection is empty in this server. Use /pull to get your first card!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (result.status === 'single_card') {
      const { embed, files } = buildCardEmbedPayload(result.card, result.ownedCopies);
      await interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = result.collection.map((entry) => `**${entry.card.name}** x${entry.count}`);
    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Collection`)
      .setColor(0x5865f2)
      .setDescription(lines.slice(0, 50).join('\n'))
      .setFooter({
        text: lines.length > 50 ? `Showing 50/${lines.length} entries for this server` : `${lines.length} unique cards in this server`
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
