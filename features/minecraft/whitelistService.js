const { Rcon } = require('rcon-client');
const { getIntegerEnv, getRequiredEnv } = require('../../lib/env');

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
  });

  connection.on('error', (error) => {
    console.error('[minecraft] RCON connection error:', error);
  });

  return connection;
}

async function withRconConnection(callback) {
  const connection = await connectRcon();
  try {
    return await callback(connection);
  } finally {
    try {
      await connection.end();
    } catch (error) {
      if (error?.message !== 'Not connected') {
        console.error('[minecraft] Failed to close RCON connection cleanly:', error);
      }
    }
  }
}

function isRetryableRconError(error) {
  return ['ECONNRESET', 'ECONNREFUSED'].includes(error?.code) || error?.message === 'Connection closed';
}

async function sendCommandOnce(command) {
  console.log(`[minecraft] RCON command -> ${command}`);
  return withRconConnection(async (connection) => {
    const response = await connection.send(command);
    console.log(`[minecraft] RCON response <- ${response || '(empty)'}`);
    return response;
  });
}

async function sendCommand(command) {
  try {
    return await sendCommandOnce(command);
  } catch (error) {
    console.error('[minecraft] Failed to send RCON command:', error);

    if (!isRetryableRconError(error)) {
      throw error;
    }

    console.warn(`[minecraft] Retrying RCON command after transient connection failure: ${command}`);
    return sendCommandOnce(command);
  }
}

async function whitelistAdd(minecraftUsername) {
  return sendCommand(`whitelist add ${minecraftUsername}`);
}

async function whitelistRemove(minecraftUsername) {
  return sendCommand(`whitelist remove ${minecraftUsername}`);
}

async function closeRconConnection() {
  return Promise.resolve();
}

module.exports = {
  sendCommand,
  whitelistAdd,
  whitelistRemove,
  closeRconConnection
};
