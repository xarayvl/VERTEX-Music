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

- Upstash Redis is the only canonical database and session store. The server
  refuses to start when its URL or token is missing and does not fall back to
  local JSON or in-memory-only sessions.
- `DATA_ENCRYPTION_KEY` is required and must decode to exactly 32 bytes. The
  canonical snapshot, recovery backup, and per-user entity values are stored as
  authenticated AES-256-GCM envelopes, covering email, password hashes, Google
  subjects, and chat history. Existing plaintext values are migrated on startup.
- Chat history is limited to the newest 200 messages within
  `CHAT_RETENTION_DAYS` (30 days by default, at most 365). Expired messages are
  physically removed on startup/access and by an hourly unref'd retention
  sweep. Clearing chat history also deletes the recovery snapshot so it cannot
  retain the cleared conversation.
- Recovery snapshots use a real Redis expiry controlled by
  `DB_BACKUP_TTL_SECONDS` (7 days by default, at most 90). Active canonical and
  entity records remain until their account data is deleted. Rotating or losing
  `DATA_ENCRYPTION_KEY` without first re-encrypting the data makes it unreadable;
  keep the key in the deployment secret manager, never in source control.
- `UPSTASH_DB_CACHE_TTL_MS` controls only the in-process read cache and is not a
  Redis retention or deletion setting.
- Cloudflare R2 is the only managed upload store. Images and audio use the
  single bucket configured by `R2_BUCKET_NAME`; no private/public bucket split
  or server-side copy/promotion step is required.
- Browser uploads use five-minute presigned PUT URLs directly into that bucket.
  Configure its CORS policy for the exact `PUBLIC_BASE_URL` origin (no `*`) and
  allow `PUT`/`GET` plus `Content-Type`, `Content-Disposition`, `Cache-Control`,
  and `Range`. Completed uploads immediately receive their permanent media URL.
- `R2_PUBLIC_DOMAIN`, when used, must point to `R2_BUCKET_NAME` and remain a
  separate cookieless HTTPS origin. A custom domain is served directly.
  Cloudflare's `*.r2.dev` development URL (and deployments without a public
  domain) stays behind the hardened `/api/r2-file/*` proxy, so media reads do
  not depend on public-development access or cross-origin Web Audio headers.
- Metadata still travels through Express and is limited to 64 KB.
- `USER_STORAGE_QUOTA_BYTES` defaults to 2 GiB per account and
  `MAX_AUDIO_UPLOAD_BYTES` defaults to 100 MiB per file.

## Shared track previews

Track links (`/track/:id`) include server-rendered Open Graph and Twitter Card
metadata so Instagram, Discord and other link-preview crawlers can show the
track title, artist and cover art. If the app is behind a proxy, set
`PUBLIC_BASE_URL` to the public HTTPS origin (for example,
`https://music.example.com`) so canonical and image URLs are always generated
with the correct domain.

The repository ships with no local database. If the configured Upstash database
has no canonical key, the server initializes an empty remote database; it never
creates demo users, tracks, artists, playlists, likes, follows, listening
history, or chat history.

## Render deployment

- The server listens on Render's `PORT` automatically.
- `PUBLIC_BASE_URL` remains recommended for custom domains. On Render, the
  platform-provided `RENDER_EXTERNAL_URL` is used when `PUBLIC_BASE_URL` is not
  set.
- Set `R2_BUCKET_NAME` to the single bucket used by uploads and media reads;
  no second R2 bucket is required.
