# Mooniemon

Mooniemon is a `discord.js` v14 bot for running a guild-scoped trading card collector system in Discord. Each Discord server has its own card pool, pull cooldowns, and user collections, all backed by Postgres.

## Features

- Slash commands: `/pull` and `/view`
- Per-server game isolation using `interaction.guildId`
- Weighted rarity pulls with duplicate cards allowed
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
npm run cards:import -- --guildId=YOUR_DISCORD_SERVER_ID --guildName=\"Your Server Name\"
```

Deploy slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

## Render Deployment

Set these environment variables in Render:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` if you want guild-scoped command deploys
- `DATABASE_URL`
- `DATABASE_SSL`
- `DATABASE_SCHEMA=mooniemon`

Suggested deploy flow:

1. Create the web service or background worker in Render.
2. Add the environment variables above.
3. Run `npm install` during build.
4. Run `npm run db:init` once against the target database.
5. Run `npm run cards:import -- --guildId=... --guildName=\"...\"` for each server you want to seed.
6. Run `npm run deploy` to register slash commands.
7. Start the bot with `npm start`.

## Database Model

The bot uses these core tables:

- `guilds`
- `guild_settings`
- `cards`
- `guild_users`
- `user_card_instances`

Design notes:

- Cards are stored per guild/server
- Pull cooldowns are stored per guild user
- Each pull creates a `user_card_instances` row, so duplicates are naturally supported
- HP and holo flags live in persistent storage for future battle features

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

## Repo Notes

- Runtime secrets are not stored in git
- Use `.env` locally and Render environment variables in production
- `config.json` is ignored and no longer used by the runtime
