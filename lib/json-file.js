const fs = require('node:fs');

function stripBom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed reading ${filePath}:`, error);
    return fallback;
  }
}

module.exports = {
  readJsonFile
};
