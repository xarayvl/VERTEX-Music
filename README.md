<div align="center">

# 🎵 VERTEX Music

**A full-stack, music streaming platform with real accounts, real storage, and AI-generated music.**

[![Status](https://img.shields.io/badge/status-private%20%2F%20not%20public-critical)](#-private-project--not-open-for-public-use-or-contribution)
[![Made with React](https://img.shields.io/badge/Made%20with-React%2018-61DAFB?logo=react&logoColor=white)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%20%2F%20Lyria-8E75B2)](#-ai-features)

</div>

<br/>

> ## 🔒 Private Project — Not Open for Public Use or Contribution
> This is a **single-developer project**, not an open-source or community codebase. It is **not currently intended for public release, redistribution, or deployment**, and it is **not open to outside contributions, pull requests, or forks**. Please don't copy, modify, or redistribute this code without explicit permission from the owner.

<br/>

## About VERTEX Music

VERTEX Music is a Spotify-style music web app with a working Express + TypeScript backend behind it — not just a UI mockup. It has real user accounts (bcrypt-hashed passwords, sessions), persistent storage for tracks/playlists/users, file uploads for audio and cover art, and a built-in AI DJ/chat assistant plus AI music generation powered by Google's Gemini and Lyria models.

> **Note:** The codebase's internal package name / working title is `sonora` (visible in `index.html` and the project directory) — the app itself, and the AI assistant embedded in it ("VERTEX Music AI"), are branded **VERTEX Music**. VERTEX Music is an independent project and is **not affiliated with Spotify AB**.

<br/>

## ✨ Features

- Spotify-style dark UI — sidebar, search, artist/album/playlist pages, now playing view
- Real accounts — signup/login, profiles, follow system
- Library — playlists, liked songs, recently played, listening stats
- Real playback — Web Audio engine with EQ, visualizer, and queue
- AI DJ chat assistant for recommendations and playlist ideas
- AI music generation (via Lyria) from a text prompt
- Upload your own tracks and cover art

<br/>

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** Upstash Redis (falls back to a local JSON file)
- **File storage:** Cloudflare R2 (falls back to local disk)
- **AI:** Google Gemini + Lyria

<br/>

## 🚀 Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

You'll need a `GEMINI_API_KEY` for the AI chat and music generation features (see `.env.example`). Cloudflare R2 and Upstash Redis are optional — without them, everything just runs locally.

<br/>

## 📁 Project Structure

```
├── server.ts          # Express API (auth, tracks, playlists, search, AI)
├── server/db.ts        # Database layer (Redis + local fallback)
├── src/
│   ├── audio/          # Web Audio playback engine
│   ├── components/     # Modals, navigation, player, views
│   ├── App.tsx          # Main app
│   └── main.tsx         # Entry point
└── data/db.json         # Local fallback database
```

<br/>

## ⚖️ Disclaimer

VERTEX Music is an independent non-serious project. It doesn't claim ownership of any third-party music, artwork, or branding used during development.

<br/>

## 📄 License

Private project — all rights reserved.

<div align="center">

Made with ❤️ for music lovers.

</div>
