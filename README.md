<div align="center">

# 🎵 VERTEX Music

**A full-stack, music streaming platform with real accounts, real storage, and AI-generated music using Lyria AI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Made with React](https://img.shields.io/badge/Made%20with-React%2018-61DAFB?logo=react&logoColor=white)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%20%2F%20Lyria-8E75B2)](#-ai-features)

</div>

<br/>

## About VERTEX Music

VERTEX Music is a music web app with a working Express + TypeScript backend behind it — not just a UI mockup. It has real user accounts (bcrypt-hashed passwords, sessions), persistent storage for tracks/playlists/users, file uploads for audio and cover art, and a built-in AI DJ/chat assistant plus AI music generation powered by Google's Gemini and Lyria models.

> **Note:** The codebase's internal package name / working title is `sonora` (visible in `index.html` and the project directory) — the app itself, and the AI assistant embedded in it ("VERTEX Music AI"), are branded **VERTEX Music**. VERTEX Music is an independent project and is **not affiliated with any major music streaming service.**.

<br/>

## ✨ Features

**Core Experience**
- 🎨 Spotify-style dual-sidebar layout with dark theme and ambient mouse-spotlight effects
- 📱 Responsive desktop layout + dedicated mobile bottom tab bar
- 🔍 Global search across tracks, artists, and playlists
- 🎤 Artist profile pages with follow/unfollow, verification badges, and an "Artist Pick" spotlight track
- 💿 Album, track, and full-screen "Now Playing" views
- 👤 User profiles with avatars, banners, bio, and social links

**Accounts & Data**
- 🔐 Real authentication — registration & login with bcrypt password hashing and session persistence
- 📚 Personal library, liked songs, and recently played tracks
- 📝 Playlist creation, editing, and management
- 📈 Per-user listening statistics (hours listened, top genre, tracks played, followers)
- ⬆️ Upload your own tracks and cover art (stored on Cloudflare R2, with local-disk fallback)

**Playback**
- 🎧 Real Web Audio API playback engine (not a simulated player) with a persistent bottom playback bar
- 🎚️ Built-in audio EQ (bass / mid / treble) and volume control
- 📊 Live audio visualizer driven by an `AnalyserNode`
- 🔊 Simulated device switcher (browser, headphones, speaker, etc.)
- 📜 Queue management and mini-player

**🤖 AI Features**
- 💬 **AI DJ chat assistant** ("VERTEX Music AI") — recommends songs, curates playlist concepts, explains genres and moods, powered by the Gemini API
- 🎼 **AI music generation** — generate original tracks (clip or full-length) from a text prompt using Google's Lyria models, complete with auto-assigned cover art and genre
- 🧠 Chat history persisted per user

<br/>

## 🛠️ Tech Stack

| Area | Technology |
|------|------------|
| **Frontend** | React 18 · TypeScript · Vite 6 · Tailwind CSS 4 |
| **Animation** | Motion (Framer Motion successor) |
| **Icons** | lucide-react |
| **Backend** | Node.js · Express · tsx (dev) / esbuild (prod bundle) |
| **Auth** | bcryptjs password hashing + server-side sessions |
| **Database** | Upstash Redis (primary), with local `data/db.json` file as fallback/mirror |
| **Object Storage** | Cloudflare R2 (via AWS S3-compatible client), with local-disk fallback |
| **AI** | Google Gemini API (`@google/genai`) — chat assistant & Lyria music generation |
| **Cloud Storage (optional)** | `@google-cloud/storage` dependency present for GCS integration |

> The frontend and backend live in the same repo and are served together — Express serves the API routes and, via Vite's dev/prod pipeline, the client app itself.

<br/>

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm (or Bun — a `bun.lock` is included as an alternative)
- A [Gemini API key](https://ai.google.dev/) for AI chat & music generation

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (see below)
cp .env.example .env

# 3. Start the dev server (runs the Express + Vite server together)
npm run dev
```

The app will be available at the local URL printed in your terminal.

### Environment Variables

Create a `.env` file in the project root (see `.env.example` for the full list):

```env
# Required for the AI chat assistant and Lyria music generation
GEMINI_API_KEY="your-gemini-api-key"

# Optional — where this app is hosted (used for self-referential links/callbacks)
APP_URL="http://localhost:5173"

# Optional — Cloudflare R2 for persistent audio/cover/avatar storage.
# Without these, uploads fall back to local disk.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_DOMAIN=

# Optional — Upstash Redis for persistent user/track/playlist data.
# Without these, data falls back to the local data/db.json file.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

> ⚠️ **Never commit real passwords, API keys, or secret tokens to GitHub.**

Only `GEMINI_API_KEY` is strictly required to run the app locally with AI features enabled. Without R2 / Upstash credentials, Sonora still works fully — it just stores data and files locally instead of in the cloud.

<br/>

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Express + Vite dev server (`tsx server.ts`) |
| `npm run build` | Builds the client with Vite and bundles the server with esbuild |
| `npm run start` | Runs the production server bundle (`dist/server.cjs`) |
| `npm run preview` | Previews the production client build |
| `npm run clean` | Removes build output |
| `npm run lint` | Type-checks the project with `tsc --noEmit` |

<br/>

## 📁 Project Structure

```
vertex-music/          # working directory name may still show as "sonora" locally
├── server.ts                 # Express app: auth, tracks, playlists, search, AI chat & music gen
├── server/
│   └── db.ts                  # Upstash Redis client + local-disk fallback persistence layer
├── data/
│   └── db.json                 # Local fallback database file
├── src/
│   ├── audio/
│   │   └── audioEngine.ts     # Web Audio API playback engine (EQ, analyser, gain)
│   ├── components/
│   │   ├── Modals/            # Auth, add/edit track, playlist, EQ, device selector, profile, etc.
│   │   ├── Navigation/        # Sidebar, top header, mobile bottom tab bar
│   │   ├── Player/            # Playback bar, mini player, now-playing sidebar, visualizer
│   │   └── Views/              # Home, Search, Browse, Library, Artist, Album, Playlist, Chat, Profile
│   ├── data/                   # Static browse category data
│   ├── utils/                  # Artist utilities, cover colors, profile placeholders
│   ├── types.ts                # Shared TypeScript types
│   ├── App.tsx                 # Root application component & view routing
│   └── main.tsx                # Client entry point
├── firestore.rules             # Firestore security rules (scaffold; not currently wired up)
├── .env.example
├── package.json
└── vite.config.ts
```

<br/>

## 🔌 API Overview

The Express server exposes a REST API under `/api`, including:

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register`, `/api/auth/login` | Account creation & login |
| `GET /api/data` | Bulk fetch of users/tracks/playlists |
| `GET /api/search` | Global search |
| `GET/PUT /api/users/:userId` | Profile fetch & update |
| `POST /api/users/:userId/follow` | Follow/unfollow an artist |
| `POST/PUT/DELETE /api/tracks` | Upload, edit, and delete tracks |
| `POST/PUT/DELETE /api/playlists` | Create, edit, and delete playlists |
| `POST /api/user-state/:userId/liked-tracks` | Manage liked songs |
| `POST /api/generate-music` | Generate an AI track via Lyria |
| `POST /api/chat`, `GET/POST/DELETE /api/chat-history/:userId` | AI DJ chat assistant |
| `GET /api/system-status` | Check whether R2 / Upstash integrations are active |

<br/>

## ⚖️ Disclaimer

VERTEX Music is an independent educational and portfolio project. It does not claim ownership of third-party music, album artwork, artist images, trademarks, or branding. Any external media used during development should be properly licensed or replaced before public distribution. AI-generated music and chat responses are produced by third-party models (Google Gemini/Lyria) and subject to their respective terms of use.

<br/>

## 📄 License

This project is licensed under the MIT License.

<div align="center">

Made with ❤️ for music lovers.

</div><div align="center">

# 🎵 VERTEX Music

**A modern, Spotify-inspired music streaming experience**

Discover music, explore artists, build playlists, and enjoy a clean, responsive interface designed for desktop and mobile.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Status](https://img.shields.io/badge/status-active%20development-brightgreen)](#project-status)
[![Made with Node.JS](https://img.shields.io/badge/Made%20with-React-61DAFB?logo=react&logoColor=white)](#tech-stack)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](#contributing)

[Features](#-features) · [Getting Started](#-getting-started) · [Tech Stack](#-tech-stack) · [Contributing](#-contributing)

</div>

<br/>

## 📸 Preview

<div align="center">

![VERTEX Music Preview](./assets/vertex-preview.png)

<sub>Replace this with a real screenshot or demo GIF once available.</sub>

</div>

> **Note:** VERTEX Music is an independent project and is **not affiliated with Spotify AB**.

<br/>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

**Core Experience**
- 🎨 Modern, dark-themed music streaming UI
- 📱 Fully responsive — desktop & mobile
- 🔍 Music search
- 🎤 Artist profile pages
- 💿 Album & track pages
- 👤 User profiles

</td>
<td width="50%" valign="top">

**Playback & Library**
- 📚 Personal music library
- 📝 Playlist creation & management
- ❤️ Favorites and liked songs
- ⏱️ Recently played tracks
- 🎧 Playback controls & queue view
- 🧭 Sidebar navigation with smooth transitions

</td>
</tr>
</table>

<details>
<summary><strong>🛣️ Planned Features</strong></summary>
<br/>

- 🔐 User authentication
- 🔄 Real-time synchronized playback
- 🎼 Lyrics support
- 📊 Audio visualizer
- 🤝 Collaborative playlists
- 👥 Social activity & friend system
- ✅ Artist verification system
- 🎯 Personalized recommendations
- 📈 Listening statistics
- 📴 Offline playback
- 🖥️ Desktop application
- 🌐 Progressive Web App support

</details>

<br/>

## 🛠️ Tech Stack

> Update this section to match the technologies actually used in your project.

| Area | Technology |
|------|------------|
| **Frontend** | React · JavaScript / TypeScript |
| **Styling** | CSS · Tailwind CSS |
| **Backend** | Node.js · Express |
| **Database** | PostgreSQL · MongoDB |
| **Authentication** | JWT · OAuth |
| **Deployment** | Vercel · Render |

<br/>

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm, pnpm, or Yarn
- [Git](https://git-scm.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/vertex-music.git

# 2. Open the project directory
cd vertex-music

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

Then open the local URL shown in your terminal. 🎉

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:3000
```

Add any other API keys, database URLs, or authentication secrets required by your project.

> ⚠️ **Never commit real passwords, private API keys, or secret tokens to GitHub.**

<br/>

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm run preview` | Previews the production build |
| `npm run lint` | Checks the project for code issues |

<br/>

## 📁 Project Structure

```
vertex-music/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── context/
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── package.json
└── README.md
```

<br/>

## 🧭 Project Status

VERTEX Music is currently **under active development**. Features, designs, and project structure may change as development continues.

<br/>

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. **Fork** the repository
2. **Create** a new branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit** your changes
   ```bash
   git commit -m "Add your feature"
   ```
4. **Push** the branch
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open** a pull request

<br/>

## ⚖️ Disclaimer

VERTEX Music is an independent educational and portfolio project. The project does not claim ownership of third-party music, album artwork, artist images, trademarks, or branding. Any external media used during development should be properly licensed or replaced before public distribution.

<br/>

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<br/>

<div align="center">

Made with ❤️ for music lovers.

**VERTEX Music**

</div>
