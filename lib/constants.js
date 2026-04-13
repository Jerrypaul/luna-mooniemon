const DEFAULT_WEIGHTS = {
  Common: 55,
  Uncommon: 25,
  Rare: 12,
  Epic: 6,
  Legendary: 2
};

const DEFAULT_PULL_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const DEFAULT_LEVELING_ROLE_REWARDS = {
  1: null,
  3: null,
  5: null,
  10: null
};

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_PULL_COOLDOWN_MS,
  DEFAULT_LEVELING_ROLE_REWARDS
};
