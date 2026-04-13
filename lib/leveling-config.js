const { getOptionalEnv, getRequiredEnv } = require('./env');

const ROLE_REWARDS = [
  { level: 1, roleIdEnv: 'LEVELING_LEVEL_1_ROLE_ID', label: 'Level 1' },
  { level: 3, roleIdEnv: 'LEVELING_VERIFIED_ROLE_ID', label: 'Verified' },
  { level: 5, roleIdEnv: 'LEVELING_REGULAR_ROLE_ID', label: 'Regular' },
  { level: 10, roleIdEnv: 'LEVELING_STARLIGHT_ROLE_ID', label: 'Starlight' }
];

function getTargetGuildId() {
  return getRequiredEnv('LEVELING_GUILD_ID');
}

function getIgnoredChannelIds() {
  const raw = getOptionalEnv('LEVELING_IGNORED_CHANNEL_IDS', '');
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function getConfiguredRoleRewards() {
  return ROLE_REWARDS
    .map((reward) => ({
      ...reward,
      roleId: getOptionalEnv(reward.roleIdEnv)
    }))
    .filter((reward) => Boolean(reward.roleId));
}

module.exports = {
  getTargetGuildId,
  getIgnoredChannelIds,
  getConfiguredRoleRewards
};
