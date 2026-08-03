import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { readDBAsync, writeDBAsync, initUpstashDB, isUpstashConfigured, getUpstashClient, syncUpstashIndices, loadSessionsFromRedis, persistSessionToRedis, deleteSessionFromRedis, UserRecord, PlaylistRecord, TrackRecord } from "./server/db.js";

dotenv.config();

const DEFAULT_AVATAR_URL =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22512%22%20height%3D%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23312e81%22%2F%3E%3Cstop%20offset%3D%220.55%22%20stop-color%3D%22%237e22ce%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23db2777%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22512%22%20height%3D%22512%22%20rx%3D%2296%22%20fill%3D%22url(%23g)%22%2F%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22204%22%20r%3D%2278%22%20fill%3D%22%23fff%22%20fill-opacity%3D%220.9%22%2F%3E%3Cpath%20d%3D%22M118%20430c17-88%2069-132%20138-132s121%2044%20138%20132%22%20fill%3D%22%23fff%22%20fill-opacity%3D%220.9%22%2F%3E%3C%2Fsvg%3E";

const emptyStats = () => ({
  hoursListened: 0,
  secondsListened: 0,
  tracksPlayed: 0,
  topGenre: "N/A",
  playlistsCreated: 0,
  followersCount: 0,
  followingCount: 0,
});

function createEntityId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isStoredMediaUrl(value: string): boolean {
  return value.startsWith("/uploads/") || value.startsWith("/api/r2-file/") || isHttpUrl(value);
}

function sanitizeChatHistory(value: unknown, tracks: TrackRecord[] = []): any[] {
  if (!Array.isArray(value)) return [];
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  return value.slice(-200).flatMap((message: any) => {
    if (!message || (message.sender !== "user" && message.sender !== "ai") || typeof message.text !== "string") return [];
    const text = message.text.trim().slice(0, 20_000);
    if (!text) return [];
    return [{
      id: typeof message.id === "string" && message.id.trim() ? message.id.trim().slice(0, 160) : createEntityId("msg"),
      sender: message.sender,
      text,
      timestamp: typeof message.timestamp === "string" && !Number.isNaN(Date.parse(message.timestamp))
        ? new Date(message.timestamp).toISOString()
        : new Date().toISOString(),
      matchedTracks: Array.isArray(message.matchedTracks)
        ? message.matchedTracks
            .map((track: any) => typeof track === "string" ? track : track?.id)
            .filter((trackId: unknown): trackId is string => typeof trackId === "string" && trackById.has(trackId))
            .slice(0, 20)
            .map((trackId: string) => trackById.get(trackId))
        : undefined,
      webSearchUsed: message.webSearchUsed === true,
      searchQueries: Array.isArray(message.searchQueries) ? message.searchQueries.filter((item: unknown): item is string => typeof item === "string").slice(0, 10) : undefined,
      sources: Array.isArray(message.sources)
        ? message.sources.filter((item: any) => item && typeof item.title === "string" && typeof item.uri === "string" && isHttpUrl(item.uri)).slice(0, 10)
        : undefined,
    }];
  });
}

// Shared shape-builder for turning a stored user record into the public
// "artist card" shape the client renders in Search / Sidebar / ArtistView.
// IMPORTANT: keep this in sync with the `Artist`/`UserProfile` fields that
// ArtistView.tsx actually reads (bannerUrl, social links, artist pick) —
// leaving one out here silently makes it look like the value doesn't exist
// for every OTHER user viewing this profile, even though it's saved fine.
function toPublicArtistCard(u: UserRecord, tracks: TrackRecord[] = []) {
  const artistTracks = tracks.filter((track) => track.userId === u.id);
  const totalPlays = artistTracks.reduce((sum, track) => sum + (Number.parseInt(track.plays || "0", 10) || 0), 0);
  const totalStreamsLabel = `${totalPlays.toLocaleString()} total streams`;

  return {
    id: u.id,
    name: u.artistName || u.displayName || u.username,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl || DEFAULT_AVATAR_URL,
    bannerUrl: u.bannerUrl || "",
    bio: u.artistBio || u.bio || "",
    genre: u.favoriteGenres?.[0] || "",
    totalStreamsLabel,
    verified: u.artistVerified === true,
    stats: { ...emptyStats(), ...(u.stats || {}) },
    instagramUrl: u.instagramUrl,
    twitterUrl: u.twitterUrl,
    websiteUrl: u.websiteUrl,
    artistPickTrackId: u.artistPickTrackId,
    artistPickComment: u.artistPickComment,
    isUser: true,
  };
}

function sanitizeUserId(userId: string): string {
  if (!userId || typeof userId !== "string") {
    throw new Error("A valid owner ID is required for uploaded files.");
  }
  const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized || sanitized === ".." || sanitized.includes("..")) {
    throw new Error("Invalid owner ID for uploaded files.");
  }
  return sanitized;
}

let r2ClientInstance: S3Client | null = null;

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (accountId && accessKeyId && secretAccessKey) {
    if (!r2ClientInstance) {
      r2ClientInstance = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
    return r2ClientInstance;
  }
  return null;
}

function saveBufferToLocalDisk(buffer: Buffer, safeUserId: string, filename: string): string {
  const uploadsRootDir = path.resolve(process.cwd(), "data", "uploads");
  const userUploadDir = path.resolve(uploadsRootDir, safeUserId);
  const localFilePath = path.resolve(userUploadDir, filename);

  if (!userUploadDir.startsWith(`${uploadsRootDir}${path.sep}`) || !localFilePath.startsWith(`${userUploadDir}${path.sep}`)) {
    throw new Error("Invalid target directory path");
  }

  fs.mkdirSync(userUploadDir, { recursive: true });
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/${safeUserId}/${filename}`;
}

function getManagedStorageKey(mediaUrl: string): string | null {
  try {
    let key = '';
    if (mediaUrl.startsWith('/uploads/')) key = mediaUrl.slice('/uploads/'.length);
    else if (mediaUrl.startsWith('/api/r2-file/')) key = mediaUrl.slice('/api/r2-file/'.length);
    else if (isHttpUrl(mediaUrl) && process.env.R2_PUBLIC_DOMAIN) {
      const media = new URL(mediaUrl);
      const configured = new URL(
        process.env.R2_PUBLIC_DOMAIN.startsWith('http')
          ? process.env.R2_PUBLIC_DOMAIN
          : `https://${process.env.R2_PUBLIC_DOMAIN}`
      );
      if (media.host !== configured.host) return null;
      key = media.pathname.replace(/^\/+/, '');
    }
    key = decodeURIComponent(key).replace(/\\/g, '/');
    if (!key || key.startsWith('/') || key.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return null;
    return key;
  } catch {
    return null;
  }
}

async function deleteManagedFile(mediaUrl: string): Promise<void> {
  const key = getManagedStorageKey(mediaUrl);
  if (!key) return;

  const uploadsRoot = path.resolve(process.cwd(), 'data', 'uploads');
  const target = path.resolve(uploadsRoot, key);
  if (target.startsWith(`${uploadsRoot}${path.sep}`)) {
    try {
      if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.rmSync(target, { force: true });
    } catch (error) {
      console.error('Failed to delete local managed media file:', error);
    }
  }

  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (r2 && bucketName) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
    } catch (error) {
      console.error('Failed to delete Cloudflare R2 media object:', error);
    }
  }
}

function collectReferencedMediaUrls(db: { users: UserRecord[]; tracks: TrackRecord[]; playlists: PlaylistRecord[] }): Set<string> {
  const refs = new Set<string>();
  for (const user of db.users) {
    if (user.avatarUrl) refs.add(user.avatarUrl);
    if (user.bannerUrl) refs.add(user.bannerUrl);
  }
  for (const track of db.tracks) {
    if (track.audioUrl) refs.add(track.audioUrl);
    if (track.coverUrl) refs.add(track.coverUrl);
  }
  for (const playlist of db.playlists) if (playlist.coverUrl) refs.add(playlist.coverUrl);
  return refs;
}


function getWavDurationSeconds(base64Data: string): number {
  try {
    const buffer = Buffer.from(base64Data.replace(/[\r\n\s]/g, ""), "base64");
    if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      return 0;
    }

    let offset = 12;
    let byteRate = 0;
    let dataSize = 0;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataOffset = offset + 8;
      if (chunkDataOffset + chunkSize > buffer.length) break;
      if (chunkId === "fmt " && chunkSize >= 12) {
        byteRate = buffer.readUInt32LE(chunkDataOffset + 8);
      } else if (chunkId === "data") {
        dataSize = chunkSize;
      }
      if (byteRate > 0 && dataSize > 0) break;
      offset = chunkDataOffset + chunkSize + (chunkSize % 2);
    }

    const duration = byteRate > 0 && dataSize > 0 ? dataSize / byteRate : 0;
    return Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.round(duration)) : 0;
  } catch {
    return 0;
  }
}

