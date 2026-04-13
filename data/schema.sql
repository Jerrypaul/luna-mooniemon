CREATE TABLE IF NOT EXISTS guilds (
  id BIGSERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id BIGINT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  pull_cooldown_ms BIGINT NOT NULL DEFAULT 14400000,
  rarity_weights JSONB NOT NULL DEFAULT '{"Common":55,"Uncommon":25,"Rare":12,"Epic":6,"Legendary":2}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_leveling_settings (
  guild_id BIGINT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ignored_channel_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_rewards JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id BIGSERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  external_card_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  base_hp INTEGER NOT NULL DEFAULT 100,
  current_hp INTEGER NOT NULL DEFAULT 100,
  is_holo BOOLEAN NOT NULL DEFAULT FALSE,
  variant_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, external_card_id)
);

CREATE TABLE IF NOT EXISTS guild_users (
  id BIGSERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  last_pull_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, discord_user_id)
);

CREATE TABLE IF NOT EXISTS user_card_instances (
  id BIGSERIAL PRIMARY KEY,
  guild_user_id BIGINT NOT NULL REFERENCES guild_users(id) ON DELETE CASCADE,
  card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  instance_hp INTEGER NOT NULL,
  is_holo BOOLEAN NOT NULL DEFAULT FALSE,
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_leveling_profiles (
  id BIGSERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  last_xp_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, discord_user_id)
);

CREATE TABLE IF NOT EXISTS leveling_message_hashes (
  id BIGSERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_message_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_guild_id ON cards (guild_id);
CREATE INDEX IF NOT EXISTS idx_cards_guild_rarity ON cards (guild_id, rarity);
CREATE INDEX IF NOT EXISTS idx_guild_users_scope ON guild_users (guild_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_user_card_instances_user ON user_card_instances (guild_user_id);
CREATE INDEX IF NOT EXISTS idx_leveling_profiles_scope ON guild_leveling_profiles (guild_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_leveling_hashes_lookup ON leveling_message_hashes (guild_id, discord_user_id, content_hash);
