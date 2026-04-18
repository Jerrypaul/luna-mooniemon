const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { getRequiredEnv } = require('./lib/env');
const { closePool } = require('./data/db');
const { handleMessageForLeveling } = require('./services/leveling-service');
const {
  PULL_NOTIFY_BUTTON_ID,
  handlePullNotifyButton,
  startPullReminderWorker
} = require('./services/pull-reminder-service');
const { registerMinecraftRoleSync } = require('./features/minecraft/roleSync');
const { startMinecraftScheduler, stopMinecraftScheduler } = require('./features/minecraft/scheduler');
const { closeRconConnection } = require('./features/minecraft/whitelistService');

const token = getRequiredEnv('DISCORD_TOKEN');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

registerMinecraftRoleSync(client);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startPullReminderWorker(readyClient);
  startMinecraftScheduler(readyClient);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessageForLeveling(message);
  } catch (error) {
    console.error('Leveling handler error:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === PULL_NOTIFY_BUTTON_ID) {
    try {
      await handlePullNotifyButton(interaction);
    } catch (error) {
      console.error(error);
      await sendInteractionError(interaction, 'There was an error while setting your reminder.');
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await sendInteractionError(interaction, 'There was an error while executing this command.');
  }
});

async function sendInteractionError(interaction, content) {
  try {
    if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.deferred) {
      await interaction.editReply({ content, embeds: [], components: [], files: [] });
      return;
    }

    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch (responseError) {
    if (responseError?.code === 10062) {
      console.warn(`Interaction expired before an error response could be sent for ${interaction.id}.`);
      return;
    }

    console.error('Failed to send interaction error response:', responseError);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    stopMinecraftScheduler();
    await closeRconConnection();
    await closePool();
    process.exit(0);
  });
}

client.login(token);
