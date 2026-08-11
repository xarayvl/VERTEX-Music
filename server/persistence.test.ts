import assert from "node:assert/strict";
import test from "node:test";
import { getUpstashClient, sanitizeDBData } from "./db.js";

test("Upstash credentials are mandatory", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    assert.throws(
      () => getUpstashClient(),
      /UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required/,
    );
  } finally {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test("database hydration rejects media that bypasses R2 upload persistence", () => {
  const user = {
    id: "user_remote_media",
    username: "remote-media",
    email: "remote-media@example.com",
    password: "stored-password-hash",
    displayName: "Remote Media",
    avatarUrl: "",
    bio: "",
    favoriteGenres: [],
    createdAt: "2026-08-11T00:00:00.000Z",
  };
  const baseTrack = {
    userId: user.id,
    title: "Remote Track",
    artist: "Remote Media",
    album: "Single",
    coverUrl: "/api/r2-file/user_remote_media/cover.jpg",
    duration: 180,
    genre: "Electronic",
  };

  const result = sanitizeDBData({
    users: [user],
    playlists: [],
    tracks: [
      { ...baseTrack, id: "remote_track", audioUrl: "/api/r2-file/user_remote_media/audio.mp3" },
      { ...baseTrack, id: "local_track", audioUrl: "/uploads/user_remote_media/audio.mp3" },
      { ...baseTrack, id: "inline_track", audioUrl: "data:audio/mpeg;base64,AAAA" },
    ],
    userStates: {},
    chatHistories: {},
  });

  assert.deepEqual(result.tracks.map((track) => track.id), ["remote_track"]);
});
