import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
const UPSTASH_DB_KEY = 'app:spotify:db_v1';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string; // Hashed password
  displayName: string;
  avatarUrl: string;
  bio: string;
  favoriteGenres: string[];
  createdAt: string;
  isAdmin?: boolean; // Must be set manually; never settable via public API endpoint.
  isArtist?: boolean;
  artistName?: string;
  artistBio?: string;
  artistVerified?: boolean;
  bannerUrl?: string;
  monthlyListeners?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  artistPickTrackId?: string;
  artistPickComment?: string;
  stats?: {
    hoursListened: number;
    secondsListened?: number;
    tracksPlayed: number;
    topGenre: string;
    playlistsCreated: number;
    followersCount?: number;
    followingCount?: number;
  };
  settings?: {
    losslessAudio?: boolean;
    autoplay?: boolean;
    audioNormalization?: boolean;
    offlineDownloads?: boolean;
  };
}

export interface PlaylistRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  likes?: string;
  tags?: string[];
  createdAt: string;
}

export interface TrackRecord {
  id: string;
  userId?: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl?: string; // Audio file URL or base64 data URL
  duration: number; // in seconds
  genre: string;
  accentColor?: string;
  secondaryColor?: string;
  bpm?: number;
  plays?: string;
  syncedLyrics?: { time: number; text: string }[];
  createdAt?: string;
  releaseType?: string;
  releaseTitle?: string;
  releaseId?: string;
  copyright?: string;
  releaseYear?: number;
  trackNumber?: number;
}

export interface UserStateRecord {
  likedTrackIds: string[];
  recentTrackIds: string[];
}

export interface ChatMessageRecord {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  matchedTracks?: any[];
}

export interface DBData {
  users: UserRecord[];
  playlists: PlaylistRecord[];
  tracks: TrackRecord[];
  userStates: Record<string, UserStateRecord>;
  chatHistories: Record<string, ChatMessageRecord[]>;
}

let cachedDB: DBData | null = null;
let writeQueue: Array<() => void> = [];
let isWriting = false;

let redisClient: Redis | null = null;

export function getUpstashClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    if (!redisClient) {
      redisClient = new Redis({
        url: url.trim(),
        token: token.trim(),
      });
    }
    return redisClient;
  }
  return null;
}

export function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;
  const nextWrite = writeQueue.shift();
  if (nextWrite) {
    try {
      nextWrite();
    } catch (e) {
      console.error('Error executing DB write queue task:', e);
    } finally {
      isWriting = false;
      processWriteQueue();
    }
  }
}

export async function syncUpstashIndices(redis: Redis, data: DBData): Promise<void> {
  try {
    const userIds = (data.users || []).map((u) => u.id).filter(Boolean);
    const trackIds = (data.tracks || []).map((t) => t.id).filter(Boolean);
    const playlistIds = (data.playlists || []).map((p) => p.id).filter(Boolean);

    // Collect all artist IDs and artist names
    const artistUserIds = (data.users || []).filter((u) => u.isArtist).map((u) => u.id);
    const trackArtistNames = Array.from(new Set((data.tracks || []).map((t) => t.artist).filter(Boolean)));
    const allArtistIds = Array.from(new Set([...artistUserIds, ...trackArtistNames]));

    // Store sets & ID lists in Upstash Redis
    await Promise.all([
      redis.set(UPSTASH_DB_KEY, data),
      redis.set('app:users:ids', userIds),
      redis.set('app:songs:ids', trackIds),
      redis.set('app:tracks:ids', trackIds),
      redis.set('app:playlists:ids', playlistIds),
      redis.set('app:artists:ids', allArtistIds),
    ]);

    // Store individual entity keys in Upstash Redis
    const entityPromises: Promise<any>[] = [];

    for (const u of data.users || []) {
      if (u.id) {
        entityPromises.push(redis.set(`app:user:${u.id}`, u));
      }
    }

    for (const t of data.tracks || []) {
      if (t.id) {
        entityPromises.push(redis.set(`app:song:${t.id}`, t));
        entityPromises.push(redis.set(`app:track:${t.id}`, t));
      }
    }

    for (const p of data.playlists || []) {
      if (p.id) {
        entityPromises.push(redis.set(`app:playlist:${p.id}`, p));
      }
    }

    await Promise.all(entityPromises);
  } catch (err) {
    console.error('Failed syncing indices to Upstash Redis:', err);
  }
}

/**
 * Initializes DB by pulling initial dataset from Upstash Redis if available.
 */
export async function initUpstashDB(): Promise<DBData> {
  const redis = getUpstashClient();
  if (redis) {
    try {
      console.log('⚡ Upstash Redis detected! Syncing database from Upstash...');
      const remoteData = await redis.get<DBData>(UPSTASH_DB_KEY);
      if (remoteData && typeof remoteData === 'object') {
        const validated: DBData = {
          users: Array.isArray(remoteData.users) ? remoteData.users : [],
          playlists: Array.isArray(remoteData.playlists) ? remoteData.playlists : [],
          tracks: Array.isArray(remoteData.tracks) ? remoteData.tracks : [],
          userStates: remoteData.userStates && typeof remoteData.userStates === 'object' ? remoteData.userStates : {},
          chatHistories: remoteData.chatHistories && typeof remoteData.chatHistories === 'object' ? remoteData.chatHistories : {},
        };
        cachedDB = validated;
        // Also mirror to local disk as secondary fallback
        saveToLocalDisk(validated);
        await syncUpstashIndices(redis, validated);
        console.log(`✅ Loaded ${validated.users.length} users, ${validated.tracks.length} tracks from Upstash Redis.`);
        return validated;
      } else {
        console.log('ℹ️ Upstash Redis key empty. Seeding Upstash from local disk...');
        const localData = readFromLocalDisk();
        cachedDB = localData;
        await syncUpstashIndices(redis, localData);
        return localData;
      }
    } catch (err) {
      console.error('⚠️ Failed to communicate with Upstash Redis, falling back to local disk:', err);
    }
  }

  const diskData = readFromLocalDisk();
  cachedDB = diskData;
  return diskData;
}

