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
- Cloudflare R2 is the only managed upload store. Uploads, reads, and deletions
  fail when R2 is unavailable; media is never copied to local application disk.
- Set every required Upstash and R2 variable shown in `.env.example` before
  starting the application. `R2_PUBLIC_DOMAIN` remains optional because media
  can be served through the application's rate-limited R2 proxy route.

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
