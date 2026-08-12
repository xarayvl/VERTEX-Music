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

The image-generation button uses Qwen Image through a separate NVIDIA Visual
GenAI NIM. Set `NVIDIA_IMAGE_API_BASE_URL` to that NIM's base URL (for example,
`http://localhost:8000`), optionally set `NVIDIA_IMAGE_API_KEY` when the endpoint
requires bearer authentication, and use `NVIDIA_IMAGE_MODEL` to override the
default `qwen/qwen-image-2512`. Generated images are saved to the signed-in
user's normal local/R2 media storage before they are added to chat history.

## Persistence

- Without Upstash, canonical application data is stored in `data/db.json`.
- Without Cloudflare R2, uploaded media is stored under `data/uploads`.
- Upstash and R2 credentials are optional but recommended for deployed environments.

## Shared track previews

Track links (`/track/:id`) include server-rendered Open Graph and Twitter Card
metadata so Instagram, Discord and other link-preview crawlers can show the
track title, artist and cover art. If the app is behind a proxy, set
`PUBLIC_BASE_URL` to the public HTTPS origin (for example,
`https://music.example.com`) so canonical and image URLs are always generated
with the correct domain.

The repository ships with an empty database. It does not create demo users, tracks, artists, playlists, likes, follows, listening history, or chat history.
