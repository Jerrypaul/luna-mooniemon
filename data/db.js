const { Pool } = require('pg');
const { getBooleanEnv, getRequiredEnv, getSchemaName } = require('../lib/env');

let pool;

function getDatabaseConfig() {
  const databaseUrl = getRequiredEnv('DATABASE_URL');

  return {
    connectionString: databaseUrl,
    ssl: getBooleanEnv('DATABASE_SSL', false) ? { rejectUnauthorized: false } : false
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool(getDatabaseConfig());
    pool.on('connect', async (client) => {
      await client.query(`SET search_path TO ${getSchemaName()}, public`);
    });
  }

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  closePool
};
