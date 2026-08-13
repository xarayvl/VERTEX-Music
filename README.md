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

## AI DJ and Web Search

The AI DJ uses NVIDIA's OpenAI-compatible API with `openai/gpt-oss-120b` by
default. Set `NVIDIA_API_KEY` to enable chat. `NVIDIA_CHAT_MODEL` and
`NVIDIA_API_BASE_URL` can override the model or endpoint.

The AI DJ receives live search as an OpenAI-compatible function tool and decides
when current information requires it. Users can require a search for a specific
message with the globe button. Live web search uses the Tavily Search API. Set
`TAVILY_API_KEY` to enable it.

## Persistence

- Without Upstash, canonical application data is stored in `data/db.json`.
- Without Cloudflare R2, uploaded media is stored under `data/uploads`.
- Upstash and R2 credentials are optional but recommended for deployed environments.
- The admin Error log retains up to 1,000 redacted server/browser errors in
  Redis and uses `data/error-log.jsonl` as a bounded local fallback. Override
  the fallback path with `VERTEX_ERROR_LOG_FILE` when needed.

Authentication uses a `Secure`, `HttpOnly`, `SameSite=Lax` host cookie. Session
records are digest-keyed in Redis with a 7-day absolute lifetime and 24-hour
idle lifetime by default; `SESSION_ABSOLUTE_TTL_SECONDS` and
`SESSION_IDLE_TTL_SECONDS` can shorten those limits. Set `PUBLIC_BASE_URL` to
the deployed HTTPS origin so mutation requests can be checked against the
canonical same-origin value. Multi-instance deployments must configure
Upstash; without it, sessions intentionally fall back to the current process.

## Shared track previews

Track links (`/track/:id`) include server-rendered Open Graph and Twitter Card
metadata so Instagram, Discord and other link-preview crawlers can show the
track title, artist and cover art. If the app is behind a proxy, set
`PUBLIC_BASE_URL` to the public HTTPS origin (for example,
`https://music.example.com`) so canonical and image URLs are always generated
with the correct domain.

The repository ships with an empty database. It does not create demo users, tracks, artists, playlists, likes, follows, listening history, or chat history.
