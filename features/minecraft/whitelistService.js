const { Rcon } = require('rcon-client');
const { getIntegerEnv, getRequiredEnv } = require('../../lib/env');

let connectionPromise = null;

function getRconConfig() {
  return {
    host: getRequiredEnv('RCON_HOST'),
    port: getIntegerEnv('RCON_PORT', 25575),
    password: getRequiredEnv('RCON_PASSWORD')
  };
}

async function connectRcon() {
  const config = getRconConfig();
  console.log(`[minecraft] Connecting to RCON at ${config.host}:${config.port}`);
  const connection = await Rcon.connect(config);

  connection.on('end', () => {
    console.log('[minecraft] RCON connection closed.');
    connectionPromise = null;
  });

  connection.on('error', (error) => {
    console.error('[minecraft] RCON connection error:', error);
    connectionPromise = null;
  });

  return connection;
}

async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = connectRcon();
  }

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

async function sendCommand(command) {
  const connection = await getConnection();
  console.log(`[minecraft] RCON command -> ${command}`);

  try {
    const response = await connection.send(command);
    console.log(`[minecraft] RCON response <- ${response || '(empty)'}`);
    return response;
  } catch (error) {
    console.error('[minecraft] Failed to send RCON command:', error);
    connectionPromise = null;

    try {
      await connection.end();
    } catch (closeError) {
      console.error('[minecraft] Failed to close broken RCON connection:', closeError);
    }

    throw error;
  }
}

async function whitelistAdd(minecraftUsername) {
  return sendCommand(`whitelist add ${minecraftUsername}`);
}

async function whitelistRemove(minecraftUsername) {
  return sendCommand(`whitelist remove ${minecraftUsername}`);
}

async function closeRconConnection() {
  if (!connectionPromise) {
    return;
  }

  try {
    const connection = await connectionPromise;
    await connection.end();
  } catch (error) {
    console.error('[minecraft] Failed to close RCON connection cleanly:', error);
  } finally {
    connectionPromise = null;
  }
}

module.exports = {
  sendCommand,
  whitelistAdd,
  whitelistRemove,
  closeRconConnection
};
