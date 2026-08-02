import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { readDB, writeDB, readDBAsync, writeDBAsync, initUpstashDB, isUpstashConfigured, getUpstashClient, syncUpstashIndices, loadSessionsFromRedis, persistSessionToRedis, deleteSessionFromRedis, UserRecord, PlaylistRecord, TrackRecord } from "./server/db.js";

dotenv.config();

function sanitizeUserId(userId: string): string {
  if (!userId || typeof userId !== "string") return "public";
  const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized || sanitized === ".." || sanitized.includes("..")) {
    return "public";
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

async function saveFileToLocalDisk(base64Data: string, mimeType: string, folderUserId: string, filePrefix: string): Promise<string> {
  const safeUserId = sanitizeUserId(folderUserId);
  const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const uploadsRootDir = path.join(process.cwd(), "data", "uploads");
  const userUploadDir = path.join(uploadsRootDir, safeUserId);

  if (!userUploadDir.startsWith(uploadsRootDir)) {
    throw new Error("Invalid target directory path");
  }

  if (!fs.existsSync(userUploadDir)) {
    fs.mkdirSync(userUploadDir, { recursive: true });
  }

  let ext = (mimeType || '').split('/')[1] || 'bin';
  if (ext.includes(';')) ext = ext.split(';')[0];
  if (ext === 'mpeg' || ext === 'mp3') ext = 'mp3';
  if (ext === 'jpeg' || ext === 'jpg') ext = 'jpg';
  if (ext === 'png') ext = 'png';
  if (ext === 'ogg') ext = 'ogg';
  if (ext === 'wav') ext = 'wav';
  if (ext === 'webm') ext = 'webm';
  if (ext === 'm4a' || ext === 'x-m4a' || ext === 'mp4') ext = 'm4a';

  const localFilename = `${filePrefix}_${fileId}.${ext}`;
  const localFilePath = path.join(userUploadDir, localFilename);
  const cleanBase64 = base64Data.replace(/[\r\n\s]/g, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/${safeUserId}/${localFilename}`;
}

async function saveUploadedFile(base64Data: string, mimeType: string, folderUserId: string, filePrefix: string): Promise<string> {
  const safeUserId = sanitizeUserId(folderUserId);
  const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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

  // Save local disk backup copy for resilience
  try {
    await saveFileToLocalDisk(base64Data, mimeType, folderUserId, filePrefix);
  } catch (err) {
    console.warn("Local disk backup save error:", err);
  }

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

  return `/uploads/${safeUserId}/${filename}`;
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
    const key = req.params[0];
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

      if (!key) {
        return res.status(404).send("File key missing.");
      }

      // Check local disk first as fast fallback if R2 is not configured
      if (!r2 || !bucketName) {
        const localPath = path.join(process.cwd(), "data", "uploads", key);
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
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
      if (key) {
        const localPath = path.join(process.cwd(), "data", "uploads", key);
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
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
  app.get("/api/system-status", (req, res) => {
    const upstashActive = isUpstashConfigured();
    const r2Active = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
    const db = readDB();

    res.json({
      status: "ok",
      upstashRedis: {
        configured: upstashActive,
        message: upstashActive ? "Connected and active" : "Not configured. Using local disk (specify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment settings)."
      },
      cloudflareR2: {
        configured: r2Active,
        message: r2Active ? "Connected and active" : "Not configured. Using local disk fallback (specify R2_* variables in environment settings)."
      },
      databaseStats: {
        usersCount: db.users.length,
        tracksCount: db.tracks.length,
        playlistsCount: db.playlists.length
      }
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

  function verifyUserOwnership(req: express.Request, targetUserId?: string): boolean {
    if (!targetUserId || targetUserId === "public") return false;
    const sessionUserId = getUserIdFromToken(req);
    if (!sessionUserId) return false;
    return sessionUserId === targetUserId;
  }

  // User Registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, displayName } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email, and password are required." });
      }

      const db = readDB();

      const existingUser = db.users.find(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() ||
          u.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (existingUser) {
        return res.status(400).json({ error: "Username or email is already registered." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser: UserRecord = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        displayName: (displayName || username).trim(),
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80`,
        bio: "Music listener on VERTEX Music.",
        favoriteGenres: ["Electronic", "Synthwave", "Pop"],
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
        settings: {
          losslessAudio: true,
          autoplay: true,
          audioNormalization: true,
          offlineDownloads: true,
        },
      };

      db.users.push(newUser);
      db.userStates[newUser.id] = { likedTrackIds: [], recentTrackIds: [] };
      writeDB(db);

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
      const { usernameOrEmail, password } = req.body;

      if (!usernameOrEmail || !password) {
        return res.status(400).json({ error: "Username/email and password are required." });
      }

      const db = readDB();
      const identifier = usernameOrEmail.trim().toLowerCase();

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
          writeDB(db);
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

  // Fetch Application Data (Tracks, Playlists, User State, Chat History)
  app.get("/api/data", async (req, res) => {
    try {
      const db = await readDBAsync();
      const authUserId = getUserIdFromToken(req);

      let currentUser = null;
      let likedTrackIds: string[] = [];
      let userChatHistory: any[] = [];
      let userPlaylists = db.playlists.filter((p) => !p.userId || p.userId === "public");
      let token = "";

      if (authUserId) {
        const found = db.users.find((u) => u.id === authUserId);
        if (found) {
          const { password: _, ...uNoPass } = found;
          currentUser = uNoPass;
          likedTrackIds = db.userStates[authUserId] ? db.userStates[authUserId].likedTrackIds : [];
          userChatHistory = db.chatHistories[authUserId] ? db.chatHistories[authUserId] : [];
          userPlaylists = db.playlists.filter(
            (p) => !p.userId || p.userId === "public" || p.userId === authUserId
          );
          token = issueSessionToken(authUserId);
        }
      }

      return res.json({
        user: currentUser,
        tracks: db.tracks,
        playlists: userPlaylists,
        likedTrackIds,
        chatHistory: userChatHistory,
        token,
      });
    } catch (error: any) {
      console.error("Fetch Data Error:", error);
      return res.status(500).json({ error: "Failed to fetch application data." });
    }
  });

  // Get User-Scoped Chat History
  app.get("/api/chat-history/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      if (!verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }
      const db = readDB();
      const history = db.chatHistories[userId] || [];
      return res.json({ success: true, chatHistory: history });
    } catch (error: any) {
      console.error("Fetch Chat History Error:", error);
      return res.status(500).json({ error: "Failed to fetch chat history." });
    }
  });

  // Save User-Scoped Chat History
  app.post("/api/chat-history/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      if (!verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }
      const { chatHistory } = req.body;
      const db = readDB();

      db.chatHistories[userId] = Array.isArray(chatHistory) ? chatHistory : [];
      writeDB(db);

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
          artists: db.users.map((u) => ({
            id: u.id,
            name: u.artistName || u.displayName || u.username,
            username: u.username,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
            bio: u.bio || u.artistBio || "Music listener & creator on VERTEX Music.",
            genre: u.favoriteGenres?.[0] || "Electronic",
            monthlyListeners: u.monthlyListeners || "12,400 monthly listeners",
            verified: u.isArtist || u.artistVerified || false,
            isUser: true,
          })),
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
        .filter(
          (u) =>
            u.username.toLowerCase().includes(query) ||
            u.displayName.toLowerCase().includes(query) ||
            (u.artistName && u.artistName.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query)) ||
            (u.bio && u.bio.toLowerCase().includes(query))
        )
        .map((u) => ({
          id: u.id,
          name: u.artistName || u.displayName || u.username,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
          bio: u.bio || u.artistBio || "Music listener & creator on VERTEX Music.",
          genre: u.favoriteGenres?.[0] || "Electronic",
          monthlyListeners: u.monthlyListeners || "24,800 monthly listeners",
          verified: u.isArtist || u.artistVerified || false,
          isUser: true,
        }));

      // Extract unique artists from uploaded tracks
      const trackArtistNames = Array.from(new Set(db.tracks.map((t) => t.artist)));
      const matchedTrackArtists = trackArtistNames
        .filter((name) => name.toLowerCase().includes(query))
        .filter((name) => !matchedUsers.some((u) => u.name.toLowerCase() === name.toLowerCase()))
        .map((name) => {
          const userMatch = db.users.find(u => u.displayName?.toLowerCase() === name.toLowerCase() || u.artistName?.toLowerCase() === name.toLowerCase());
          
          if (userMatch) {
            return {
              id: userMatch.id,
              name: userMatch.artistName || userMatch.displayName || userMatch.username,
              username: userMatch.username,
              displayName: userMatch.displayName,
              avatarUrl: userMatch.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
              bio: userMatch.bio || userMatch.artistBio || "Music listener & creator on VERTEX Music.",
              genre: userMatch.favoriteGenres?.[0] || "Electronic",
              monthlyListeners: userMatch.monthlyListeners || "0 monthly listeners",
              verified: userMatch.isArtist || userMatch.artistVerified || false,
              isUser: true,
            };
          }

          const sampleTrack = db.tracks.find((t) => t.artist === name);
          return {
            id: `artist-${name.toLowerCase().replace(/\s+/g, "-")}`,
            name: name,
            username: name.toLowerCase().replace(/\s+/g, "_"),
            displayName: name,
            avatarUrl: sampleTrack?.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
            bio: `${name} is a featured artist on VERTEX Music.`,
            genre: sampleTrack?.genre || "Electronic",
            monthlyListeners: "0 monthly listeners",
            verified: true,
            isUser: false,
          };
        });

      const combinedArtists = [...matchedUsers, ...matchedTrackArtists];

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
  app.delete("/api/chat-history/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      if (!verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }
      const db = readDB();

      db.chatHistories[userId] = [];
      writeDB(db);

      return res.json({ success: true, chatHistory: [] });
    } catch (error: any) {
      console.error("Clear Chat History Error:", error);
      return res.status(500).json({ error: "Failed to clear chat history." });
    }
  });

  // Update User Profile
  app.put("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }
      const updates = req.body;
      const db = await readDBAsync();

      const index = db.users.findIndex((u) => u.id === userId);
      if (index === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      let avatarUrl = updates.avatarUrl ?? db.users[index].avatarUrl;
      let bannerUrl = updates.bannerUrl ?? db.users[index].bannerUrl;

      if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.startsWith("data:")) {
        const mimeMatch = avatarUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const b64 = avatarUrl.includes(",") ? avatarUrl.split(",")[1] : avatarUrl;
        if (b64) avatarUrl = await saveUploadedFile(b64, mimeType, userId, "avatar");
      }

      if (bannerUrl && typeof bannerUrl === "string" && bannerUrl.startsWith("data:")) {
        const mimeMatch = bannerUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const b64 = bannerUrl.includes(",") ? bannerUrl.split(",")[1] : bannerUrl;
        if (b64) bannerUrl = await saveUploadedFile(b64, mimeType, userId, "banner");
      }

      db.users[index] = {
        ...db.users[index],
        displayName: updates.displayName ?? db.users[index].displayName,
        username: updates.username ?? db.users[index].username,
        bio: updates.bio ?? db.users[index].bio,
        avatarUrl,
        bannerUrl,
        favoriteGenres: updates.favoriteGenres ?? db.users[index].favoriteGenres,
        isArtist: updates.isArtist ?? db.users[index].isArtist ?? true,
        artistName: updates.artistName ?? db.users[index].artistName ?? updates.displayName ?? db.users[index].displayName,
        artistBio: updates.artistBio ?? db.users[index].artistBio ?? updates.bio ?? db.users[index].bio,
        artistVerified: updates.artistVerified ?? db.users[index].artistVerified ?? true,
        monthlyListeners: updates.monthlyListeners ?? db.users[index].monthlyListeners ?? "1,248 monthly listeners",
        stats: updates.stats ?? db.users[index].stats ?? {
          hoursListened: 0,
          secondsListened: 0,
          tracksPlayed: 0,
          topGenre: "N/A",
          playlistsCreated: 0,
          followersCount: 0,
          followingCount: 0,
        },
        settings: updates.settings ?? db.users[index].settings,
      };

      writeDB(db);

      const { password: _, ...updatedUser } = db.users[index];
      return res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Update User Error:", error);
      return res.status(500).json({ error: "Failed to update user profile." });
    }
  });

  // Add Custom Track & Store Audio File to User Directory / Cloudflare R2
  app.post("/api/tracks", async (req, res) => {
    try {
      const { userId, title, artist, album, coverUrl, audioUrl, duration, genre, syncedLyrics, releaseType, releaseTitle, releaseId, copyright, releaseYear, trackNumber } = req.body;

      if (!title || !artist) {
        return res.status(400).json({ success: false, error: "Track title and artist are required." });
      }

      const sessionUserId = getUserIdFromToken(req);
      const folderUserId = sessionUserId || userId || "public";

      if (userId && userId !== "public" && sessionUserId && userId !== sessionUserId) {
        return res.status(403).json({ success: false, error: "Forbidden: Unauthorized user session." });
      }

      const db = await readDBAsync();
      const trackId = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let persistentAudioUrl = audioUrl || "";
      let persistentCoverUrl = coverUrl || "";

      // 1. Save base64 audio file
      if (audioUrl && typeof audioUrl === "string" && audioUrl.startsWith("data:")) {
        const mimeMatch = audioUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "audio/mpeg";
        const base64Data = audioUrl.includes(",") ? audioUrl.split(",")[1] : audioUrl;
        
        if (base64Data) {
          persistentAudioUrl = await saveUploadedFile(base64Data, mimeType, folderUserId, "audio");
        }
      }

      // 2. Save base64 cover image
      if (coverUrl && typeof coverUrl === "string" && coverUrl.startsWith("data:")) {
        const mimeMatch = coverUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const imgBase64 = coverUrl.includes(",") ? coverUrl.split(",")[1] : coverUrl;
        
        if (imgBase64) {
          persistentCoverUrl = await saveUploadedFile(imgBase64, mimeType, folderUserId, "cover");
        }
      }

      if (!persistentCoverUrl) {
        persistentCoverUrl =
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
      }

      const newTrack: TrackRecord = {
        id: trackId,
        userId: folderUserId,
        title: title.trim(),
        artist: artist.trim(),
        album: (album || "Single").trim(),
        releaseType: releaseType || (album === "Single" ? "SINGLE" : "ALBUM"),
        releaseTitle: releaseTitle || (album === "Single" ? title.trim() : (album || "Single").trim()),
        releaseId: releaseId || `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        copyright: copyright ? String(copyright).trim() : undefined,
        releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(),
        trackNumber: trackNumber !== undefined && trackNumber !== null ? Number(trackNumber) : undefined,
        coverUrl: persistentCoverUrl,
        audioUrl: persistentAudioUrl,
        duration: Number(duration) || 180,
        genre: genre || "Electronic",
        syncedLyrics: syncedLyrics || [
          { time: 0, text: `(Playing ${title} by ${artist})` },
          { time: 10, text: "Feel the frequency and the beat..." },
        ],
        createdAt: new Date().toISOString(),
      };

      db.tracks.unshift(newTrack);
      writeDB(db);

      return res.json({ success: true, track: newTrack });
    } catch (error: any) {
      console.error("Add Track Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to add track." });
    }
  });

  // Update Track (with Ownership Authorization)
  app.put("/api/tracks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, title, artist, album, genre, coverUrl, audioUrl, duration, releaseType, releaseTitle, copyright, releaseYear, trackNumber } = req.body;
      const db = await readDBAsync();

      const trackIndex = db.tracks.findIndex((t) => t.id === id);
      if (trackIndex === -1) {
        return res.status(404).json({ error: "Track not found." });
      }

      const existingTrack = db.tracks[trackIndex];
      const sessionUserId = getUserIdFromToken(req);

      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }

      if (existingTrack.userId && existingTrack.userId !== "public") {
        if (existingTrack.userId !== sessionUserId) {
          return res.status(403).json({ error: "Forbidden: You can only edit tracks you uploaded." });
        }
      } else {
        const requestingUser = db.users.find((u) => u.id === sessionUserId);
        const isAdmin = requestingUser?.isAdmin === true;
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden: Public seed tracks cannot be edited." });
        }
      }

      let persistentCoverUrl = existingTrack.coverUrl;
      if (coverUrl !== undefined && coverUrl.trim()) {
        if (coverUrl.startsWith("data:")) {
          const mimeMatch = coverUrl.match(/^data:([^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const imgBase64 = coverUrl.includes(",") ? coverUrl.split(",")[1] : coverUrl;
          if (imgBase64) {
            persistentCoverUrl = await saveUploadedFile(imgBase64, mimeType, sessionUserId, "cover");
          }
        } else {
          persistentCoverUrl = coverUrl.trim();
        }
      }

      // Allow replacing the actual audio file too (same base64 upload path
      // used when the track was first created), so editing a track can
      // change literally everything the original upload form collected.
      let persistentAudioUrl = existingTrack.audioUrl;
      if (audioUrl !== undefined && typeof audioUrl === "string" && audioUrl.trim() && audioUrl.startsWith("data:")) {
        const mimeMatch = audioUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "audio/mpeg";
        const audioBase64 = audioUrl.includes(",") ? audioUrl.split(",")[1] : audioUrl;
        if (audioBase64) {
          persistentAudioUrl = await saveUploadedFile(audioBase64, mimeType, sessionUserId, "audio");
        }
      }

      const updatedTrack = {
        ...existingTrack,
        title: title !== undefined && title.trim() ? title.trim() : existingTrack.title,
        artist: artist !== undefined && artist.trim() ? artist.trim() : existingTrack.artist,
        album: album !== undefined && album.trim() ? album.trim() : existingTrack.album,
        releaseType: releaseType !== undefined ? releaseType : existingTrack.releaseType,
        releaseTitle: releaseTitle !== undefined ? releaseTitle : existingTrack.releaseTitle,
        genre: genre !== undefined && genre.trim() ? genre.trim() : existingTrack.genre,
        coverUrl: persistentCoverUrl,
        audioUrl: persistentAudioUrl,
        duration: duration !== undefined && Number(duration) > 0 ? Number(duration) : existingTrack.duration,
        copyright: copyright !== undefined ? (copyright ? String(copyright).trim() : undefined) : existingTrack.copyright,
        releaseYear: releaseYear !== undefined ? Number(releaseYear) : existingTrack.releaseYear,
        trackNumber: trackNumber !== undefined && trackNumber !== null ? Number(trackNumber) : existingTrack.trackNumber,
        userId: existingTrack.userId || userId,
      };

      db.tracks[trackIndex] = updatedTrack;
      writeDB(db);

      return res.json({ success: true, track: updatedTrack });
    } catch (error: any) {
      console.error("Update Track Error:", error);
      return res.status(500).json({ error: "Failed to update track." });
    }
  });

  // Delete Track
  app.delete("/api/tracks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDBAsync();

      const trackToDelete = db.tracks.find((t) => t.id === id);
      if (!trackToDelete) {
        return res.status(404).json({ error: "Track not found." });
      }

      const sessionUserId = getUserIdFromToken(req);
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized: Active session required." });
      }

      if (trackToDelete.userId && trackToDelete.userId !== "public") {
        if (trackToDelete.userId !== sessionUserId) {
          return res.status(403).json({ error: "Forbidden: You can only delete tracks you uploaded." });
        }
      } else {
        const requestingUser = db.users.find((u) => u.id === sessionUserId);
        const isAdmin = requestingUser?.isAdmin === true;
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden: Public seed tracks cannot be deleted." });
        }
      }

      db.tracks = db.tracks.filter((t) => t.id !== id);
      db.playlists.forEach((p) => {
        p.trackIds = p.trackIds.filter((tid) => tid !== id);
      });
      Object.keys(db.userStates).forEach((uid) => {
        db.userStates[uid].likedTrackIds = db.userStates[uid].likedTrackIds.filter((tid) => tid !== id);
      });

      writeDB(db);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Track Error:", error);
      return res.status(500).json({ error: "Failed to delete track." });
    }
  });

  // Wipe All Uploaded Tracks & Clear Uploaded Files
  const handleWipeTracks = async (req: express.Request, res: express.Response) => {
    try {
      const db = await readDBAsync();
      const count = db.tracks.length;

      // 1. Clear track list
      db.tracks = [];

      // 2. Clear track IDs in playlists
      db.playlists.forEach((p) => {
        p.trackIds = [];
      });

      // 3. Clear track IDs in user states
      Object.keys(db.userStates).forEach((uid) => {
        if (db.userStates[uid]) {
          db.userStates[uid].likedTrackIds = [];
          db.userStates[uid].recentTrackIds = [];
        }
      });

      // 4. Save updated DB to disk and Upstash Redis
      await writeDBAsync(db);

      // 5. Clean up local uploads directory
      const uploadsRootDir = path.join(process.cwd(), "data", "uploads");
      if (fs.existsSync(uploadsRootDir)) {
        try {
          fs.rmSync(uploadsRootDir, { recursive: true, force: true });
          fs.mkdirSync(uploadsRootDir, { recursive: true });
        } catch (fileErr) {
          console.warn("Notice clearing local uploads directory:", fileErr);
        }
      }

      return res.json({ success: true, message: "All uploaded tracks wiped successfully.", wipedCount: count });
    } catch (error: any) {
      console.error("Wipe Tracks Error:", error);
      return res.status(500).json({ success: false, error: "Failed to wipe uploaded tracks." });
    }
  };

  app.post("/api/tracks/wipe", handleWipeTracks);
  app.delete("/api/tracks/wipe", handleWipeTracks);

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

      const artistUserIds = (db.users || []).filter((u) => u.isArtist).map((u) => u.id);
      const trackArtistNames = Array.from(new Set((db.tracks || []).map((t) => t.artist).filter(Boolean)));
      const artistIds = Array.from(new Set([...artistUserIds, ...trackArtistNames]));

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

  // Create Playlist
  app.post("/api/playlists", async (req, res) => {
    try {
      const { userId, title, description, coverUrl, trackIds } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Playlist title is required." });
      }

      if (userId && !verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }

      const sessionUserId = getUserIdFromToken(req) || userId || "public";
      let persistentCoverUrl = coverUrl || "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80";

      if (coverUrl && typeof coverUrl === "string" && coverUrl.startsWith("data:")) {
        const mimeMatch = coverUrl.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const imgBase64 = coverUrl.includes(",") ? coverUrl.split(",")[1] : coverUrl;
        if (imgBase64) {
          persistentCoverUrl = await saveUploadedFile(imgBase64, mimeType, sessionUserId, "playlist");
        }
      }

      const db = await readDBAsync();
      const newPlaylist: PlaylistRecord = {
        id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: userId || "",
        title: title.trim(),
        description: (description || "").trim(),
        coverUrl: persistentCoverUrl,
        trackIds: Array.isArray(trackIds) ? trackIds : [],
        likes: "1",
        createdAt: new Date().toISOString(),
      };

      db.playlists.unshift(newPlaylist);
      writeDB(db);

      return res.json({ success: true, playlist: newPlaylist });
    } catch (error: any) {
      console.error("Create Playlist Error:", error);
      return res.status(500).json({ error: "Failed to create playlist." });
    }
  });

  // Update Playlist
  app.put("/api/playlists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, coverUrl, trackIds } = req.body;
      const db = await readDBAsync();

      const index = db.playlists.findIndex((p) => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Playlist not found." });
      }

      const existingPlaylist = db.playlists[index];
      if (existingPlaylist.userId && !verifyUserOwnership(req, existingPlaylist.userId)) {
        return res.status(403).json({ error: "Forbidden: You can only edit playlists you created." });
      }

      let persistentCoverUrl = db.playlists[index].coverUrl;
      if (coverUrl !== undefined) {
        if (typeof coverUrl === "string" && coverUrl.startsWith("data:")) {
          const mimeMatch = coverUrl.match(/^data:([^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const imgBase64 = coverUrl.includes(",") ? coverUrl.split(",")[1] : coverUrl;
          if (imgBase64) {
            persistentCoverUrl = await saveUploadedFile(imgBase64, mimeType, existingPlaylist.userId || "public", "playlist");
          }
        } else {
          persistentCoverUrl = coverUrl;
        }
      }

      db.playlists[index] = {
        ...db.playlists[index],
        title: title !== undefined ? title.trim() : db.playlists[index].title,
        description: description !== undefined ? description.trim() : db.playlists[index].description,
        coverUrl: persistentCoverUrl,
        trackIds: Array.isArray(trackIds) ? trackIds : db.playlists[index].trackIds,
      };

      writeDB(db);
      return res.json({ success: true, playlist: db.playlists[index] });
    } catch (error: any) {
      console.error("Update Playlist Error:", error);
      return res.status(500).json({ error: "Failed to update playlist." });
    }
  });

  // Delete Playlist
  app.delete("/api/playlists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDBAsync();

      const targetPlaylist = db.playlists.find((p) => p.id === id);
      if (targetPlaylist && targetPlaylist.userId && !verifyUserOwnership(req, targetPlaylist.userId)) {
        return res.status(403).json({ error: "Forbidden: You can only delete playlists you created." });
      }

      db.playlists = db.playlists.filter((p) => p.id !== id);
      writeDB(db);

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Playlist Error:", error);
      return res.status(500).json({ error: "Failed to delete playlist." });
    }
  });

  // Update User Liked Tracks
  app.post("/api/user-state/:userId/liked-tracks", (req, res) => {
    try {
      const { userId } = req.params;
      if (!verifyUserOwnership(req, userId)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized user session." });
      }
      const { likedTrackIds } = req.body;
      const db = readDB();

      if (!db.userStates[userId]) {
        db.userStates[userId] = { likedTrackIds: [], recentTrackIds: [] };
      }

      db.userStates[userId].likedTrackIds = Array.isArray(likedTrackIds) ? likedTrackIds : [];
      writeDB(db);

      return res.json({ success: true, likedTrackIds: db.userStates[userId].likedTrackIds });
    } catch (error: any) {
      console.error("Update Liked Tracks Error:", error);
      return res.status(500).json({ error: "Failed to update liked tracks." });
    }
  });

// Helper to parse clean user-friendly error messages from API exceptions
function parseCleanErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred.";
  let msg = typeof err === "string" ? err : err.message || String(err);

  if (msg.startsWith("{") || msg.includes('"error":')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {
      // ignore
    }
  }

  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("Quota exceeded")) {
    return "The Lyria AI Music generation free quota is currently rate limited. A fallback audio track was generated for your request.";
  }

  return msg;
}

// Procedural WAV audio generator fallback when Lyria rate limits or offline
function generateFallbackAudioWav(prompt: string, durationSec = 12): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV Header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const pLower = prompt.toLowerCase();
  let baseFreq = 220; // A3
  if (pLower.includes("chill") || pLower.includes("lofi")) baseFreq = 196; // G3
  if (pLower.includes("cyber") || pLower.includes("heavy") || pLower.includes("synth")) baseFreq = 146.83; // D3
  if (pLower.includes("ambient") || pLower.includes("relax")) baseFreq = 261.63; // C4

  const scale = [baseFreq, baseFreq * 1.125, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.667, baseFreq * 1.875];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t * 2);
    const noteFreq = scale[beat % scale.length] || baseFreq;

    const phase = (t * noteFreq) % 1;
    const synthWave = (phase * 2 - 1) * 0.3;
    const padWave = Math.sin(2 * Math.PI * (noteFreq * 1.002) * t) * 0.25;
    const subBass = Math.sin(2 * Math.PI * (baseFreq / 2) * t) * 0.3;

    const beatPhase = (t * 2) % 1;
    const env = Math.exp(-beatPhase * 2.5);

    const sample = Math.max(-1, Math.min(1, (synthWave + padWave + subBass) * env * 0.5));
    const int16 = Math.floor(sample * 32767);
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

  // AI Music Generation Endpoint using Google GenAI Lyria models
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, model = "lyria-3-clip-preview", title, genre, userId } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Music prompt is required" });
      }

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

      const selectedModel = model === "lyria-3-pro-preview" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

      let audioDataUrl = "";
      let lyrics = "";
      let isFallback = false;

      try {
        const responseStream = await ai.models.generateContentStream({
          model: selectedModel,
          contents: prompt,
        });

        let audioBase64 = "";
        let mimeType = "audio/wav";

        for await (const chunk of responseStream) {
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (!parts) continue;

          for (const part of parts) {
            if (part.inlineData?.data) {
              if (!audioBase64 && part.inlineData.mimeType) {
                mimeType = part.inlineData.mimeType;
              }
              audioBase64 += part.inlineData.data;
            }
            if (part.text && !lyrics) {
              lyrics = part.text;
            }
          }
        }

        if (audioBase64) {
          audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
        }
      } catch (streamErr: any) {
        console.warn("Lyria API stream rate limit / error, generating audio composition fallback:", streamErr?.message || streamErr);
        isFallback = true;
        audioDataUrl = generateFallbackAudioWav(prompt, selectedModel === "lyria-3-pro-preview" ? 15 : 10);
      }

      if (!audioDataUrl) {
        audioDataUrl = generateFallbackAudioWav(prompt, 10);
        isFallback = true;
      }

      const trackTitle = title?.trim() || (prompt.length > 30 ? prompt.slice(0, 30).trim() + "..." : prompt);
      const trackGenre = genre || "Electronic";

      const presetCovers: Record<string, string> = {
        Synthwave: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        Cyberpunk: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80",
        Lofi: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
        Ambient: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80",
        Electronic: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
      };

      const db = readDB();
      const newTrack: TrackRecord = {
        id: `ai-track-${Date.now()}`,
        userId: userId || undefined,
        title: trackTitle,
        artist: isFallback ? "VERTEX AI Audio Generator" : "VERTEX AI DJ (Lyria)",
        album: selectedModel === "lyria-3-pro-preview" ? "Lyria Full Track" : "Lyria Clip Preview",
        releaseType: "SINGLE",
        releaseTitle: trackTitle,
        releaseId: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        genre: trackGenre,
        duration: selectedModel === "lyria-3-pro-preview" ? 180 : 30,
        audioUrl: audioDataUrl,
        coverUrl: presetCovers[trackGenre] || presetCovers.Electronic,
        bpm: 120,
        plays: "1",
        createdAt: new Date().toISOString(),
      };

      db.tracks.unshift(newTrack);
      writeDB(db);

      return res.json({
        success: true,
        track: newTrack,
        lyrics,
        isFallback,
        notice: isFallback ? "Lyria API quota was rate-limited. Synthesized procedural music preview generated instead." : undefined,
      });
    } catch (error: any) {
      console.error("Lyria AI Music Generation Error:", error);
      const cleanMsg = parseCleanErrorMessage(error);
      return res.status(500).json({
        error: cleanMsg,
      });
    }
  });

  // Gemini AI Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, userId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message string is required" });
      }

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

      const isGenRequest = /(generate|create|make|compose|produce)\s+(a\s+)?(music|song|track|beat|melody|lofi|synthwave|ambient)/i.test(message);
      let generatedTrack: TrackRecord | undefined = undefined;

      if (isGenRequest) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model: "lyria-3-clip-preview",
            contents: message,
          });

          let audioBase64 = "";
          let mimeType = "audio/wav";

          for await (const chunk of responseStream) {
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (!parts) continue;

            for (const part of parts) {
              if (part.inlineData?.data) {
                if (!audioBase64 && part.inlineData.mimeType) {
                  mimeType = part.inlineData.mimeType;
                }
                audioBase64 += part.inlineData.data;
              }
            }
          }

          if (audioBase64) {
            const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
            const db = readDB();
            generatedTrack = {
              id: `ai-track-${Date.now()}`,
              userId: userId || undefined,
              title: message.length > 28 ? message.slice(0, 28).trim() + "..." : message,
              artist: "VERTEX AI DJ (Lyria)",
              album: "AI Chat Creation",
              releaseType: "SINGLE",
              releaseTitle: message.length > 28 ? message.slice(0, 28).trim() + "..." : message,
              releaseId: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              genre: message.toLowerCase().includes("lofi") ? "Lofi" : message.toLowerCase().includes("synthwave") ? "Synthwave" : "Electronic",
              duration: 30,
              audioUrl: audioDataUrl,
              coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
              bpm: 120,
              plays: "1",
              createdAt: new Date().toISOString(),
            };
            db.tracks.unshift(generatedTrack);
            writeDB(db);
          }
        } catch (genErr) {
          console.warn("Auto Lyria music generation inside chat error, using audio generator fallback:", genErr);
          const audioDataUrl = generateFallbackAudioWav(message, 10);
          const db = readDB();
          generatedTrack = {
            id: `ai-track-${Date.now()}`,
            userId: userId || undefined,
            title: message.length > 28 ? message.slice(0, 28).trim() + "..." : message,
            artist: "VERTEX AI Audio Generator",
            album: "AI Chat Creation",
            releaseType: "SINGLE",
            releaseTitle: message.length > 28 ? message.slice(0, 28).trim() + "..." : message,
            releaseId: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            genre: message.toLowerCase().includes("lofi") ? "Lofi" : message.toLowerCase().includes("synthwave") ? "Synthwave" : "Electronic",
            duration: 30,
            audioUrl: audioDataUrl,
            coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            bpm: 120,
            plays: "1",
            createdAt: new Date().toISOString(),
          };
          db.tracks.unshift(generatedTrack);
          writeDB(db);
        }
      }

      const formattedHistory = Array.isArray(history)
        ? history.map((item: any) => ({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text || item.content || "" }],
          }))
        : [];

      const chat = ai.chats.create({
        model: "gemini-3.6-flash",
        config: {
          systemInstruction:
            "You are VERTEX Music AI, an expert, energetic VERTEX Music AI DJ, Producer, and Music Assistant. " +
            "You give music recommendations, curate playlist ideas, explain musical genres and instruments, " +
            "and assist with generating AI music using Lyria models (`lyria-3-clip-preview` or `lyria-3-pro-preview`). " +
            "Keep responses friendly, engaging, and cleanly formatted with markdown bullet points or bold text. " +
            "When mentioning song titles or artists, bold them clearly.",
        },
        history: formattedHistory,
      });

      const response = await chat.sendMessage({ message });
      let replyText = response.text || "I'm listening, but couldn't generate a text response.";

      if (generatedTrack) {
        replyText += `\n\n✨ **I've composed a custom AI track for you:** **${generatedTrack.title}**! You can play it directly below or save it to your library.`;
      }

      if (userId) {
        try {
          const db = readDB();
          if (!db.chatHistories[userId]) {
            db.chatHistories[userId] = [];
          }
          const userMsg = {
            id: `user-${Date.now()}`,
            sender: "user" as const,
            text: message.trim(),
            timestamp: new Date().toISOString(),
          };
          const aiMsg = {
            id: `ai-${Date.now()}`,
            sender: "ai" as const,
            text: replyText,
            timestamp: new Date().toISOString(),
            matchedTracks: generatedTrack ? [generatedTrack] : undefined,
          };
          db.chatHistories[userId].push(userMsg, aiMsg);
          writeDB(db);
        } catch (dbErr) {
          console.error("Error persisting user chat to DB:", dbErr);
        }
      }

      return res.json({ reply: replyText, generatedTrack });
    } catch (error: any) {
      console.error("Gemini API Chat Error:", error);
      const cleanMsg = parseCleanErrorMessage(error);
      return res.status(500).json({
        error: cleanMsg,
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
