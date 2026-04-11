const fs = require('node:fs');
const path = require('node:path');
const { closePool, query } = require('../data/db');

(async () => {
  const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  await query(sql);
  console.log('Database schema initialized.');
  await closePool();
})().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
