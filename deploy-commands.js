const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { getOptionalEnv, getRequiredEnv } = require('./lib/env');

const token = getRequiredEnv('DISCORD_TOKEN');
const clientId = getRequiredEnv('DISCORD_CLIENT_ID');
const guildId = getOptionalEnv('DISCORD_GUILD_ID');
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

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log('Successfully reloaded guild (/) commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('Successfully reloaded global (/) commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();
