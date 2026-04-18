const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getLink, removeLink, setManualOverride, setWhitelistState, clearGraceUntil, upsertLink } = require('./linkStore');
const { applySubscriberState, memberHasSubscriberRole } = require('./roleSync');
const { whitelistAdd, whitelistRemove } = require('./whitelistService');

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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('admin-whitelist')
      .setDescription('Whitelist a member manually without requiring the Twitch role.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The Discord user to whitelist')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('minecraft_username')
          .setDescription('The Minecraft username to whitelist')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('admin-unwhitelist')
      .setDescription('Remove a manual whitelist override for a member.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The Discord user to update')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('admin-status')
      .setDescription('Show Minecraft whitelist status for another member.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The Discord user to inspect')
          .setRequired(true)
      )
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
    await handleStatus(interaction, interaction.user, interaction.member);
    return;
  }

  if (subcommand === 'admin-whitelist') {
    await handleAdminWhitelist(interaction);
    return;
  }

  if (subcommand === 'admin-unwhitelist') {
    await handleAdminUnwhitelist(interaction);
    return;
  }

  if (subcommand === 'admin-status') {
    await handleAdminStatus(interaction);
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

  await replyWithStatus(interaction, {
    user: interaction.user,
    member: interaction.member,
    link
  });
}

async function handleAdminWhitelist(interaction) {
  if (!hasMinecraftAdminPermission(interaction.member)) {
    await denyAdminSubcommand(interaction);
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const minecraftUsername = interaction.options.getString('minecraft_username', true).trim();

  if (!MINECRAFT_USERNAME_PATTERN.test(minecraftUsername)) {
    await interaction.reply({
      content: 'Minecraft usernames must be 3-16 characters and contain only letters, numbers, or underscores.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const hasSubscriberRole = targetMember ? memberHasSubscriberRole(targetMember) : false;
  const existingLink = await getLink(targetUser.id);
  let replacedWhitelistedUsername = null;

  if (
    existingLink &&
    existingLink.minecraftUsername.toLowerCase() !== minecraftUsername.toLowerCase() &&
    existingLink.isWhitelisted
  ) {
    await whitelistRemove(existingLink.minecraftUsername);
    replacedWhitelistedUsername = existingLink.minecraftUsername;
    console.log(
      `[minecraft] Removed old whitelist entry ${existingLink.minecraftUsername} before admin override for ${targetUser.id}.`
    );
  }

  const link = await upsertLink({
    discordUserId: targetUser.id,
    minecraftUsername,
    lastKnownSubRole: hasSubscriberRole
  });

  await setManualOverride(targetUser.id, true);
  await clearGraceUntil(targetUser.id);

  if (!link.isWhitelisted || replacedWhitelistedUsername) {
    await whitelistAdd(minecraftUsername);
  }

  await setWhitelistState(targetUser.id, true);

  const lines = [
    `Manual whitelist override enabled for <@${targetUser.id}> with Minecraft username \`${minecraftUsername}\`.`
  ];

  if (replacedWhitelistedUsername) {
    lines.push(`Removed old whitelist entry \`${replacedWhitelistedUsername}\` before switching usernames.`);
  }

  lines.push('This player will stay whitelisted even without the Twitch subscriber role until you remove the override.');

  await interaction.reply({
    content: lines.join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

async function handleAdminUnwhitelist(interaction) {
  if (!hasMinecraftAdminPermission(interaction.member)) {
    await denyAdminSubcommand(interaction);
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const hasSubscriberRole = targetMember ? memberHasSubscriberRole(targetMember) : false;
  const existingLink = await getLink(targetUser.id);

  if (!existingLink) {
    await interaction.reply({
      content: 'That user does not have a linked Minecraft username yet.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!existingLink.manualOverride) {
    await interaction.reply({
      content: [
        `No manual whitelist override is active for <@${targetUser.id}>.`,
        `Current whitelist state: ${existingLink.isWhitelisted ? 'Yes' : 'No'}`
      ].join('\n'),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await setManualOverride(targetUser.id, false);
  const updatedLink = await applySubscriberState(interaction.client, targetUser.id, hasSubscriberRole, {
    source: 'mc-admin-unwhitelist',
    allowGracePeriod: false
  });

  const stillWhitelisted = updatedLink?.isWhitelisted ? 'Yes' : 'No';

  await interaction.reply({
    content: [
      `Removed the manual whitelist override for <@${targetUser.id}>.`,
      `Current subscriber role: ${hasSubscriberRole ? 'Yes' : 'No'}`,
      `Currently whitelisted after re-evaluating role sync: ${stillWhitelisted}`
    ].join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

async function handleAdminStatus(interaction) {
  if (!hasMinecraftAdminPermission(interaction.member)) {
    await denyAdminSubcommand(interaction);
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const link = await getLink(targetUser.id);

  if (!link) {
    await interaction.reply({
      content: 'That user does not have a linked Minecraft username yet.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await replyWithStatus(interaction, {
    user: targetUser,
    member: targetMember,
    link
  });
}

async function replyWithStatus(interaction, { user, member, link }) {
  const hasSubscriberRole = member ? memberHasSubscriberRole(member) : false;
  const graceText = link.graceUntil
    ? `Grace period ends <t:${Math.floor(link.graceUntil / 1000)}:R> at <t:${Math.floor(link.graceUntil / 1000)}:f>.`
    : 'No grace period is currently active.';

  await interaction.reply({
    content: [
      `Discord user: <@${user.id}>`,
      `Linked Minecraft username: \`${link.minecraftUsername}\``,
      `Current Twitch subscriber role: ${hasSubscriberRole ? 'Yes' : 'No'}`,
      `Currently whitelisted: ${link.isWhitelisted ? 'Yes' : 'No'}`,
      `Manual override: ${link.manualOverride ? 'Yes' : 'No'}`,
      graceText
    ].join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

function hasMinecraftAdminPermission(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function denyAdminSubcommand(interaction) {
  await interaction.reply({
    content: 'You need the Manage Server permission to use this Minecraft admin command.',
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  data,
  execute
};
