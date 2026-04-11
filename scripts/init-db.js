const fs = require('node:fs');
const path = require('node:path');
const { closePool, query } = require('../data/db');
const { getSchemaName } = require('../lib/env');

(async () => {
  const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const schemaName = getSchemaName();

  await query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  await query(`SET search_path TO ${schemaName}, public`);
  await query(sql);
  console.log(`Database schema initialized in schema ${schemaName}.`);
  await closePool();
})().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
