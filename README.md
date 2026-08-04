# VERTEX Music

A server-backed React/Express music application with authenticated users, artist profiles, owned tracks and playlists, playback history, likes, follows, search, audio uploads, EQ controls, and optional AI chat.

## Requirements

- Node.js 20 or newer
- npm

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and configure only the services you use.
3. Start development mode with `npm run dev`.
4. Open `http://localhost:3000`.

## Persistence

- Without Upstash, canonical application data is stored in `data/db.json`.
- Without Cloudflare R2, uploaded media is stored under `data/uploads`.
- Upstash and R2 credentials are optional but recommended for deployed environments.

The repository ships with an empty database. It does not create demo users, tracks, artists, playlists, likes, follows, listening history, or chat history.
