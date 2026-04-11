const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

function colorForRarity(rarity) {
  const colors = {
    Common: 0x95a5a6,
    Uncommon: 0x2ecc71,
    Rare: 0x3498db,
    Epic: 0x9b59b6,
    Legendary: 0xf1c40f
  };

  return colors[rarity] || 0xffffff;
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function buildCardEmbedPayload(card, ownedCopies, options = {}) {
  const title = options.title || card.name;
  const includePulledBy = Boolean(options.pulledBy);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(colorForRarity(card.rarity))
    .addFields(
      { name: 'Rarity', value: card.rarity || 'Unknown', inline: true },
      { name: 'Type', value: card.type || 'Unknown', inline: true },
      { name: 'Owned Copies', value: String(ownedCopies || 0), inline: true },
      { name: 'Description', value: card.description || 'No description available.' }
    )
    .setTimestamp();

  if (includePulledBy) {
    embed.setFooter({ text: `Pulled by ${options.pulledBy}` });
  }

  const files = [];
  const imagePathOrUrl = card.image_url;

  if (isHttpUrl(imagePathOrUrl)) {
    embed.setImage(imagePathOrUrl);
  } else if (typeof imagePathOrUrl === 'string' && imagePathOrUrl.trim()) {
    const absolutePath = path.join(__dirname, '..', imagePathOrUrl);
    if (fs.existsSync(absolutePath)) {
      const filename = path.basename(absolutePath);
      files.push(new AttachmentBuilder(absolutePath, { name: filename }));
      embed.setImage(`attachment://${filename}`);
    }
  }

  return { embed, files };
}

module.exports = {
  buildCardEmbedPayload,
  colorForRarity
};
