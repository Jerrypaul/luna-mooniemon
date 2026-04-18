const {
  ensureMinecraftLinksTable,
  getMinecraftLink,
  upsertMinecraftLink,
  deleteMinecraftLink,
  updateMinecraftLinkState,
  getExpiredMinecraftLinks,
  listMinecraftLinks
} = require('../../repositories/minecraft-link-repository');

async function loadLinks() {
  await ensureMinecraftLinksTable();
  return listMinecraftLinks();
}

async function getLink(discordUserId) {
  return getMinecraftLink(discordUserId);
}

async function upsertLink({ discordUserId, minecraftUsername, lastKnownSubRole = false }) {
  return upsertMinecraftLink({ discordUserId, minecraftUsername, lastKnownSubRole });
}

async function removeLink(discordUserId) {
  return deleteMinecraftLink(discordUserId);
}

async function setWhitelistState(discordUserId, isWhitelisted) {
  return updateMinecraftLinkState(discordUserId, { isWhitelisted });
}

async function setGraceUntil(discordUserId, graceUntil) {
  return updateMinecraftLinkState(discordUserId, { graceUntil });
}

async function clearGraceUntil(discordUserId) {
  return setGraceUntil(discordUserId, null);
}

async function setLastKnownSubRole(discordUserId, lastKnownSubRole) {
  return updateMinecraftLinkState(discordUserId, { lastKnownSubRole });
}

async function getExpiredGraceLinks(now = Date.now()) {
  return getExpiredMinecraftLinks(now);
}

module.exports = {
  loadLinks,
  getLink,
  upsertLink,
  removeLink,
  setWhitelistState,
  setGraceUntil,
  clearGraceUntil,
  setLastKnownSubRole,
  getExpiredGraceLinks
};
