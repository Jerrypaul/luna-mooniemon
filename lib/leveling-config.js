const { DEFAULT_LEVELING_ROLE_REWARDS } = require('./constants');

const ROLE_REWARD_DEFINITIONS = [
  { level: 1, label: 'Level 1' },
  { level: 3, label: 'Verified' },
  { level: 5, label: 'Regular' },
  { level: 10, label: 'Starlight' }
];

function normalizeIgnoredChannelIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizeRoleRewards(value) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = { ...DEFAULT_LEVELING_ROLE_REWARDS };

  for (const definition of ROLE_REWARD_DEFINITIONS) {
    const roleId = source[String(definition.level)] || source[definition.level];
    normalized[definition.level] = roleId ? String(roleId).trim() : null;
  }

  return normalized;
}

function getConfiguredRoleRewards(roleRewards) {
  const normalized = normalizeRoleRewards(roleRewards);

  return ROLE_REWARD_DEFINITIONS
    .map((definition) => ({
      ...definition,
      roleId: normalized[definition.level]
    }))
    .filter((reward) => Boolean(reward.roleId));
}

module.exports = {
  ROLE_REWARD_DEFINITIONS,
  normalizeIgnoredChannelIds,
  normalizeRoleRewards,
  getConfiguredRoleRewards
};