function readFromLocalDisk(): DBData {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const defaultData: DBData = {
        users: [],
        playlists: [],
        tracks: [],
        userStates: {},
        chatHistories: {},
      };
      saveToLocalDisk(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    if (!raw || !raw.trim()) {
      const defaultData: DBData = {
        users: [],
        playlists: [],
        tracks: [],
        userStates: {},
        chatHistories: {},
      };
      saveToLocalDisk(defaultData);
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      playlists: Array.isArray(parsed?.playlists) ? parsed.playlists : [],
      tracks: Array.isArray(parsed?.tracks) ? parsed.tracks : [],
      userStates: parsed?.userStates && typeof parsed.userStates === 'object' ? parsed.userStates : {},
      chatHistories: parsed?.chatHistories && typeof parsed.chatHistories === 'object' ? parsed.chatHistories : {},
    };
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], playlists: [], tracks: [], userStates: {}, chatHistories: {} };
  }
}

function saveToLocalDisk(data: DBData): void {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

export function readDB(): DBData {
  if (cachedDB) {
    return cachedDB;
  }
  const data = readFromLocalDisk();
  cachedDB = data;
  return data;
}

export async function readDBAsync(): Promise<DBData> {
  const redis = getUpstashClient();
  if (redis) {
    try {
      const remoteData = await redis.get<DBData>(UPSTASH_DB_KEY);
      if (remoteData && typeof remoteData === 'object') {
        const validated: DBData = {
          users: Array.isArray(remoteData.users) ? remoteData.users : [],
          playlists: Array.isArray(remoteData.playlists) ? remoteData.playlists : [],
          tracks: Array.isArray(remoteData.tracks) ? remoteData.tracks : [],
          userStates: remoteData.userStates && typeof remoteData.userStates === 'object' ? remoteData.userStates : {},
          chatHistories: remoteData.chatHistories && typeof remoteData.chatHistories === 'object' ? remoteData.chatHistories : {},
        };
        cachedDB = validated;
        saveToLocalDisk(validated);
        return validated;
      }
    } catch (err) {
      console.error('Async Upstash read error:', err);
    }
  }
  return readDB();
}

export function writeDB(data: DBData): void {
  cachedDB = data;
  writeQueue.push(() => {
    saveToLocalDisk(data);

    const redis = getUpstashClient();
    if (redis) {
      syncUpstashIndices(redis, data).catch((err) => {
        console.error('Failed to sync writeDB to Upstash Redis:', err);
      });
    }
  });
  processWriteQueue();
}

export async function writeDBAsync(data: DBData): Promise<void> {
  cachedDB = data;
  saveToLocalDisk(data);

  const redis = getUpstashClient();
  if (redis) {
    try {
      await syncUpstashIndices(redis, data);
    } catch (err) {
      console.error('Failed async writeDB to Upstash Redis:', err);
    }
  }
}

// ==========================================
// SESSION PERSISTENCE (Upstash-backed, in-memory fallback)
// ==========================================
// Sessions are kept in an in-memory Map for fast synchronous lookups on every
// request, but are also mirrored to Upstash Redis (a single hash) so that:
//  - sessions survive server restarts / redeploys / cold starts
//  - sessions are shared across multiple server instances (horizontal scaling,
//    or separate deployments pointed at the same Upstash database)
const SESSIONS_HASH_KEY = 'app:sessions';

/**
 * Loads all persisted sessions from Upstash Redis (if configured) so the
 * in-memory session Map can be hydrated once at server startup.
 * Returns an empty object if Upstash isn't configured or the call fails.
 */
export async function loadSessionsFromRedis(): Promise<Record<string, string>> {
  const redis = getUpstashClient();
  if (!redis) return {};
  try {
    const sessions = await redis.hgetall<Record<string, string>>(SESSIONS_HASH_KEY);
    return sessions && typeof sessions === 'object' ? sessions : {};
  } catch (err) {
    console.error('Failed to load sessions from Upstash Redis:', err);
    return {};
  }
}

/**
 * Fire-and-forget persistence of a single session token -> userId mapping.
 * Does not block the caller; safe to call from a synchronous code path.
 */
export function persistSessionToRedis(token: string, userId: string): void {
  const redis = getUpstashClient();
  if (!redis || !token || !userId) return;
  redis.hset(SESSIONS_HASH_KEY, { [token]: userId }).catch((err) => {
    console.error('Failed to persist session to Upstash Redis:', err);
  });
}

/**
 * Fire-and-forget removal of a session token (e.g. on logout).
 */
export function deleteSessionFromRedis(token: string): void {
  const redis = getUpstashClient();
  if (!redis || !token) return;
  redis.hdel(SESSIONS_HASH_KEY, token).catch((err) => {
    console.error('Failed to delete session from Upstash Redis:', err);
  });
}

