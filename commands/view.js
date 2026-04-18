const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { buildCardEmbedPayload } = require('../lib/card-presenter');
const { getViewDataForInteraction } = require('../services/game-service');

const VIEW_TIMEOUT_MS = 5 * 60 * 1000;

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cardName = interaction.options.getString('card');
    const result = await getViewDataForInteraction(interaction, cardName);
    if (!result) {
      await interaction.editReply({
        content: 'This command can only be used inside a server.',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    if (result.status === 'card_not_found') {
      await interaction.editReply({
        content: `No card found with name "${cardName}" in this server's card pool.`,
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    if (result.status === 'empty') {
      await interaction.editReply({
        content: 'Your collection is empty in this server. Use /pull to get your first card!',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    if (result.status === 'single_card') {
      const { embed, files } = buildCardEmbedPayload(result.card, result.ownedCopies);
      await interaction.editReply({ content: '', embeds: [embed], files, components: [] });
      return;
    }

    const collection = result.collection;
    let pageIndex = 0;
    const initialPayload = buildCollectionPagePayload(interaction, collection, pageIndex);

    await interaction.editReply({
      ...initialPayload,
      content: ''
    });

    if (collection.length <= 1) {
      return;
    }

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: VIEW_TIMEOUT_MS
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'This collection view belongs to someone else.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (buttonInteraction.customId === 'view_prev') {
        pageIndex = pageIndex === 0 ? collection.length - 1 : pageIndex - 1;
      }

      if (buttonInteraction.customId === 'view_next') {
        pageIndex = pageIndex === collection.length - 1 ? 0 : pageIndex + 1;
      }

      const nextPayload = buildCollectionPagePayload(interaction, collection, pageIndex);
      await buttonInteraction.update(nextPayload);
    });

    collector.on('end', async () => {
      try {
        const finalPayload = buildCollectionPagePayload(interaction, collection, pageIndex, true);
        await interaction.editReply(finalPayload);
      } catch (error) {
        console.error('Failed to disable collection view buttons:', error);
      }
    });
  }
};

function buildCollectionPagePayload(interaction, collection, pageIndex, disabled = false) {
  const entry = collection[pageIndex];
  const totalCopies = collection.reduce((sum, item) => sum + item.count, 0);
  const { embed, files } = buildCardEmbedPayload(entry.card, entry.count, {
    title: `${interaction.user.username}'s Collection`
  });

  embed.addFields(
    { name: 'Collection Progress', value: `${pageIndex + 1}/${collection.length} unique cards`, inline: true },
    { name: 'Total Copies', value: String(totalCopies), inline: true },
    { name: 'Card Name', value: entry.card.name, inline: true }
  );
  embed.setFooter({ text: 'Use the buttons below to browse your collection' });

  return {
    embeds: [embed],
    files,
    components: [buildNavigationRow(pageIndex, collection.length, disabled)]
  };
}

function buildNavigationRow(pageIndex, totalPages, disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('view_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('view_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || totalPages <= 1)
  );
}
