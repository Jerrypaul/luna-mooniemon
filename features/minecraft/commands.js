const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getLink, removeLink, setWhitelistState, upsertLink } = require('./linkStore');
const { applySubscriberState, memberHasSubscriberRole } = require('./roleSync');
const { whitelistRemove } = require('./whitelistService');

const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

const data = new SlashCommandBuilder()
  .setName('mc')
  .setDescription('Manage your linked Minecraft whitelist account.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Link your Minecraft username to your Discord account.')
      .addStringOption((option) =>
        option
          .setName('minecraft_username')
          .setDescription('Your Minecraft username')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('unlink')
      .setDescription('Unlink your Minecraft username and remove whitelist access if active.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('status')
      .setDescription('Show your linked Minecraft username and whitelist status.')
  );

async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used inside a Discord server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'link') {
    await handleLink(interaction);
    return;
  }

  if (subcommand === 'unlink') {
    await handleUnlink(interaction);
    return;
  }

  if (subcommand === 'status') {
    await handleStatus(interaction);
  }
}

async function handleLink(interaction) {
  const minecraftUsername = interaction.options.getString('minecraft_username', true).trim();

  if (!MINECRAFT_USERNAME_PATTERN.test(minecraftUsername)) {
    await interaction.reply({
      content: 'Minecraft usernames must be 3-16 characters and contain only letters, numbers, or underscores.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const discordUserId = interaction.user.id;
  const hadSubscriberRole = memberHasSubscriberRole(interaction.member);
  const existingLink = await getLink(discordUserId);
  let replacedWhitelistedUsername = null;

  if (
    existingLink &&
    existingLink.minecraftUsername.toLowerCase() !== minecraftUsername.toLowerCase() &&
    existingLink.isWhitelisted
  ) {
    await whitelistRemove(existingLink.minecraftUsername);
    await setWhitelistState(discordUserId, false);
    replacedWhitelistedUsername = existingLink.minecraftUsername;
    console.log(
      `[minecraft] Removed old whitelist entry ${existingLink.minecraftUsername} before relinking ${discordUserId}.`
    );
  }

  await upsertLink({
    discordUserId,
    minecraftUsername,
    lastKnownSubRole: hadSubscriberRole
  });

  const updatedLink = await applySubscriberState(interaction.client, discordUserId, hadSubscriberRole, {
    source: 'mc-link-command',
    allowGracePeriod: true
  });

  const lines = [`Linked your Discord account to Minecraft username \`${minecraftUsername}\`.`];

  if (replacedWhitelistedUsername) {
    lines.push(`Removed old whitelist entry \`${replacedWhitelistedUsername}\` before switching usernames.`);
  }

  if (hadSubscriberRole && updatedLink?.isWhitelisted) {
    lines.push('You currently have the Twitch subscriber role, so you were whitelisted immediately.');
  } else {
    lines.push('Your link is saved, but you will only be whitelisted while you have the Twitch subscriber role.');
  }

  await interaction.reply({
    content: lines.join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

async function handleUnlink(interaction) {
  const existingLink = await getLink(interaction.user.id);

  if (!existingLink) {
    await interaction.reply({
      content: 'You do not have a linked Minecraft username yet.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (existingLink.isWhitelisted) {
    await whitelistRemove(existingLink.minecraftUsername);
    console.log(`[minecraft] Removed ${existingLink.minecraftUsername} from whitelist during unlink.`);
  }

  await removeLink(interaction.user.id);

  await interaction.reply({
    content: `Unlinked \`${existingLink.minecraftUsername}\`${existingLink.isWhitelisted ? ' and removed it from the whitelist.' : '.'}`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleStatus(interaction) {
  const link = await getLink(interaction.user.id);

  if (!link) {
    await interaction.reply({
      content: 'You do not have a linked Minecraft username yet. Use `/mc link <minecraft_username>` first.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const hasSubscriberRole = memberHasSubscriberRole(interaction.member);
  const graceText = link.graceUntil
    ? `Grace period ends <t:${Math.floor(link.graceUntil / 1000)}:R> at <t:${Math.floor(link.graceUntil / 1000)}:f>.`
    : 'No grace period is currently active.';

  await interaction.reply({
    content: [
      `Linked Minecraft username: \`${link.minecraftUsername}\``,
      `Current Twitch subscriber role: ${hasSubscriberRole ? 'Yes' : 'No'}`,
      `Currently whitelisted: ${link.isWhitelisted ? 'Yes' : 'No'}`,
      graceText
    ].join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  data,
  execute
};
