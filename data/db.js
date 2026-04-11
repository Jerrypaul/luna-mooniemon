const config = require('../config.json');
const { Pool } = require('pg');

let pool;

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;

  if (!databaseUrl) {
    throw new Error('Please set DATABASE_URL or config.databaseUrl before starting the bot.');
  }

  return {
    connectionString: databaseUrl,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false
  };
}

function shouldUseSsl() {
  if (typeof process.env.DATABASE_SSL === 'string') {
    return process.env.DATABASE_SSL === 'true';
  }

  return Boolean(config.databaseSsl);
}

function getPool() {
  if (!pool) {
    pool = new Pool(getDatabaseConfig());
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
