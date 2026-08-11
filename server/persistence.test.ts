import assert from "node:assert/strict";
import test from "node:test";
import { decryptPersistedJson, encryptPersistedJson, getUpstashClient, sanitizeDBData, syncUpstashIndices } from "./db.js";

test("sensitive Redis JSON is encrypted with authenticated AES-256-GCM", () => {
  const originalKey = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const sensitive = {
      email: "owner@example.com",
      password: "$2b$10$sensitive-password-hash",
      googleId: "google-subject",
      chatHistories: { user: [{ text: "private conversation" }] },
    };
    const encrypted = encryptPersistedJson(sensitive, "canonical-db");

    assert.match(encrypted, /^enc:v1:/);
    assert.equal(encrypted.includes(sensitive.email), false);
    assert.equal(encrypted.includes(sensitive.password), false);
    assert.equal(encrypted.includes("private conversation"), false);
    assert.deepEqual(decryptPersistedJson(encrypted, "canonical-db"), sensitive);
    assert.throws(() => decryptPersistedJson(encrypted, "user:someone-else"));
  } finally {
    if (originalKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalKey;
  }
});

test("chat history is physically pruned after the configured retention window", () => {
  const originalRetention = process.env.CHAT_RETENTION_DAYS;
  process.env.CHAT_RETENTION_DAYS = "30";
  const userId = "retention-user";
  try {
    const result = sanitizeDBData({
      users: [{
        id: userId,
        username: "retention-user",
        email: "retention@example.com",
        password: "stored-password-hash",
        displayName: "Retention User",
        avatarUrl: "",
        bio: "",
        favoriteGenres: [],
        createdAt: new Date().toISOString(),
      }],
      playlists: [],
      tracks: [],
      userStates: {},
      chatHistories: {
        [userId]: [
          { id: "expired", sender: "user", text: "old", timestamp: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000).toISOString() },
          { id: "current", sender: "ai", text: "new", timestamp: new Date().toISOString() },
        ],
      },
    });

    assert.deepEqual(result.chatHistories[userId].map((message) => message.id), ["current"]);
  } finally {
    if (originalRetention === undefined) delete process.env.CHAT_RETENTION_DAYS;
    else process.env.CHAT_RETENTION_DAYS = originalRetention;
  }
});

test("canonical, backup, and user entity writes never persist sensitive plaintext", async () => {
  const originalKey = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  const values = new Map<string, unknown>();
  const options = new Map<string, unknown>();
  const redis = {
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: unknown, option?: unknown) => {
      values.set(key, value);
      options.set(key, option);
      return "OK";
    },
    del: async (...keys: string[]) => {
      for (const key of keys) values.delete(key);
      return keys.length;
    },
  };
  const createData = (suffix = "") => sanitizeDBData({
    users: [{
      id: `encrypted-user${suffix}`,
      username: `encrypted-user${suffix}`,
      email: `private${suffix}@example.com`,
      password: `$2b$10$private-hash${suffix}`,
      googleId: `google-private${suffix}`,
      displayName: "Encrypted User",
      avatarUrl: "",
      bio: "",
      favoriteGenres: [],
      createdAt: new Date().toISOString(),
    }],
    playlists: [],
    tracks: [],
    userStates: {},
    chatHistories: {},
  });

  try {
    await syncUpstashIndices(redis as never, createData());
    const canonical = String(values.get("app:spotify:db_v1"));
    const userEntity = String(values.get("app:user:encrypted-user"));
    assert.match(canonical, /^enc:v1:/);
    assert.match(userEntity, /^enc:v1:/);
    assert.equal(canonical.includes("private@example.com"), false);
    assert.equal(userEntity.includes("private@example.com"), false);

    const next = createData("-new");
    await syncUpstashIndices(redis as never, next);
    const backup = String(values.get("app:spotify:db_v1:previous"));
    assert.match(backup, /^enc:v1:/);
    assert.deepEqual(options.get("app:spotify:db_v1:previous"), { ex: 7 * 24 * 60 * 60 });
  } finally {
    if (originalKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalKey;
  }
});

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
      {
        ...baseTrack,
        id: "legacy_r2_dev_track",
        coverUrl: "https://pub-legacy.r2.dev/user_remote_media/cover%20art.jpg",
        audioUrl: "https://pub-legacy.r2.dev/user_remote_media/audio%20file.mp3",
      },
      { ...baseTrack, id: "local_track", audioUrl: "/uploads/user_remote_media/audio.mp3" },
      { ...baseTrack, id: "inline_track", audioUrl: "data:audio/mpeg;base64,AAAA" },
    ],
    userStates: {},
    chatHistories: {},
  });

  assert.deepEqual(result.tracks.map((track) => track.id), ["remote_track", "legacy_r2_dev_track"]);
  assert.equal(result.tracks[1].coverUrl, "/api/r2-file/user_remote_media/cover%20art.jpg");
  assert.equal(result.tracks[1].audioUrl, "/api/r2-file/user_remote_media/audio%20file.mp3");
});
