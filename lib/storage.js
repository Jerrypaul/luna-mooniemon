const fs = require('node:fs');
const path = require('node:path');

const USERS_PATH = path.join(__dirname, '..', 'users.json');
const CARDS_PATH = path.join(__dirname, '..', 'cards.json');

function stripBom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed reading ${filePath}:`, error);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadCards() {
  const cards = readJson(CARDS_PATH, []);
  return Array.isArray(cards) ? cards : [];
}

function loadUsers() {
  const users = readJson(USERS_PATH, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  writeJson(USERS_PATH, users);
}

function getOrCreateUser(userId) {
  const users = loadUsers();
  let user = users.find((entry) => entry.userId === userId);

  if (!user) {
    user = {
      userId,
      lastPullAt: 0,
      collection: {}
    };
    users.push(user);
    saveUsers(users);
  }

  return { users, user };
}

function incrementCard(user, cardId) {
  user.collection[cardId] = (user.collection[cardId] || 0) + 1;
  return user.collection[cardId];
}

module.exports = {
  loadCards,
  loadUsers,
  saveUsers,
  getOrCreateUser,
  incrementCard
};