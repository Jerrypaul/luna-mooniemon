const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function getBooleanEnv(name, fallback = false) {
  const value = getOptionalEnv(name);
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
}

function getIntegerEnv(name, fallback = undefined) {
  const value = getOptionalEnv(name);

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer.`);
  }

  return parsed;
}

function getSchemaName() {
  const schema = getOptionalEnv('DATABASE_SCHEMA', 'mooniemon');

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error('DATABASE_SCHEMA must contain only letters, numbers, and underscores, and cannot start with a number.');
  }

  return schema;
}

module.exports = {
  getRequiredEnv,
  getOptionalEnv,
  getBooleanEnv,
  getIntegerEnv,
  getSchemaName
};
