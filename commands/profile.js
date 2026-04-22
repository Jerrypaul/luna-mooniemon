const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfileDataForInteraction } = require('../services/game-service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a member profile summary for this server.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Optional member to inspect')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const selectedUser = interaction.options.getUser('user');
    let selectedMember = null;

    if (interaction.guild && selectedUser) {
      selectedMember = interaction.options.getMember('user');
      if (!selectedMember) {
        selectedMember = await interaction.guild.members.fetch(selectedUser.id).catch(() => null);
      }
    } else if (interaction.member) {
      selectedMember = interaction.member;
    }

    const result = await getProfileDataForInteraction(interaction, selectedUser, selectedMember);
    if (!result) {
      await interaction.editReply({
        content: 'This command can only be used inside a server.',
        embeds: [],
        components: [],
        files: []
      });
      return;
    }

    const embed = buildProfileEmbed(result, interaction.guild?.name || 'Server');
    await interaction.editReply({ content: '', embeds: [embed], components: [], files: [] });
  }
};

function buildProfileEmbed(result, guildName) {
  const embed = new EmbedBuilder()
    .setTitle(`${result.user.displayName}'s Profile`)
    .setColor(0x3498db)
    .setThumbnail(result.user.avatarUrl)
    .addFields(
      { name: 'Level', value: String(result.leveling.level), inline: true },
      { name: 'XP', value: String(result.leveling.xp), inline: true },
      { name: 'Pull Status', value: result.cooldown.text, inline: true },
      { name: 'Total Cards', value: String(result.collection.totalCopies), inline: true },
      { name: 'Unique Cards', value: String(result.collection.uniqueCards), inline: true },
      { name: 'Minecraft', value: formatMinecraftValue(result.minecraftLink), inline: true },
      { name: 'Favorite Card', value: formatFavoriteCardValue(result.collection.favoriteCard), inline: false }
    )
    .setFooter({ text: guildName })
    .setTimestamp();

  if (!result.cooldown.ready && result.cooldown.readyAt) {
    embed.addFields({
      name: 'Next Pull',
      value: `<t:${Math.floor(result.cooldown.readyAt.getTime() / 1000)}:R>`,
      inline: true
    });
  }

  return embed;
}

function formatFavoriteCardValue(favoriteCard) {
  if (!favoriteCard) {
    return 'No cards collected yet.';
  }

  return `${favoriteCard.card.name} (${favoriteCard.card.rarity}) x${favoriteCard.count}`;
}

function formatMinecraftValue(link) {
  if (!link) {
    return 'Not linked';
  }

  if (link.isWhitelisted) {
    return `${link.minecraftUsername} (whitelisted)`;
  }

  return `${link.minecraftUsername} (linked)`;
}
