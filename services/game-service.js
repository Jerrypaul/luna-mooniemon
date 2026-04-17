const { MessageFlags } = require('discord.js');
const { randomFromArray, weightedRarityRoll } = require('../lib/weighted');
const { ensureGuild } = require('../repositories/guild-repository');
const { getGuildSettings } = require('../repositories/guild-settings-repository');
const { getCardsByGuildId, findCardsByGuildAndName } = require('../repositories/card-repository');
const { getOrCreateGuildUser, updateLastPullAt } = require('../repositories/guild-user-repository');
const { createUserCardInstance, countUserCopiesForCard, getCollectionSummary } = require('../repositories/user-card-instance-repository');
const { getTopProfilesByGuildId } = require('../repositories/leveling-repository');

async function requireGuildContext(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used inside a server.',
      flags: MessageFlags.Ephemeral
    });
    return null;
  }

  return ensureGuild(interaction.guildId, interaction.guild?.name || 'Unknown Guild');
}

async function pullCardForInteraction(interaction) {
  const guild = await requireGuildContext(interaction);
  if (!guild) {
    return null;
  }

  const settings = await getGuildSettings(guild.id);
  const guildUser = await getOrCreateGuildUser(guild.id, interaction.user.id, interaction.user.username);
  const now = new Date();
  const cooldownResult = getCooldownResult(guildUser.lastPullAt, settings.pullCooldownMs, now);

  if (!cooldownResult.ready) {
    return {
      status: 'cooldown',
      remainingText: cooldownResult.remainingText
    };
  }

  const cards = await getCardsByGuildId(guild.id, { pullableOnly: true });
  if (!cards.length) {
    return { status: 'no_cards' };
  }

  const rolledRarity = weightedRarityRoll(settings.rarityWeights);
  const rarityMatches = cards.filter((card) => card.rarity === rolledRarity);
  const card = randomFromArray(rarityMatches.length ? rarityMatches : cards);

  if (!card) {
    return { status: 'selection_failed' };
  }

  await createUserCardInstance(guildUser.id, card);
  await updateLastPullAt(guildUser.id, now.toISOString());
  const ownedCopies = await countUserCopiesForCard(guildUser.id, card.dbId);

  return {
    status: 'ok',
    card,
    ownedCopies
  };
}

async function getViewDataForInteraction(interaction, cardName) {
  const guild = await requireGuildContext(interaction);
  if (!guild) {
    return null;
  }

  const guildUser = await getOrCreateGuildUser(guild.id, interaction.user.id, interaction.user.username);

  if (cardName) {
    const matches = await findCardsByGuildAndName(guild.id, cardName);
    if (!matches.length) {
      return { status: 'card_not_found' };
    }

    const preferredCard = chooseViewCard(matches);
    const ownedCopies = await countUserCopiesForCard(guildUser.id, preferredCard.dbId);

    return {
      status: 'single_card',
      card: preferredCard,
      ownedCopies
    };
  }

  const collection = await getCollectionSummary(guildUser.id);
  if (!collection.length) {
    return { status: 'empty' };
  }

  return {
    status: 'collection',
    collection
  };
}

async function getLeaderboardDataForInteraction(interaction, limit = 10) {
  const guild = await requireGuildContext(interaction);
  if (!guild) {
    return null;
  }

  const profiles = await getTopProfilesByGuildId(guild.id, limit);
  if (!profiles.length) {
    return { status: 'empty' };
  }

  return {
    status: 'ok',
    profiles,
    guild
  };
}

function chooseViewCard(cards) {
  return [...cards].sort((left, right) => {
    if (left.is_holo !== right.is_holo) {
      return left.is_holo ? -1 : 1;
    }

    return left.dbId - right.dbId;
  })[0];
}

function getCooldownResult(lastPullAt, cooldownMs, now) {
  if (!lastPullAt) {
    return { ready: true };
  }

  const elapsedMs = now.getTime() - new Date(lastPullAt).getTime();
  if (elapsedMs >= cooldownMs) {
    return { ready: true };
  }

  const remainingMs = cooldownMs - elapsedMs;
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return {
    ready: false,
    remainingText: `${remainingHours}h ${remainingMinutes}m`
  };
}

module.exports = {
  pullCardForInteraction,
  getViewDataForInteraction,
  getLeaderboardDataForInteraction
};
