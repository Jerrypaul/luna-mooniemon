const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config.json');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command) {
    commands.push(command.data.toJSON());
  }
}

if (!config.token || config.token.includes('YOUR_DISCORD_BOT_TOKEN')) {
  throw new Error('Please set a valid bot token in config.json before deploying commands.');
}

if (!config.clientId || config.clientId.includes('YOUR_DISCORD_APPLICATION_CLIENT_ID')) {
  throw new Error('Please set a valid clientId in config.json before deploying commands.');
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    if (config.guildId && !config.guildId.includes('YOUR_DISCORD_TEST_GUILD_ID')) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log('Successfully reloaded guild (/) commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log('Successfully reloaded global (/) commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();
