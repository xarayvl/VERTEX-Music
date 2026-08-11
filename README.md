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
- Cloudflare R2 is the only managed upload store. `R2_PRIVATE_BUCKET_NAME` is
  the owner-only staging bucket and must be distinct from the public catalog
  `R2_BUCKET_NAME`; the server refuses to start when they are the same. If the
  private bucket is omitted, the server remains available for existing public
  catalog media, but all `/api/uploads` endpoints return `503` until it is set.
- Set every required Upstash and R2 variable shown in `.env.example` before
  starting the application. Disable both r2.dev public access and custom
  domains on the private bucket. `R2_PUBLIC_DOMAIN`, when used, must be attached
  only to the public bucket and must be a separate cookieless HTTPS origin.
- Browser uploads use five-minute presigned PUT URLs into the private bucket.
  Configure its CORS policy for the exact `PUBLIC_BASE_URL` origin (no `*`) and
  allow `PUT`/`GET` plus `Content-Type`, `Content-Disposition`, `Cache-Control`,
  and `Range`. Staged reads require an active owner session and redirect to a
  one-minute signed GET URL with `private, no-store` caching.
- A verified staged object is copied to the public bucket only when it is saved
  into a profile, track/release, or playlist record. The public fallback proxy
  serves only `public/` keys and referenced legacy catalog objects; its CORS
  response is limited to `PUBLIC_BASE_URL` rather than wildcard access.
- Before enabling the split-bucket deployment, migrate referenced legacy media
  to the public bucket and remove unreferenced objects. The application cannot
  inspect Cloudflare dashboard public-access switches, so the private bucket's
  disabled public access remains a required deployment control.
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
- To enable uploads, create a second, non-public R2 bucket and set its exact
  name as `R2_PRIVATE_BUCKET_NAME` in the Render service environment. Save and
  redeploy the service; do not reuse `R2_BUCKET_NAME` for this value.