async function saveUploadedFile(base64Data: string, mimeType: string, folderUserId: string, filePrefix: string): Promise<string> {
  const safeUserId = sanitizeUserId(folderUserId);
  const fileId = crypto.randomUUID();

  let ext = (mimeType || '').split('/')[1] || 'bin';
  if (ext.includes(';')) ext = ext.split(';')[0];
  if (ext === 'mpeg' || ext === 'mp3') ext = 'mp3';
  if (ext === 'jpeg' || ext === 'jpg') ext = 'jpg';
  if (ext === 'png') ext = 'png';
  if (ext === 'ogg') ext = 'ogg';
  if (ext === 'wav') ext = 'wav';
  if (ext === 'webm') ext = 'webm';
  if (ext === 'm4a' || ext === 'x-m4a' || ext === 'mp4') ext = 'm4a';

  const filename = `${filePrefix}_${fileId}.${ext}`;
  const key = `${safeUserId}/${filename}`;

  const cleanBase64 = base64Data.replace(/[\r\n\s]/g, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  let cleanMime = (mimeType || '').split(';')[0].trim();
  if (cleanMime === 'audio/mp3') cleanMime = 'audio/mpeg';
  if (cleanMime === 'audio/m4a' || cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';
  if (!cleanMime || cleanMime === 'application/octet-stream' || cleanMime === 'binary/octet-stream') {
    if (ext === 'mp3') cleanMime = 'audio/mpeg';
    else if (ext === 'ogg') cleanMime = 'audio/ogg';
    else if (ext === 'wav') cleanMime = 'audio/wav';
    else if (ext === 'm4a') cleanMime = 'audio/mp4';
    else if (ext === 'webm') cleanMime = 'audio/webm';
    else if (ext === 'jpg' || ext === 'jpeg') cleanMime = 'image/jpeg';
    else if (ext === 'png') cleanMime = 'image/png';
    else cleanMime = filePrefix.includes('audio') ? 'audio/mpeg' : 'image/jpeg';
  }

  // Persist the exact same object key locally. The previous implementation
  // generated a second random filename and returned a path that did not exist.
  const localUrl = saveBufferToLocalDisk(buffer, safeUserId, filename);

  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (r2 && bucketName) {
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: cleanMime,
        })
      );

      const publicDomain = process.env.R2_PUBLIC_DOMAIN;
      if (publicDomain && publicDomain.trim() && !publicDomain.includes('.r2.dev')) {
        const cleanDomain = publicDomain.trim().replace(/\/+$/, "");
        return `${cleanDomain}/${key}`;
      } else {
        return `/api/r2-file/${key}`;
      }
    } catch (r2Error) {
      console.error("Cloudflare R2 Upload failed, using local disk fallback:", r2Error);
    }
  }

  return localUrl;
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Upstash Redis database sync (if UPSTASH_REDIS_REST_URL is present)
  await initUpstashDB();

  // Hydrate active login sessions from Upstash Redis (if configured) so that
  // logged-in users stay authenticated across server restarts/redeploys and
  // across multiple server instances, instead of losing their session every
  // time the process restarts.
  const persistedSessions = await loadSessionsFromRedis();
  const persistedSessionCount = Object.keys(persistedSessions).length;
  if (persistedSessionCount > 0) {
    console.log(`⚡ Restored ${persistedSessionCount} active session(s) from Upstash Redis.`);
  }

  // Ensure uploads root directory exists
  const uploadsRootDir = path.join(process.cwd(), "data", "uploads");
  if (!fs.existsSync(uploadsRootDir)) {
    fs.mkdirSync(uploadsRootDir, { recursive: true });
  }

  // Serve music & cover upload files statically with CORS & Accept-Ranges headers
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, *");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
    res.setHeader("Accept-Ranges", "bytes");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  }, express.static(uploadsRootDir));

  // Serve files stored in Cloudflare R2 directly or via proxy endpoint
  app.all("/api/r2-file/*", async (req, res) => {
    const key = String(req.params[0] || "").replace(/^\/+/, "");
    const r2UploadsRoot = path.resolve(process.cwd(), "data", "uploads");
    const localPathForKey = path.resolve(r2UploadsRoot, key);
    const keyIsSafe = Boolean(key) && localPathForKey.startsWith(`${r2UploadsRoot}${path.sep}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With, *");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
    res.setHeader("Accept-Ranges", "bytes");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    try {
      const r2 = getR2Client();
      const bucketName = process.env.R2_BUCKET_NAME;

      if (!keyIsSafe) {
        return res.status(404).send("File not found.");
      }

      // Check local disk first as fast fallback if R2 is not configured
      if (!r2 || !bucketName) {
        if (fs.existsSync(localPathForKey) && fs.statSync(localPathForKey).isFile()) {
          return res.sendFile(localPathForKey);
        }
        return res.status(404).send("File not found and R2 storage not configured.");
      }

      const rangeHeader = req.headers.range;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        Range: rangeHeader || undefined,
      });

      const data = await r2.send(command);

      // Determine Content-Type
      let contentType = "audio/mpeg";
      if (data.ContentType && data.ContentType !== "binary/octet-stream" && data.ContentType !== "application/octet-stream") {
        contentType = data.ContentType;
      } else {
        const lowerKey = key.toLowerCase();
        if (lowerKey.endsWith(".mp3")) contentType = "audio/mpeg";
        else if (lowerKey.endsWith(".wav")) contentType = "audio/wav";
        else if (lowerKey.endsWith(".ogg")) contentType = "audio/ogg";
        else if (lowerKey.endsWith(".m4a")) contentType = "audio/mp4";
        else if (lowerKey.endsWith(".webm")) contentType = "audio/webm";
        else if (lowerKey.endsWith(".png")) contentType = "image/png";
        else if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) contentType = "image/jpeg";
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      if (data.ContentLength !== undefined) {
        res.setHeader("Content-Length", data.ContentLength);
      }

      if (data.ContentRange) {
        res.setHeader("Content-Range", data.ContentRange);
        res.status(206);
      } else if (data.ContentLength && rangeHeader && rangeHeader.startsWith("bytes=0-")) {
        res.setHeader("Content-Range", `bytes 0-${data.ContentLength - 1}/${data.ContentLength}`);
        res.status(206);
      } else {
        res.status(200);
      }

      if (req.method === "HEAD") {
        return res.end();
      }

      const stream = data.Body as any;
      if (stream && typeof stream.pipe === "function") {
        stream.pipe(res);
      } else {
        const bytes = await data.Body?.transformToByteArray();
        if (bytes) {
          res.send(Buffer.from(bytes));
        } else {
          res.status(404).send("File content empty");
        }
      }
    } catch (err: any) {
      // Local disk fallback on R2 fetch failure (e.g. NoSuchKey or network error)
      if (keyIsSafe) {
        if (fs.existsSync(localPathForKey) && fs.statSync(localPathForKey).isFile()) {
          return res.sendFile(localPathForKey);
        }
      }
      console.error("R2 File Express Route Error:", err);
      return res.status(404).send("File not found");
    }
  });

  // Increase payload limit for custom track audio uploads or images
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // System status endpoint to check Upstash & R2 integration status
  app.get("/api/system-status", async (req, res) => {
    const sessionUserId = getUserIdFromToken(req);
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });
    const db = await readDBAsync();
    const requestingUser = db.users.find((user) => user.id === sessionUserId);
    if (!requestingUser?.isAdmin) return res.status(403).json({ error: "Forbidden: Admin access required." });

    return res.json({
      status: "ok",
      upstashRedisConfigured: isUpstashConfigured(),
      cloudflareR2Configured: Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
      ),
      databaseStats: {
        usersCount: db.users.length,
        tracksCount: db.tracks.length,
        playlistsCount: db.playlists.length,
      },
    });
  });

  // ==========================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // ==========================================
  // token -> userId. Hydrated from Upstash Redis at startup (see persistedSessions
  // above), and mirrored back to Redis on every new token issuance so sessions
  // survive restarts and are shared across instances. Falls back to
  // in-memory-only behavior automatically if Upstash isn't configured.
  const activeSessions = new Map<string, string>(Object.entries(persistedSessions));
  const recentPlayEvents = new Map<string, number>();

  function issueSessionToken(userId: string): string {
    if (!userId) return "";
    const token = `sess_${crypto.randomBytes(32).toString("hex")}`;
    activeSessions.set(token, userId);
    persistSessionToRedis(token, userId); // fire-and-forget, doesn't block the request
    return token;
  }

  function getUserIdFromToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    if (activeSessions.has(token)) {
      return activeSessions.get(token) || null;
    }
    return null;
  }

  function revokeSessionToken(token: string): void {
    if (!token) return;
    activeSessions.delete(token);
    deleteSessionFromRedis(token); // fire-and-forget
  }

  // User Registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, displayName } = req.body;

      if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Username, email, and password are required." });
      }
      const cleanUsername = username.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanDisplayName = typeof displayName === "string" ? displayName.trim() : "";
      if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(cleanUsername)) {
        return res.status(400).json({ error: "Username must be 3-32 characters and may only contain letters, numbers, dot, underscore, or hyphen." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
      }
      if (cleanDisplayName.length > 80) {
        return res.status(400).json({ error: "Display name cannot exceed 80 characters." });
      }

      const db = await readDBAsync();

      const existingUser = db.users.find(
        (u) =>
          u.username.toLowerCase() === cleanUsername.toLowerCase() ||
          u.email.toLowerCase() === cleanEmail
      );

      if (existingUser) {
        return res.status(400).json({ error: "Username or email is already registered." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser: UserRecord = {
        id: createEntityId("usr"),
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        displayName: cleanDisplayName || cleanUsername,
        avatarUrl: DEFAULT_AVATAR_URL,
        bio: "",
        favoriteGenres: [],
        createdAt: new Date().toISOString(),
        stats: {
          hoursListened: 0,
          secondsListened: 0,
          tracksPlayed: 0,
          topGenre: "N/A",
          playlistsCreated: 0,
          followersCount: 0,
          followingCount: 0,
        },
      };

      db.users.push(newUser);
      db.userStates[newUser.id] = { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [] };
      await writeDBAsync(db);

      const token = issueSessionToken(newUser.id);
      // Omit password from returned user object
      const { password: _, ...userWithoutPassword } = newUser;
      return res.json({ success: true, user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Register Error:", error);
      return res.status(500).json({ error: "Failed to register user." });
    }
  });

  // User Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body || {};

      if (typeof usernameOrEmail !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Username/email and password are required." });
      }
      const identifier = usernameOrEmail.trim().toLowerCase();
      if (!identifier || identifier.length > 254 || !password || password.length > 128) {
        return res.status(400).json({ error: "Invalid login input." });
      }

      const db = await readDBAsync();

      const user = db.users.find(
        (u) =>
          u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid username/email or password." });
      }

      let isMatch = false;
      if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plaintext password comparison and upgrade
        isMatch = user.password === password;
        if (isMatch) {
          user.password = await bcrypt.hash(password, 10);
          await writeDBAsync(db);
        }
      }

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username/email or password." });
      }

      const token = issueSessionToken(user.id);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ success: true, user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Login Error:", error);
      return res.status(500).json({ error: "Failed to log in." });
    }
  });

  // Revoke the current session token on logout.
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) revokeSessionToken(token);
    return res.json({ success: true });
  });

  // Fetch Application Data (Tracks, Playlists, User State, Chat History)
  app.get("/api/data", async (req, res) => {
    try {
      const db = await readDBAsync();
      const authUserId = getUserIdFromToken(req);

      let currentUser = null;
      let likedTrackIds: string[] = [];
      let userChatHistory: any[] = [];
      let followedArtistIds: string[] = [];
      let recentTrackIds: string[] = [];

      if (authUserId) {
        const found = db.users.find((u) => u.id === authUserId);
        if (found) {
          const { password: _, ...uNoPass } = found;
          const ownTotalStreams = db.tracks
            .filter((track) => track.userId === found.id)
            .reduce((sum, track) => sum + (Number.parseInt(track.plays || '0', 10) || 0), 0);
          currentUser = { ...uNoPass, totalStreamsLabel: `${ownTotalStreams.toLocaleString()} total streams` };
          likedTrackIds = db.userStates[authUserId] ? db.userStates[authUserId].likedTrackIds : [];
          userChatHistory = db.chatHistories[authUserId] ? db.chatHistories[authUserId] : [];
          followedArtistIds = db.userStates[authUserId]?.followedArtistIds || [];
          recentTrackIds = db.userStates[authUserId]?.recentTrackIds || [];
        }
      }

      return res.json({
        user: currentUser,
        tracks: db.tracks,
        artists: db.users
          .filter((user) => user.isArtist || db.tracks.some((track) => track.userId === user.id))
          .map((user) => toPublicArtistCard(user, db.tracks)),
        playlists: db.playlists,
        likedTrackIds,
        followedArtistIds,
        recentTrackIds,
        chatHistory: userChatHistory,
      });
    } catch (error: any) {
      console.error("Fetch Data Error:", error);
      return res.status(500).json({ error: "Failed to fetch application data." });
    }
  });

  // Get User-Scoped Chat History
  app.get("/api/chat-history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }
      const db = await readDBAsync();
      if (!db.users.some((user) => user.id === userId)) {
        return res.status(404).json({ error: "User not found." });
      }
      const history = db.chatHistories[userId] || [];
      return res.json({ success: true, chatHistory: history });
    } catch (error: any) {
      console.error("Fetch Chat History Error:", error);
      return res.status(500).json({ error: "Failed to fetch chat history." });
    }
  });

  // Save User-Scoped Chat History
  app.post("/api/chat-history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }
      const { chatHistory } = req.body;
      const db = await readDBAsync();
      if (!db.users.some((user) => user.id === userId)) {
        return res.status(404).json({ error: "User not found." });
      }

      db.chatHistories[userId] = sanitizeChatHistory(chatHistory, db.tracks);
      await writeDBAsync(db);

      return res.json({ success: true, chatHistory: db.chatHistories[userId] });
    } catch (error: any) {
      console.error("Save Chat History Error:", error);
      return res.status(500).json({ error: "Failed to save chat history." });
    }
  });

  // Global Multi-Category Search API Endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim().toLowerCase();
      const db = await readDBAsync();

      if (!query) {
        return res.json({
          query: "",
          tracks: db.tracks.slice(0, 10),
          artists: db.users
            .filter((user) => user.isArtist || db.tracks.some((track) => track.userId === user.id))
            .slice(0, 10)
            .map((user) => toPublicArtistCard(user, db.tracks)),
          playlists: db.playlists.slice(0, 10),
          topResult: null,
        });
      }

      // 1. Match Tracks
      const matchedTracks = db.tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          t.album.toLowerCase().includes(query) ||
          t.genre.toLowerCase().includes(query)
      );

      // 2. Match Users & Artists
      const matchedUsers = db.users
        .filter((user) => user.isArtist || db.tracks.some((track) => track.userId === user.id))
        .filter(
          (user) =>
            user.username.toLowerCase().includes(query) ||
            user.displayName.toLowerCase().includes(query) ||
            (user.artistName && user.artistName.toLowerCase().includes(query)) ||
            (user.bio && user.bio.toLowerCase().includes(query))
        )
        .map((user) => toPublicArtistCard(user, db.tracks));

      // Track metadata never creates an artist identity. Every matching track
      // resolves through its immutable owner userId, so duplicate display
      // names cannot redirect to the wrong account and orphaned identities
      // cannot appear in search.
      const matchedTrackOwnerIds = new Set(matchedTracks.map((track) => track.userId).filter(Boolean));
      const matchedTrackArtists = db.users
        .filter((user) => matchedTrackOwnerIds.has(user.id))
        .map((user) => toPublicArtistCard(user, db.tracks));

      const combinedArtists = Array.from(
        new Map([...matchedUsers, ...matchedTrackArtists].map((artist) => [artist.id, artist])).values()
      );

      // 3. Match Playlists
      const matchedPlaylists = db.playlists.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );

      // Best matching item for Top Result
      let topResult: { type: 'track' | 'artist' | 'playlist'; item: any } | null = null;

      const exactTrack = matchedTracks.find((t) => t.title.toLowerCase() === query);
      const exactArtist = combinedArtists.find(
        (a) => a.name.toLowerCase() === query || (a.username && a.username.toLowerCase() === query)
      );
      const exactPlaylist = matchedPlaylists.find((p) => p.title.toLowerCase() === query);

      if (exactTrack) {
        topResult = { type: 'track', item: exactTrack };
      } else if (exactArtist) {
        topResult = { type: 'artist', item: exactArtist };
      } else if (exactPlaylist) {
        topResult = { type: 'playlist', item: exactPlaylist };
      } else if (matchedTracks.length > 0) {
        topResult = { type: 'track', item: matchedTracks[0] };
      } else if (combinedArtists.length > 0) {
        topResult = { type: 'artist', item: combinedArtists[0] };
      } else if (matchedPlaylists.length > 0) {
        topResult = { type: 'playlist', item: matchedPlaylists[0] };
      }

      return res.json({
        query,
        tracks: matchedTracks,
        artists: combinedArtists,
        playlists: matchedPlaylists,
        topResult,
      });
    } catch (error: any) {
      console.error("Search API Error:", error);
      return res.status(500).json({ error: "Failed to perform search query." });
    }
  });

  // Clear User-Scoped Chat History
  app.delete("/api/chat-history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }
      const db = await readDBAsync();
      if (!db.users.some((user) => user.id === userId)) {
        return res.status(404).json({ error: "User not found." });
      }

      db.chatHistories[userId] = [];
      await writeDBAsync(db);

      return res.json({ success: true, chatHistory: [] });
    } catch (error: any) {
      console.error("Clear Chat History Error:", error);
      return res.status(500).json({ error: "Failed to clear chat history." });
    }
  });

  // Get a single user's PUBLIC artist-card profile by id. This is what lets
  // the client resolve someone else's real banner/bio/stats/social links —
  // e.g. for the sidebar's "Following" list after switching accounts, or
  // opening an artist page whose data isn't cached in this browser session.
  // Without this route the client had no way to look up another account
  // except the search endpoint (which requires a matching text query).
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const db = await readDBAsync();
      const found = db.users.find((user) => user.id === userId);
      const isRealArtist = Boolean(found && (found.isArtist || db.tracks.some((track) => track.userId === found.id)));
      if (!found || !isRealArtist) {
        return res.status(404).json({ error: "Artist not found." });
      }
      return res.json({ success: true, user: toPublicArtistCard(found, db.tracks) });
    } catch (error: any) {
      console.error("Fetch User Error:", error);
      return res.status(500).json({ error: "Failed to fetch user profile." });
    }
  });

  // Follow / unfollow a real registered artist. The relationship is stored
  // server-side and the operation is idempotent, so refreshes, account
  // switches, duplicate clicks, and forged localStorage values cannot alter
  // ownership or follower counts.
  app.post("/api/users/:userId/follow", async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const { action } = req.body as { action?: "follow" | "unfollow" };
      const sessionUserId = getUserIdFromToken(req);

      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (action !== "follow" && action !== "unfollow") {
        return res.status(400).json({ error: "action must be 'follow' or 'unfollow'." });
      }
      if (targetUserId === sessionUserId) {
        return res.status(400).json({ error: "You cannot follow your own profile." });
      }

      const db = await readDBAsync();
      const requesterIndex = db.users.findIndex((user) => user.id === sessionUserId);
      const targetIndex = db.users.findIndex((user) => user.id === targetUserId);
      if (requesterIndex === -1) {
        return res.status(404).json({ error: "Signed-in user not found." });
      }
      if (targetIndex === -1 || !(db.users[targetIndex].isArtist || db.tracks.some((track) => track.userId === targetUserId))) {
        return res.status(404).json({ error: "Artist not found." });
      }

      const requesterState = db.userStates[sessionUserId] || {
        likedTrackIds: [],
        recentTrackIds: [],
        followedArtistIds: [],
      };
      const current = new Set(requesterState.followedArtistIds || []);
      if (action === "follow") current.add(targetUserId);
      else current.delete(targetUserId);
      requesterState.followedArtistIds = Array.from(current);
      db.userStates[sessionUserId] = requesterState;

      const followersCount = Object.values(db.userStates).filter((state) =>
        (state.followedArtistIds || []).includes(targetUserId)
      ).length;
      const followingCount = requesterState.followedArtistIds.length;

      db.users[targetIndex] = {
        ...db.users[targetIndex],
        stats: { ...emptyStats(), ...(db.users[targetIndex].stats || {}), followersCount },
      };
      db.users[requesterIndex] = {
        ...db.users[requesterIndex],
        stats: { ...emptyStats(), ...(db.users[requesterIndex].stats || {}), followingCount },
      };

      await writeDBAsync(db);
      return res.json({
        success: true,
        isFollowing: action === "follow",
        followedArtistIds: requesterState.followedArtistIds,
        followersCount,
        followingCount,
      });
    } catch (error: any) {
      console.error("Follow/Unfollow Error:", error);
      return res.status(500).json({ error: "Failed to update follow state." });
    }
  });

  // Update only user-owned profile fields. Privileged/derived values such as
  // admin, verification, total streams, follower counts, and playback
  // statistics are deliberately ignored here and can only be changed by the
  // server paths that own those values.
  app.put("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }

      const updates = req.body || {};
      const db = await readDBAsync();
      const index = db.users.findIndex((user) => user.id === userId);
      if (index === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      const current = db.users[index];
      const previousAvatarUrl = current.avatarUrl || "";
      const nextUsername = typeof updates.username === "string" && updates.username.trim()
        ? updates.username.trim()
        : current.username;
      if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(nextUsername)) {
        return res.status(400).json({ error: "Username must be 3-32 characters and may only contain letters, numbers, dot, underscore, or hyphen." });
      }
      const usernameTaken = db.users.some(
        (user) => user.id !== userId && user.username.toLowerCase() === nextUsername.toLowerCase()
      );
      if (usernameTaken) {
        return res.status(409).json({ error: "Username is already in use." });
      }

      const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(updates, "avatarUrl");
      let avatarUrl = hasAvatarUpdate && typeof updates.avatarUrl === "string"
        ? updates.avatarUrl.trim()
        : current.avatarUrl;
      let bannerUrl = typeof updates.bannerUrl === "string" ? updates.bannerUrl.trim() : current.bannerUrl || "";

      // An explicitly empty avatar means "remove the uploaded profile photo".
      // Keep the built-in SVG as a UI fallback instead of trying to decode it
      // as a base64 upload.
      if (hasAvatarUpdate && !avatarUrl) avatarUrl = DEFAULT_AVATAR_URL;

      if (avatarUrl !== DEFAULT_AVATAR_URL && avatarUrl.startsWith("data:")) {
        const mimeMatch = avatarUrl.match(/^data:(image\/[^;]+);base64,/);
        const b64 = avatarUrl.includes(",") ? avatarUrl.split(",")[1] : "";
        if (!mimeMatch || !b64) return res.status(400).json({ error: "Invalid avatar image." });
        avatarUrl = await saveUploadedFile(b64, mimeMatch?.[1] || "image/jpeg", userId, "avatar");
      }
      if (bannerUrl.startsWith("data:")) {
        const mimeMatch = bannerUrl.match(/^data:(image\/[^;]+);base64,/);
        const b64 = bannerUrl.includes(",") ? bannerUrl.split(",")[1] : "";
        if (!mimeMatch || !b64) return res.status(400).json({ error: "Invalid banner image." });
        bannerUrl = await saveUploadedFile(b64, mimeMatch?.[1] || "image/jpeg", userId, "banner");
      }
      if (avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL && !isStoredMediaUrl(avatarUrl)) return res.status(400).json({ error: "Avatar URL must use HTTP(S) or an uploaded file." });
      if (bannerUrl && !isStoredMediaUrl(bannerUrl)) return res.status(400).json({ error: "Banner URL must use HTTP(S) or an uploaded file." });

      const hasPickUpdate = Object.prototype.hasOwnProperty.call(updates, "artistPickTrackId");
      const requestedPick = hasPickUpdate
        ? typeof updates.artistPickTrackId === "string" && updates.artistPickTrackId.trim()
          ? updates.artistPickTrackId.trim()
          : undefined
        : current.artistPickTrackId;
      if (requestedPick && !db.tracks.some((track) => track.id === requestedPick && track.userId === userId)) {
        return res.status(404).json({ error: "Artist pick track not found." });
      }

      const displayName = typeof updates.displayName === "string" && updates.displayName.trim()
        ? updates.displayName.trim()
        : current.displayName;
      if (displayName.length > 80) return res.status(400).json({ error: "Display name cannot exceed 80 characters." });
      if (typeof updates.bio === "string" && updates.bio.length > 500) return res.status(400).json({ error: "Bio cannot exceed 500 characters." });
      if (typeof updates.artistBio === "string" && updates.artistBio.length > 2_000) return res.status(400).json({ error: "Artist bio cannot exceed 2000 characters." });
      const isArtist = typeof updates.isArtist === "boolean" ? updates.isArtist : current.isArtist || false;
      const artistName = typeof updates.artistName === "string" && updates.artistName.trim()
        ? updates.artistName.trim()
        : current.artistName || displayName;
      if (artistName.length > 80) return res.status(400).json({ error: "Artist name cannot exceed 80 characters." });

      let favoriteGenres = current.favoriteGenres;
      if (updates.favoriteGenres !== undefined) {
        if (!Array.isArray(updates.favoriteGenres)) {
          return res.status(400).json({ error: "Favorite genres must be an array." });
        }
        const suppliedGenres: string[] = (updates.favoriteGenres as unknown[])
          .filter((genre: unknown): genre is string => typeof genre === "string")
          .map((genre: string) => genre.trim())
          .filter(Boolean);
        if (suppliedGenres.some((genre: string) => genre.length > 80)) {
          return res.status(400).json({ error: "Genre names cannot exceed 80 characters." });
        }
        favoriteGenres = Array.from(new Set(suppliedGenres)).slice(0, 20);
      }

      const cleanSocialUrl = (value: unknown, currentValue?: string): string | undefined => {
        if (value === undefined) return currentValue;
        if (typeof value !== "string") throw new Error("INVALID_SOCIAL_URL");
        const clean = value.trim();
        if (!clean) return undefined;
        if (!isHttpUrl(clean)) throw new Error("INVALID_SOCIAL_URL");
        return clean.slice(0, 2_000);
      };
      let instagramUrl: string | undefined;
      let twitterUrl: string | undefined;
      let websiteUrl: string | undefined;
      try {
        instagramUrl = cleanSocialUrl(updates.instagramUrl, current.instagramUrl);
        twitterUrl = cleanSocialUrl(updates.twitterUrl, current.twitterUrl);
        websiteUrl = cleanSocialUrl(updates.websiteUrl, current.websiteUrl);
      } catch {
        return res.status(400).json({ error: "Social links must be valid HTTP(S) URLs." });
      }

      const artistPickComment = requestedPick
        ? typeof updates.artistPickComment === "string"
          ? updates.artistPickComment.trim().slice(0, 500)
          : current.artistPickComment
        : undefined;

      db.users[index] = {
        ...current,
        displayName,
        username: nextUsername,
        bio: typeof updates.bio === "string" ? updates.bio.trim() : current.bio,
        avatarUrl: avatarUrl || DEFAULT_AVATAR_URL,
        bannerUrl,
        favoriteGenres,
        isArtist,
        artistName,
        artistBio: typeof updates.artistBio === "string" ? updates.artistBio.trim() : current.artistBio,
        instagramUrl,
        twitterUrl,
        websiteUrl,
        artistPickTrackId: requestedPick,
        artistPickComment,
        // Server-owned fields: never trust values supplied by the client.
        isAdmin: current.isAdmin,
        artistVerified: current.artistVerified === true,
        stats: current.stats,
      };

      // Keep all of this owner's track artist labels canonical after a profile rename.
      db.tracks = db.tracks.map((track) =>
        track.userId === userId ? { ...track, artist: artistName } : track
      );

      await writeDBAsync(db);
      if (previousAvatarUrl && previousAvatarUrl !== db.users[index].avatarUrl) {
        const referencedMedia = collectReferencedMediaUrls(db);
        if (!referencedMedia.has(previousAvatarUrl)) await deleteManagedFile(previousAvatarUrl);
      }
      const { password: _, ...updatedUser } = db.users[index];
      return res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Update User Error:", error);
      return res.status(500).json({ error: "Failed to update user profile." });
    }
  });

  // Persist cumulative listening-time stats (seconds/hours listened).
  // The client pings this every ~15s while a track is playing so the
  // "hours listened" stat on the profile is real and survives redeploys
  // instead of only living in local React state / localStorage.
  app.post("/api/users/:userId/listening-stats", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }

      const { secondsListened } = req.body as { secondsListened?: number };

      const db = await readDBAsync();
      const index = db.users.findIndex((u) => u.id === userId);
      if (index === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      const previousStats = { ...emptyStats(), ...(db.users[index].stats || {}) };
      const previousSeconds = Math.max(0, Number(previousStats.secondsListened) || 0);
      const requestedSeconds = Number(secondsListened);
      if (!Number.isFinite(requestedSeconds) || requestedSeconds < previousSeconds) {
        return res.status(400).json({ error: "secondsListened must be a monotonic numeric value." });
      }
      // The client reports roughly every 15 seconds. Cap one request to two minutes
      // of progress so a forged payload cannot manufacture listening history.
      const acceptedSeconds = Math.min(requestedSeconds, previousSeconds + 120);
      db.users[index] = {
        ...db.users[index],
        stats: {
          ...previousStats,
          secondsListened: acceptedSeconds,
          hoursListened: acceptedSeconds / 3600,
        },
      };

      await writeDBAsync(db);

      return res.json({ success: true, stats: db.users[index].stats });
    } catch (error: any) {
      console.error("Persist Listening Stats Error:", error);
      return res.status(500).json({ error: "Failed to persist listening stats." });
    }
  });

  // Fetch one real, playable track. Orphaned/metadata-only legacy records are
  // removed by the DB sanitizer and therefore correctly return 404 here.
  app.get("/api/tracks/:id", async (req, res) => {
    try {
      const db = await readDBAsync();
      const track = db.tracks.find((item) => item.id === req.params.id);
      if (!track) return res.status(404).json({ error: "Track not found." });
      return res.json({ success: true, track });
    } catch (error) {
      console.error("Fetch Track Error:", error);
      return res.status(500).json({ error: "Failed to fetch track." });
    }
  });

  // Add a real playable track owned by the authenticated uploader. The server
  // ignores client-supplied artist/owner identities and never creates silent
  // metadata-only records.
  app.post("/api/tracks", async (req, res) => {
    try {
      const { userId, title, album, coverUrl, audioUrl, duration, genre, syncedLyrics, releaseType, releaseTitle, releaseId, copyright, releaseYear, trackNumber } = req.body;
      const sessionUserId = getUserIdFromToken(req);

      if (!sessionUserId) {
        return res.status(401).json({ success: false, error: "You must be signed in to upload music." });
      }
      if (userId && userId !== sessionUserId) {
        return res.status(403).json({ success: false, error: "Forbidden: Unauthorized user session." });
      }
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ success: false, error: "Track title is required." });
      }
      if (title.trim().length > 160) {
        return res.status(400).json({ success: false, error: "Track title cannot exceed 160 characters." });
      }
      if (typeof audioUrl !== "string" || !audioUrl.trim()) {
        return res.status(400).json({ success: false, error: "A real audio file or audio URL is required." });
      }
      if (!Number.isFinite(Number(duration)) || Number(duration) <= 0 || Number(duration) > 86_400) {
        return res.status(400).json({ success: false, error: "A valid audio duration is required." });
      }

      const db = await readDBAsync();
      const uploaderIndex = db.users.findIndex((user) => user.id === sessionUserId);
      if (uploaderIndex === -1) {
        return res.status(404).json({ success: false, error: "Uploader profile was not found." });
      }
      const uploader = db.users[uploaderIndex];
      const canonicalArtistName = (uploader.artistName || uploader.displayName || uploader.username).trim();
      if (!canonicalArtistName) {
        return res.status(400).json({ success: false, error: "Add an artist name to your profile before uploading music." });
      }

      let persistentAudioUrl = audioUrl.trim();
      let persistentCoverUrl = typeof coverUrl === "string" ? coverUrl.trim() : "";
      if (persistentAudioUrl.startsWith("data:")) {
        const mimeMatch = persistentAudioUrl.match(/^data:(audio\/[^;]+);base64,/);
        if (!mimeMatch) return res.status(400).json({ success: false, error: "Audio upload must contain an audio MIME type." });
        const base64Data = persistentAudioUrl.includes(",") ? persistentAudioUrl.split(",")[1] : "";
        if (!base64Data) return res.status(400).json({ success: false, error: "Invalid audio file." });
        persistentAudioUrl = await saveUploadedFile(base64Data, mimeMatch?.[1] || "audio/mpeg", sessionUserId, "audio");
      }
      if (persistentCoverUrl.startsWith("data:")) {
        const mimeMatch = persistentCoverUrl.match(/^data:(image\/[^;]+);base64,/);
        if (!mimeMatch) return res.status(400).json({ success: false, error: "Cover upload must contain an image MIME type." });
        const imgBase64 = persistentCoverUrl.includes(",") ? persistentCoverUrl.split(",")[1] : "";
        if (!imgBase64) return res.status(400).json({ success: false, error: "Invalid cover image." });
        persistentCoverUrl = await saveUploadedFile(imgBase64, mimeMatch?.[1] || "image/jpeg", sessionUserId, "cover");
      }
      if (!isStoredMediaUrl(persistentAudioUrl)) return res.status(400).json({ success: false, error: "Audio URL must use HTTP(S) or an uploaded file." });
      if (persistentCoverUrl && !isStoredMediaUrl(persistentCoverUrl)) return res.status(400).json({ success: false, error: "Cover URL must use HTTP(S) or an uploaded file." });
      if (!persistentCoverUrl) persistentCoverUrl = uploader.avatarUrl || DEFAULT_AVATAR_URL;

      const cleanAlbum = typeof album === "string" && album.trim() ? album.trim() : "Single";
      if (cleanAlbum.length > 160) return res.status(400).json({ success: false, error: "Album name cannot exceed 160 characters." });
      const cleanReleaseType = typeof releaseType === "string" && releaseType.trim()
        ? releaseType.trim().toUpperCase()
        : cleanAlbum === "Single" ? "SINGLE" : "ALBUM";
      if (!["SINGLE", "EP", "ALBUM"].includes(cleanReleaseType)) {
        return res.status(400).json({ success: false, error: "releaseType must be SINGLE, EP, or ALBUM." });
      }
      const cleanReleaseTitle = typeof releaseTitle === "string" && releaseTitle.trim()
        ? releaseTitle.trim()
        : cleanAlbum === "Single" ? title.trim() : cleanAlbum;
      if (cleanReleaseTitle.length > 160) return res.status(400).json({ success: false, error: "Release title cannot exceed 160 characters." });
      const cleanGenre = typeof genre === "string" ? genre.trim() : "";
      if (cleanGenre.length > 80) return res.status(400).json({ success: false, error: "Genre cannot exceed 80 characters." });
      const currentYear = new Date().getFullYear();
      const cleanReleaseYear = releaseYear === undefined || releaseYear === null || releaseYear === ""
        ? undefined
        : Number(releaseYear);
      if (cleanReleaseYear !== undefined && (!Number.isInteger(cleanReleaseYear) || cleanReleaseYear < 1850 || cleanReleaseYear > currentYear + 1)) {
        return res.status(400).json({ success: false, error: "Release year is invalid." });
      }
      const cleanTrackNumber = trackNumber === undefined || trackNumber === null || trackNumber === ""
        ? undefined
        : Number(trackNumber);
      if (cleanTrackNumber !== undefined && (!Number.isInteger(cleanTrackNumber) || cleanTrackNumber < 1 || cleanTrackNumber > 999)) {
        return res.status(400).json({ success: false, error: "Track number must be an integer between 1 and 999." });
      }
      const cleanCopyright = typeof copyright === "string" && copyright.trim() ? copyright.trim() : undefined;
      if (cleanCopyright && cleanCopyright.length > 300) return res.status(400).json({ success: false, error: "Copyright text cannot exceed 300 characters." });
      const newTrack: TrackRecord = {
        id: createEntityId("trk"),
        userId: sessionUserId,
        title: title.trim(),
        artist: canonicalArtistName,
        album: cleanAlbum,
        releaseType: cleanReleaseType,
        releaseTitle: cleanReleaseTitle,
        releaseId: typeof releaseId === "string" && releaseId.trim()
          ? `rel_${sessionUserId}_${crypto.createHash("sha256").update(releaseId.trim()).digest("hex").slice(0, 24)}`
          : createEntityId("rel"),
        copyright: cleanCopyright,
        releaseYear: cleanReleaseYear,
        trackNumber: cleanTrackNumber,
        coverUrl: persistentCoverUrl,
        audioUrl: persistentAudioUrl,
        duration: Number(duration),
        genre: cleanGenre,
        syncedLyrics: Array.isArray(syncedLyrics)
          ? syncedLyrics
              .filter((line: any) => line && Number.isFinite(Number(line.time)) && Number(line.time) >= 0 && Number(line.time) <= Number(duration) + 1 && typeof line.text === "string")
              .map((line: any) => ({ time: Number(line.time), text: line.text.trim().slice(0, 2_000) }))
              .filter((line: any) => Boolean(line.text))
              .slice(0, 5_000)
          : [],
        plays: "0",
        createdAt: new Date().toISOString(),
      };

      db.users[uploaderIndex] = { ...uploader, isArtist: true, artistName: canonicalArtistName };
      db.tracks.unshift(newTrack);
      await writeDBAsync(db);
      return res.json({ success: true, track: newTrack });
    } catch (error: any) {
      console.error("Add Track Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to add track." });
    }
  });

  // Update Track (strict uploader ownership). Owner and artist identity are
  // immutable from the request body and are derived from the session user.
  app.put("/api/tracks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, album, genre, coverUrl, audioUrl, duration, releaseType, releaseTitle, copyright, releaseYear, trackNumber } = req.body;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });

      const db = await readDBAsync();
      const trackIndex = db.tracks.findIndex((track) => track.id === id);
      if (trackIndex === -1) return res.status(404).json({ error: "Track not found." });
      const existingTrack = db.tracks[trackIndex];
      if (existingTrack.userId !== sessionUserId) {
        return res.status(403).json({ error: "Forbidden: You can only edit tracks you uploaded." });
      }

      const owner = db.users.find((user) => user.id === sessionUserId);
      if (!owner) return res.status(404).json({ error: "Track owner not found." });

      let persistentCoverUrl = existingTrack.coverUrl;
      if (typeof coverUrl === "string") {
        const cleanCover = coverUrl.trim();
        if (cleanCover.startsWith("data:")) {
          const mimeMatch = cleanCover.match(/^data:(image\/[^;]+);base64,/);
          const imgBase64 = cleanCover.includes(",") ? cleanCover.split(",")[1] : "";
          if (!mimeMatch || !imgBase64) return res.status(400).json({ error: "Invalid cover image." });
          persistentCoverUrl = await saveUploadedFile(imgBase64, mimeMatch?.[1] || "image/jpeg", sessionUserId, "cover");
        } else if (cleanCover) {
          if (!isStoredMediaUrl(cleanCover)) return res.status(400).json({ error: "Cover URL must use HTTP(S) or an uploaded file." });
          persistentCoverUrl = cleanCover;
        }
      }

      let persistentAudioUrl = existingTrack.audioUrl || "";
      if (typeof audioUrl === "string" && audioUrl.trim()) {
        const cleanAudio = audioUrl.trim();
        if (cleanAudio.startsWith("data:")) {
          const mimeMatch = cleanAudio.match(/^data:(audio\/[^;]+);base64,/);
          const audioBase64 = cleanAudio.includes(",") ? cleanAudio.split(",")[1] : "";
          if (!mimeMatch || !audioBase64) return res.status(400).json({ error: "Invalid audio file." });
          persistentAudioUrl = await saveUploadedFile(audioBase64, mimeMatch?.[1] || "audio/mpeg", sessionUserId, "audio");
        } else {
          if (!isStoredMediaUrl(cleanAudio)) return res.status(400).json({ error: "Audio URL must use HTTP(S) or an uploaded file." });
          persistentAudioUrl = cleanAudio;
        }
      }
      if (!persistentAudioUrl) return res.status(400).json({ error: "A real audio source is required." });

      const nextDuration = duration !== undefined ? Number(duration) : existingTrack.duration;
      if (!Number.isFinite(nextDuration) || nextDuration <= 0 || nextDuration > 86_400) {
        return res.status(400).json({ error: "A valid audio duration is required." });
      }

      const nextTitle = typeof title === "string" && title.trim() ? title.trim() : existingTrack.title;
      const nextAlbum = typeof album === "string" && album.trim() ? album.trim() : existingTrack.album;
      const nextReleaseType = typeof releaseType === "string" && releaseType.trim() ? releaseType.trim().toUpperCase() : existingTrack.releaseType || "SINGLE";
      const nextReleaseTitle = typeof releaseTitle === "string" && releaseTitle.trim() ? releaseTitle.trim() : existingTrack.releaseTitle || nextAlbum;
      const nextGenre = typeof genre === "string" ? genre.trim() : existingTrack.genre;
      if (nextTitle.length > 160 || nextAlbum.length > 160 || nextReleaseTitle.length > 160) {
        return res.status(400).json({ error: "Track, album, and release titles cannot exceed 160 characters." });
      }
      if (!["SINGLE", "EP", "ALBUM"].includes(nextReleaseType)) return res.status(400).json({ error: "releaseType must be SINGLE, EP, or ALBUM." });
      if (nextGenre.length > 80) return res.status(400).json({ error: "Genre cannot exceed 80 characters." });
      const currentYear = new Date().getFullYear();
      const nextReleaseYear = releaseYear === undefined ? existingTrack.releaseYear : Number(releaseYear);
      if (nextReleaseYear !== undefined && (!Number.isInteger(nextReleaseYear) || nextReleaseYear < 1850 || nextReleaseYear > currentYear + 1)) {
        return res.status(400).json({ error: "Release year is invalid." });
      }
      const nextTrackNumber = trackNumber === undefined ? existingTrack.trackNumber : Number(trackNumber);
      if (nextTrackNumber !== undefined && (!Number.isInteger(nextTrackNumber) || nextTrackNumber < 1 || nextTrackNumber > 999)) {
        return res.status(400).json({ error: "Track number must be an integer between 1 and 999." });
      }
      const nextCopyright = copyright !== undefined ? (String(copyright).trim() || undefined) : existingTrack.copyright;
      if (nextCopyright && nextCopyright.length > 300) return res.status(400).json({ error: "Copyright text cannot exceed 300 characters." });

      const updatedTrack: TrackRecord = {
        ...existingTrack,
        userId: sessionUserId,
        artist: (owner.artistName || owner.displayName || owner.username).trim(),
        title: nextTitle,
        album: nextAlbum,
        releaseType: nextReleaseType,
        releaseTitle: nextReleaseTitle,
        genre: nextGenre,
        coverUrl: persistentCoverUrl || owner.avatarUrl || DEFAULT_AVATAR_URL,
        audioUrl: persistentAudioUrl,
        duration: nextDuration,
        copyright: nextCopyright,
        releaseYear: nextReleaseYear,
        trackNumber: nextTrackNumber,
      };

      db.tracks[trackIndex] = updatedTrack;
      await writeDBAsync(db);
      return res.json({ success: true, track: updatedTrack });
    } catch (error: any) {
      console.error("Update Track Error:", error);
      return res.status(500).json({ error: "Failed to update track." });
    }
  });

  // Record a real track play and persist the authenticated listener's history.
  app.post("/api/tracks/:id/play", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDBAsync();
      const trackIndex = db.tracks.findIndex((track) => track.id === id);
      if (trackIndex === -1) return res.status(404).json({ error: "Track not found." });

      const sessionUserId = getUserIdFromToken(req);
      const listenerKey = sessionUserId || `${req.ip || 'unknown'}:${String(req.headers['user-agent'] || '').slice(0, 160)}`;
      const playEventKey = `${listenerKey}:${id}`;
      const now = Date.now();
      const previousPlayAt = recentPlayEvents.get(playEventKey) || 0;
      if (now - previousPlayAt < 30_000) {
        return res.json({ success: true, plays: db.tracks[trackIndex].plays || "0", deduplicated: true });
      }
      recentPlayEvents.set(playEventKey, now);
      if (recentPlayEvents.size > 10_000) {
        for (const [key, timestamp] of recentPlayEvents) {
          if (now - timestamp > 120_000) recentPlayEvents.delete(key);
        }
      }

      const currentPlays = Number.parseInt(db.tracks[trackIndex].plays || "0", 10) || 0;
      const nextPlays = String(currentPlays + 1);
      db.tracks[trackIndex] = { ...db.tracks[trackIndex], plays: nextPlays };

      if (sessionUserId) {
        const userIndex = db.users.findIndex((user) => user.id === sessionUserId);
        if (userIndex !== -1) {
          const state = db.userStates[sessionUserId] || { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [] };
          state.recentTrackIds = [id, ...state.recentTrackIds.filter((trackId) => trackId !== id)].slice(0, 50);
          db.userStates[sessionUserId] = state;

          const recentTracks = state.recentTrackIds
            .map((trackId) => db.tracks.find((track) => track.id === trackId))
            .filter((track): track is TrackRecord => Boolean(track));
          const genreCounts = new Map<string, number>();
          for (const track of recentTracks) {
            const genre = track.genre?.trim();
            if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
          }
          const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
          const previousStats = db.users[userIndex].stats || emptyStats();
          db.users[userIndex] = {
            ...db.users[userIndex],
            stats: {
              ...emptyStats(),
              ...previousStats,
              tracksPlayed: (previousStats.tracksPlayed || 0) + 1,
              topGenre,
            },
          };
        }
      }

      await writeDBAsync(db);
      return res.json({ success: true, plays: nextPlays });
    } catch (error: any) {
      console.error("Record Track Play Error:", error);
      return res.status(500).json({ error: "Failed to record track play." });
    }
  });

  // Delete only a track owned by the active session.
  app.delete("/api/tracks/:id", async (req, res) => {
    try {
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });

      const { id } = req.params;
      const db = await readDBAsync();
      const track = db.tracks.find((item) => item.id === id);
      if (!track) return res.status(404).json({ error: "Track not found." });
      if (track.userId !== sessionUserId) {
        return res.status(403).json({ error: "Forbidden: You can only delete tracks you uploaded." });
      }

      db.tracks = db.tracks.filter((item) => item.id !== id);
      for (const playlist of db.playlists) {
        playlist.trackIds = playlist.trackIds.filter((trackId) => trackId !== id);
        playlist.trackCount = playlist.trackIds.length;
      }
      for (const state of Object.values(db.userStates)) {
        state.likedTrackIds = state.likedTrackIds.filter((trackId) => trackId !== id);
        state.recentTrackIds = state.recentTrackIds.filter((trackId) => trackId !== id);
      }
      await writeDBAsync(db);
      const referencedMedia = collectReferencedMediaUrls(db);
      await Promise.all(
        [track.audioUrl, track.coverUrl]
          .filter((mediaUrl): mediaUrl is string => Boolean(mediaUrl && !referencedMedia.has(mediaUrl)))
          .map((mediaUrl) => deleteManagedFile(mediaUrl))
      );
      return res.json({ success: true, deletedTrackId: id });
    } catch (error: any) {
      console.error("Delete Track Error:", error);
      return res.status(500).json({ error: "Failed to delete track." });
    }
  });

  // Remove only the active user's own uploads. Never wipe other accounts.
  const handleWipeTracks = async (req: express.Request, res: express.Response) => {
    try {
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });

      const db = await readDBAsync();
      const ownedTracks = db.tracks.filter((track) => track.userId === sessionUserId);
      const ownedIds = new Set(ownedTracks.map((track) => track.id));
      if (ownedIds.size === 0) return res.status(404).json({ error: "No uploaded tracks found for this account." });

      db.tracks = db.tracks.filter((track) => !ownedIds.has(track.id));
      for (const playlist of db.playlists) {
        playlist.trackIds = playlist.trackIds.filter((trackId) => !ownedIds.has(trackId));
        playlist.trackCount = playlist.trackIds.length;
      }
      for (const state of Object.values(db.userStates)) {
        state.likedTrackIds = state.likedTrackIds.filter((trackId) => !ownedIds.has(trackId));
        state.recentTrackIds = state.recentTrackIds.filter((trackId) => !ownedIds.has(trackId));
      }
      await writeDBAsync(db);
      const referencedMedia = collectReferencedMediaUrls(db);
      const mediaToDelete = new Set<string>();
      for (const track of ownedTracks) {
        for (const mediaUrl of [track.audioUrl, track.coverUrl]) {
          if (mediaUrl && !referencedMedia.has(mediaUrl)) mediaToDelete.add(mediaUrl);
        }
      }
      await Promise.all([...mediaToDelete].map((mediaUrl) => deleteManagedFile(mediaUrl)));

      return res.json({ success: true, wipedCount: ownedIds.size, deletedTrackIds: [...ownedIds] });
    } catch (error: any) {
      console.error("Wipe Tracks Error:", error);
      return res.status(500).json({ error: "Failed to wipe uploaded tracks." });
    }
  };

  app.post("/api/tracks/wipe", handleWipeTracks);

  // Get and Sync all IDs (User IDs, Song IDs, Playlist IDs, Artist IDs) in Upstash Redis
  app.get("/api/upstash/ids", async (req, res) => {
    try {
      // SECURITY: this endpoint returns every user ID, track ID, playlist ID
      // and artist ID in the entire system. It must never be publicly
      // readable — restrict it to authenticated admin accounts only.
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ success: false, error: "Unauthorized: Active session required." });
      }
      const db = await readDBAsync();
      const requestingUser = db.users.find((u) => u.id === sessionUserId);
      if (!requestingUser?.isAdmin) {
        return res.status(403).json({ success: false, error: "Forbidden: Admin access required." });
      }
      const redis = getUpstashClient();

      const userIds = (db.users || []).map((u) => u.id).filter(Boolean);
      const songIds = (db.tracks || []).map((t) => t.id).filter(Boolean);
      const playlistIds = (db.playlists || []).map((p) => p.id).filter(Boolean);

      const artistIds = (db.users || [])
        .filter((u) => u.isArtist || db.tracks.some((track) => track.userId === u.id))
        .map((u) => u.id);

      if (redis) {
        await syncUpstashIndices(redis, db);
      }

      return res.json({
        success: true,
        upstashConfigured: isUpstashConfigured(),
        userIds,
        songIds,
        trackIds: songIds,
        playlistIds,
        artistIds,
        counts: {
          users: userIds.length,
          songs: songIds.length,
          playlists: playlistIds.length,
          artists: artistIds.length,
        },
      });
    } catch (error: any) {
      console.error("Upstash IDs endpoint error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch IDs." });
    }
  });

  app.get("/api/playlists/:id", async (req, res) => {
    try {
      const db = await readDBAsync();
      const playlist = db.playlists.find((item) => item.id === req.params.id);
      if (!playlist) return res.status(404).json({ error: "Playlist not found." });
      return res.json({ success: true, playlist });
    } catch (error: any) {
      console.error("Get Playlist Error:", error);
      return res.status(500).json({ error: "Failed to fetch playlist." });
    }
  });

  // Create a playlist for the active account only.
  app.post("/api/playlists", async (req, res) => {
    try {
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });
      if (req.body.userId && req.body.userId !== sessionUserId) {
        return res.status(403).json({ error: "Forbidden: Playlist owner cannot be assigned to another account." });
      }

      const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
      if (!title) return res.status(400).json({ error: "Playlist title is required." });
      if (title.length > 120) return res.status(400).json({ error: "Playlist title cannot exceed 120 characters." });
      const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
      if (description.length > 1_000) return res.status(400).json({ error: "Playlist description cannot exceed 1000 characters." });

      const db = await readDBAsync();
      const owner = db.users.find((user) => user.id === sessionUserId);
      if (!owner) return res.status(404).json({ error: "Playlist owner not found." });

      const requestedTrackIds: string[] = Array.isArray(req.body.trackIds) ? req.body.trackIds.filter((id: unknown): id is string => typeof id === "string") : [];
      const validTrackIds = new Set(db.tracks.map((track) => track.id));
      if (requestedTrackIds.some((trackId: unknown) => typeof trackId !== "string" || !validTrackIds.has(trackId))) {
        return res.status(404).json({ error: "One or more playlist tracks were not found." });
      }

      let persistentCoverUrl = owner.avatarUrl || DEFAULT_AVATAR_URL;
      if (typeof req.body.coverUrl === "string" && req.body.coverUrl.trim()) {
        const cleanCover = req.body.coverUrl.trim();
        if (cleanCover.startsWith("data:")) {
          const mimeMatch = cleanCover.match(/^data:(image\/[^;]+);base64,/);
          const base64 = cleanCover.includes(",") ? cleanCover.split(",")[1] : "";
          if (!mimeMatch || !base64) return res.status(400).json({ error: "Invalid playlist cover image." });
          persistentCoverUrl = await saveUploadedFile(base64, mimeMatch?.[1] || "image/jpeg", sessionUserId, "playlist");
        } else {
          if (!isStoredMediaUrl(cleanCover)) return res.status(400).json({ error: "Playlist cover URL must use HTTP(S) or an uploaded file." });
          persistentCoverUrl = cleanCover;
        }
      }

      const newPlaylist: PlaylistRecord = {
        id: createEntityId("pl"),
        userId: sessionUserId,
        title,
        description,
        coverUrl: persistentCoverUrl,
        trackIds: [...new Set(requestedTrackIds)],
        trackCount: new Set(requestedTrackIds).size,
        createdAt: new Date().toISOString(),
      };
      db.playlists.unshift(newPlaylist);
      const ownerIndex = db.users.findIndex((user) => user.id === sessionUserId);
      const stats = db.users[ownerIndex].stats || emptyStats();
      db.users[ownerIndex].stats = { ...emptyStats(), ...stats, playlistsCreated: db.playlists.filter((p) => p.userId === sessionUserId).length };
      await writeDBAsync(db);
      return res.status(201).json({ success: true, playlist: newPlaylist });
    } catch (error: any) {
      console.error("Create Playlist Error:", error);
      return res.status(500).json({ error: "Failed to create playlist." });
    }
  });

  app.put("/api/playlists/:id", async (req, res) => {
    try {
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });
      const db = await readDBAsync();
      const index = db.playlists.findIndex((playlist) => playlist.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: "Playlist not found." });
      const existing = db.playlists[index];
      if (existing.userId !== sessionUserId) {
        return res.status(403).json({ error: "Forbidden: You can only edit playlists you created." });
      }

      const nextTrackIds = req.body.trackIds === undefined ? existing.trackIds : req.body.trackIds;
      if (!Array.isArray(nextTrackIds)) return res.status(400).json({ error: "trackIds must be an array." });
      const validTrackIds = new Set(db.tracks.map((track) => track.id));
      if (nextTrackIds.some((trackId: unknown) => typeof trackId !== "string" || !validTrackIds.has(trackId))) {
        return res.status(404).json({ error: "One or more playlist tracks were not found." });
      }

      let persistentCoverUrl = existing.coverUrl;
      if (typeof req.body.coverUrl === "string") {
        const cleanCover = req.body.coverUrl.trim();
        if (cleanCover.startsWith("data:")) {
          const mimeMatch = cleanCover.match(/^data:(image\/[^;]+);base64,/);
          const base64 = cleanCover.includes(",") ? cleanCover.split(",")[1] : "";
          if (!mimeMatch || !base64) return res.status(400).json({ error: "Invalid playlist cover image." });
          persistentCoverUrl = await saveUploadedFile(base64, mimeMatch?.[1] || "image/jpeg", sessionUserId, "playlist");
        } else if (cleanCover) {
          if (!isStoredMediaUrl(cleanCover)) return res.status(400).json({ error: "Playlist cover URL must use HTTP(S) or an uploaded file." });
          persistentCoverUrl = cleanCover;
        }
      }

      const nextTitle = req.body.title === undefined ? existing.title : String(req.body.title).trim();
      if (!nextTitle) return res.status(400).json({ error: "Playlist title is required." });
      if (nextTitle.length > 120) return res.status(400).json({ error: "Playlist title cannot exceed 120 characters." });
      const nextDescription = req.body.description === undefined ? existing.description : String(req.body.description).trim();
      if (nextDescription.length > 1_000) return res.status(400).json({ error: "Playlist description cannot exceed 1000 characters." });
      db.playlists[index] = {
        ...existing,
        title: nextTitle,
        description: nextDescription,
        coverUrl: persistentCoverUrl,
        trackIds: [...new Set(nextTrackIds)],
        trackCount: new Set(nextTrackIds).size,
      };
      await writeDBAsync(db);
      return res.json({ success: true, playlist: db.playlists[index] });
    } catch (error: any) {
      console.error("Update Playlist Error:", error);
      return res.status(500).json({ error: "Failed to update playlist." });
    }
  });

  app.delete("/api/playlists/:id", async (req, res) => {
    try {
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized: Active session required." });
      const db = await readDBAsync();
      const target = db.playlists.find((playlist) => playlist.id === req.params.id);
      if (!target) return res.status(404).json({ error: "Playlist not found." });
      if (target.userId !== sessionUserId) {
        return res.status(403).json({ error: "Forbidden: You can only delete playlists you created." });
      }
      db.playlists = db.playlists.filter((playlist) => playlist.id !== target.id);
      const ownerIndex = db.users.findIndex((user) => user.id === sessionUserId);
      if (ownerIndex !== -1) {
        const stats = db.users[ownerIndex].stats || emptyStats();
        db.users[ownerIndex].stats = { ...emptyStats(), ...stats, playlistsCreated: db.playlists.filter((p) => p.userId === sessionUserId).length };
      }
      await writeDBAsync(db);
      return res.json({ success: true, deletedPlaylistId: target.id });
    } catch (error: any) {
      console.error("Delete Playlist Error:", error);
      return res.status(500).json({ error: "Failed to delete playlist." });
    }
  });

  // Update User Liked Tracks
  app.post("/api/user-state/:userId/liked-tracks", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own account data." });
      }
      const { likedTrackIds } = req.body;
      const db = await readDBAsync();
      if (!db.users.some((user) => user.id === userId)) {
        return res.status(404).json({ error: "User not found." });
      }
      if (!Array.isArray(likedTrackIds)) {
        return res.status(400).json({ error: "likedTrackIds must be an array." });
      }
      const validTrackIds = new Set(db.tracks.map((track) => track.id));
      if (likedTrackIds.some((trackId: unknown) => typeof trackId !== "string" || !validTrackIds.has(trackId))) {
        return res.status(404).json({ error: "One or more liked tracks were not found." });
      }
      if (!db.userStates[userId]) {
        db.userStates[userId] = { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [] };
      }

      db.userStates[userId].likedTrackIds = [...new Set(likedTrackIds)];
      await writeDBAsync(db);

      return res.json({ success: true, likedTrackIds: db.userStates[userId].likedTrackIds });
    } catch (error: any) {
      console.error("Update Liked Tracks Error:", error);
      return res.status(500).json({ error: "Failed to update liked tracks." });
    }
  });

// Helper to return clean API errors without claiming that content was created.
function parseCleanErrorMessage(err: any): { message: string; rateLimited: boolean } {
  if (!err) return { message: "An unexpected error occurred.", rateLimited: false };
  let msg = typeof err === "string" ? err : err.message || String(err);
  if (msg.startsWith("{") || msg.includes('"error":')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // Keep the original provider message.
    }
  }
  const rateLimited = msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("Quota exceeded");
  return {
    message: rateLimited
      ? "VERTEX Music AI is experiencing high demand. No track was created; please try again later."
      : msg,
    rateLimited,
  };
}

  // AI Music Generation Endpoint using only real audio returned by Google Lyria.
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, model = "lyria-3-clip-preview", title, genre, userId } = req.body;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "Music prompt is required." });
      }
      if (prompt.trim().length > 4_000) return res.status(400).json({ error: "Music prompt cannot exceed 4000 characters." });
      if (typeof userId !== "string" || !userId.trim()) {
        return res.status(400).json({ error: "A valid artist account ID is required." });
      }
      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "A valid signed-in artist session is required to generate and save music." });
      }
      if (sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: Music can only be generated for the active account." });
      }

      const db = await readDBAsync();
      const uploader = db.users.find((user) => user.id === userId);
      if (!uploader) return res.status(404).json({ error: "The signed-in artist profile could not be found." });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is missing. Please configure your API key in Secrets." });

      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const selectedModel = model === "lyria-3-pro-preview" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";
      const responseStream = await ai.models.generateContentStream({ model: selectedModel, contents: prompt.trim() });

      let audioBase64 = "";
      let mimeType = "audio/wav";
      let lyrics = "";
      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
            audioBase64 += part.inlineData.data;
          }
          if (part.text) lyrics += part.text;
        }
      }
      if (!audioBase64) {
        return res.status(404).json({ error: "The music provider returned no playable audio. No track was created." });
      }

      const generatedDuration = getWavDurationSeconds(audioBase64);
      if (generatedDuration <= 0) {
        return res.status(404).json({ error: "The music provider returned audio without valid duration metadata. No track was created." });
      }
      const audioUrl = await saveUploadedFile(audioBase64, mimeType, uploader.id, "ai_audio");
      const cleanPrompt = prompt.trim();
      const trackTitle = typeof title === "string" && title.trim()
        ? title.trim()
        : cleanPrompt.length > 60 ? `${cleanPrompt.slice(0, 57).trim()}...` : cleanPrompt;
      return res.json({
        success: true,
        audioUrl,
        duration: generatedDuration,
        suggestedTitle: trackTitle,
        lyrics: lyrics.trim(),
      });
    } catch (error: any) {
      console.error("Lyria AI Music Generation Error:", error);
      const { message, rateLimited } = parseCleanErrorMessage(error);
      return res.status(rateLimited ? 429 : 502).json({ error: message, rateLimited });
    }
  });

  // Gemini AI Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, userId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message string is required" });
      }
      const cleanMessage = message.trim();
      if (!cleanMessage) return res.status(400).json({ error: "Message string is required" });
      if (cleanMessage.length > 20_000) return res.status(400).json({ error: "Message cannot exceed 20000 characters." });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is missing. Please configure your API key in Secrets.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const isGenRequest = /(generate|create|make|compose|produce)\s+(a\s+)?(music|song|track|beat|melody|lofi|synthwave|ambient)/i.test(cleanMessage);
      let generatedTrack: TrackRecord | undefined;
      let requestOwner: UserRecord | undefined;

      if (userId) {
        if (typeof userId !== "string") {
          return res.status(400).json({ error: "userId must be a string." });
        }
        const sessionUserId = getUserIdFromToken(req);
        if (!sessionUserId) {
          return res.status(401).json({ error: "Unauthorized: Active session required." });
        }
        if (sessionUserId !== userId) {
          return res.status(403).json({ error: "Forbidden: You can only use your own account context." });
        }
        const ownerDB = await readDBAsync();
        requestOwner = ownerDB.users.find((user) => user.id === userId);
        if (!requestOwner) return res.status(404).json({ error: "User not found." });
      }

      if (isGenRequest) {
        if (!requestOwner) {
          return res.status(401).json({ error: "A valid signed-in artist session is required to generate and save music." });
        }

        const responseStream = await ai.models.generateContentStream({ model: "lyria-3-clip-preview", contents: cleanMessage });
        let audioBase64 = "";
        let mimeType = "audio/wav";
        for await (const chunk of responseStream) {
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
              audioBase64 += part.inlineData.data;
            }
          }
        }
        if (!audioBase64) {
          return res.status(404).json({ error: "The music provider returned no playable audio. No track was created." });
        }

        const db = await readDBAsync();
        const currentOwner = db.users.find((user) => user.id === requestOwner!.id);
        if (!currentOwner) return res.status(404).json({ error: "The signed-in artist profile could not be found." });
        const generatedDuration = getWavDurationSeconds(audioBase64);
        if (generatedDuration <= 0) {
          return res.status(404).json({ error: "The music provider returned audio without valid duration metadata. No track was created." });
        }
        const audioUrl = await saveUploadedFile(audioBase64, mimeType, currentOwner.id, "ai_audio");
        const title = cleanMessage.length > 60 ? `${cleanMessage.slice(0, 57).trim()}...` : cleanMessage;
        generatedTrack = {
          id: createEntityId("trk"),
          userId: currentOwner.id,
          title,
          artist: (currentOwner.artistName || currentOwner.displayName || currentOwner.username).trim(),
          album: title,
          releaseType: "SINGLE",
          releaseTitle: title,
          releaseId: createEntityId("rel"),
          genre: "",
          duration: generatedDuration,
          audioUrl,
          coverUrl: currentOwner.avatarUrl || DEFAULT_AVATAR_URL,
          plays: "0",
          createdAt: new Date().toISOString(),
        };
        db.tracks.unshift(generatedTrack);
        const ownerIndex = db.users.findIndex((user) => user.id === currentOwner.id);
        db.users[ownerIndex] = { ...db.users[ownerIndex], isArtist: true };
        await writeDBAsync(db);
      }

      const formattedHistory = Array.isArray(history)
        ? history
            .slice(-40)
            .flatMap((item: any) => {
              if (!item || (item.role !== "user" && item.role !== "model")) return [];
              const text = typeof item.text === "string"
                ? item.text.trim()
                : typeof item.content === "string"
                  ? item.content.trim()
                  : "";
              if (!text) return [];
              return [{ role: item.role, parts: [{ text: text.slice(0, 20_000) }] }];
            })
        : [];

      const chat = ai.chats.create({
        model: "gemini-3.5-flash-lite",
        config: {
          systemInstruction:
            "You are VERTEX Music AI, an expert, energetic VERTEX Music AI DJ, Producer, and Music Assistant. " +
            "You give music recommendations, curate playlist ideas, explain musical genres and instruments, " +
            "and assist with generating AI music using Lyria models (`lyria-3-clip-preview` or `lyria-3-pro-preview`). " +
            "Keep responses friendly, engaging, and cleanly formatted with markdown bullet points or bold text. " +
            "When mentioning song titles or artists, bold them clearly. " +
            "You have live Google Search access: use it whenever the user asks about current events, recent " +
            "releases, chart rankings, tour dates, news, or anything else that could have changed recently, " +
            "instead of relying only on what you already know.",
          tools: [{ googleSearch: {} }],
        },
        history: formattedHistory,
      });

      const response = await chat.sendMessage({ message: cleanMessage });
      let replyText = typeof response.text === "string" ? response.text.trim() : "";
      if (!replyText) return res.status(404).json({ error: "The AI provider returned no text response." });

      // Surface the web sources Gemini actually grounded on (if any) as
      // structured data, so the client can render a proper "searched the
      // web" indicator (Gemini-app style) instead of inline markdown links.
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const groundingChunks = groundingMetadata?.groundingChunks;
      const webSearchQueries: string[] = Array.isArray(groundingMetadata?.webSearchQueries)
        ? groundingMetadata!.webSearchQueries
        : [];

      let sources: { title: string; uri: string }[] = [];
      if (Array.isArray(groundingChunks) && groundingChunks.length > 0) {
        const seen = new Set<string>();
        for (const c of groundingChunks as any[]) {
          const uri = c?.web?.uri;
          const title = c?.web?.title;
          if (uri && title && !seen.has(uri)) {
            seen.add(uri);
            sources.push({ title, uri });
          }
        }
        sources = sources.slice(0, 5);
      }

      const webSearchUsed = webSearchQueries.length > 0 || sources.length > 0;

      if (generatedTrack) {
        replyText += `\n\n✨ **I've composed a custom AI track for you:** **${generatedTrack.title}**! You can play it directly below or save it to your library.`;
      }

      if (userId) {
        try {
          const db = await readDBAsync();
          if (!db.chatHistories[userId]) {
            db.chatHistories[userId] = [];
          }
          const userMsg = {
            id: createEntityId("msg"),
            sender: "user" as const,
            text: cleanMessage,
            timestamp: new Date().toISOString(),
          };
          const aiMsg = {
            id: createEntityId("msg"),
            sender: "ai" as const,
            text: replyText,
            timestamp: new Date().toISOString(),
            matchedTracks: generatedTrack ? [generatedTrack] : undefined,
            webSearchUsed,
            searchQueries: webSearchQueries,
            sources,
          };
          db.chatHistories[userId].push(userMsg, aiMsg);
          db.chatHistories[userId] = sanitizeChatHistory(db.chatHistories[userId], db.tracks);
          await writeDBAsync(db);
        } catch (dbErr) {
          console.error("Error persisting user chat to DB:", dbErr);
        }
      }

      return res.json({ reply: replyText, generatedTrack, webSearchUsed, searchQueries: webSearchQueries, sources });
    } catch (error: any) {
      console.error("Gemini API Chat Error:", error);
      const { message: cleanMsg, rateLimited } = parseCleanErrorMessage(error);
      return res.status(rateLimited ? 429 : 500).json({
        error: cleanMsg,
        rateLimited,
      });
    }
  });

  // Serve Vite in dev or static files in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
