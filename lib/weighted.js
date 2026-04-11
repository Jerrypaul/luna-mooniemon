const DEFAULT_WEIGHTS = {
  Common: 55,
  Uncommon: 25,
  Rare: 12,
  Epic: 6,
  Legendary: 2
};

function weightedRarityRoll(weights = DEFAULT_WEIGHTS) {
  const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);

  if (!entries.length) {
    return null;
  }

  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  const roll = Math.random() * total;

  let current = 0;
  for (const [rarity, weight] of entries) {
    current += Number(weight);
    if (roll <= current) {
      return rarity;
    }
  }

  return entries[entries.length - 1][0];
}

function randomFromArray(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

module.exports = {
  DEFAULT_WEIGHTS,
  weightedRarityRoll,
  randomFromArray
};
