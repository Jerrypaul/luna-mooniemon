# Mooniemon

Mooniemon is a `discord.js` v14 bot for running a guild-scoped trading card collector system in Discord. It also includes a lightweight message-based leveling system for Luna's community server. All persistent data is backed by Postgres.

## Features

- Slash commands: `/pull` and `/view`
- Per-server game isolation using `interaction.guildId`
- Weighted rarity pulls with duplicate cards allowed
- Lightweight leveling worker for Luna's community server
- XP persistence, level thresholds, automatic role rewards, and role backfill support
- Postgres-backed storage for cards, guild settings, users, and card instances
- JSON import flow for seeding cards into a server
- Schema prepared for future battle support with persistent HP and holo variants

## Stack

- Node.js `18+`
- `discord.js` `v14`
- Postgres

## Environment Variables

Create a local `.env` file based on [.env.example](/C:/Chat-GPT-Codex/Mooniemon/.env.example).

Required:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DATABASE_URL`

Optional:

- `DISCORD_GUILD_ID`
- `DATABASE_SSL`
- `DATABASE_SCHEMA`
- `LEVELING_GUILD_ID`
- `LEVELING_IGNORED_CHANNEL_IDS`
- `LEVELING_LEVEL_1_ROLE_ID`
- `LEVELING_VERIFIED_ROLE_ID`
- `LEVELING_REGULAR_ROLE_ID`
- `LEVELING_STARLIGHT_ROLE_ID`

Recommended shared-database setup:

- Point `DATABASE_URL` at the same Postgres instance used by other projects if needed
- Set `DATABASE_SCHEMA=mooniemon` so this bot stays isolated inside its own schema

## Local Setup

Install dependencies:

```bash
npm install
```

Initialize the database schema:

```bash
npm run db:init
```

Import cards for a Discord server:

```bash
npm run cards:import -- --guildId=YOUR_DISCORD_SERVER_ID --guildName="Your Server Name"
```

Deploy slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

Backfill leveling roles for existing members:

```bash
npm run leveling:sync-roles
```

## Discord App Setup

Enable these gateway intents for the bot:

- `Server Members Intent`
- `Message Content Intent`

The worker needs those intents because the leveling system reads message content and awards roles when users level up.

## Render Deployment

Set these environment variables in Render:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` if you want guild-scoped command deploys
- `DATABASE_URL`
- `DATABASE_SSL`
- `DATABASE_SCHEMA=mooniemon`
- `LEVELING_GUILD_ID`
- `LEVELING_IGNORED_CHANNEL_IDS`
- `LEVELING_LEVEL_1_ROLE_ID`
- `LEVELING_VERIFIED_ROLE_ID`
- `LEVELING_REGULAR_ROLE_ID`
- `LEVELING_STARLIGHT_ROLE_ID`

Suggested deploy flow:

1. Create the web service or background worker in Render.
2. Add the environment variables above.
3. Run `npm install` during build.
4. Run `npm run db:init` once against the target database.
5. Run `npm run cards:import -- --guildId=... --guildName="..."` for each server you want to seed.
6. Run `npm run deploy` to register slash commands.
7. Start the bot with `npm start`.
8. Run `npm run leveling:sync-roles` when you add or change role thresholds and want to backfill existing members.

## Branch Workflow

Recommended branch usage:

- `main` is the production branch
- `staging` is the working branch for future updates

Suggested flow:

1. Make changes on `staging`.
2. Test there first.
3. Merge `staging` into `main` only when you want Render to deploy.

## Database Model

The bot uses these core tables:

- `guilds`
- `guild_settings`
- `cards`
- `guild_users`
- `user_card_instances`
- `guild_leveling_profiles`
- `leveling_message_hashes`

Design notes:

- Cards are stored per guild/server
- Pull cooldowns are stored per guild user
- Each pull creates a `user_card_instances` row, so duplicates are naturally supported
- HP and holo flags live in persistent storage for future battle features
- Leveling profiles and duplicate message hashes are stored separately from Mooniemon card data

## Card Seeding

Seed data is still supported through [cards.json](/C:/Chat-GPT-Codex/Mooniemon/cards.json).

The import script:

- reads `cards.json`
- ensures the target guild exists
- replaces that guild's card pool in Postgres
- preserves server isolation by importing cards only into the specified guild

## Commands

`/pull`

- checks the guild-specific cooldown
- rolls a rarity using guild settings
- chooses a random card from that guild's pool
- creates a new owned card instance for the user

`/view`

- shows the user's collection for the current server only
- supports `card:<name>` to inspect a specific card from that server's pool

## Leveling System

The leveling logic runs in the same worker process as Mooniemon but is kept separate in its own service and repository modules.

V1 rules:

- only real users count, never bots
- only messages in `LEVELING_GUILD_ID` count
- minimum message length is 8 characters
- attachments-only messages do not count
- duplicate or repeated normalized messages do not count
- ignored channels do not count
- each user has a 60 second XP cooldown
- valid messages award a random 15 to 25 XP

Current role rewards:

- Level 1: Starter
- Level 3: Verified
- Level 5: Regular
- Level 10: Starlight

Backfill behavior:

- `npm run leveling:sync-roles` checks stored levels in Postgres
- it fetches matching guild members from Discord
- it assigns any configured missing roles for members already at or above each threshold

## Repo Notes

- Runtime secrets are not stored in git
- Use `.env` locally and Render environment variables in production
- `config.json` is ignored and no longer used by the runtime
