import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';

const UPSTASH_DB_KEY = 'app:spotify:db_v1';
const UPSTASH_DB_BACKUP_KEY = 'app:spotify:db_v1:previous';
const ENCRYPTED_JSON_PREFIX = 'enc:v1';
const DEFAULT_CHAT_RETENTION_DAYS = 30;
const DEFAULT_BACKUP_TTL_SECONDS = 7 * 24 * 60 * 60;

function readBoundedPositiveInteger(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallback;
}

function getChatRetentionMs(): number {
  return readBoundedPositiveInteger('CHAT_RETENTION_DAYS', DEFAULT_CHAT_RETENTION_DAYS, 365) * 24 * 60 * 60 * 1_000;
}

function getBackupTtlSeconds(): number {
  return readBoundedPositiveInteger('DB_BACKUP_TTL_SECONDS', DEFAULT_BACKUP_TTL_SECONDS, 90 * 24 * 60 * 60);
}

function getDataEncryptionKey(): Buffer {
  const configured = process.env.DATA_ENCRYPTION_KEY?.trim() || '';
  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be a 32-byte key encoded as base64 or 64 hexadecimal characters.');
  }
  return key;
}

/** AES-256-GCM envelope used for canonical snapshots, backups, and user entities. */
export function encryptPersistedJson(value: unknown, purpose: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDataEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(`vertex:${purpose}:v1`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_JSON_PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptPersistedJson<T>(envelope: string, purpose: string): T {
  const parts = envelope.split(':');
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== ENCRYPTED_JSON_PREFIX) {
    throw new Error('Encrypted Redis payload has an unsupported format.');
  }
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Encrypted Redis payload is malformed.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getDataEncryptionKey(), iv);
  decipher.setAAD(Buffer.from(`vertex:${purpose}:v1`, 'utf8'));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}

type StoredDatabase = {
  data: DBData;
  encrypted: boolean;
  sanitizedChanged: boolean;
};

function decodeStoredDatabase(value: unknown): StoredDatabase | null {
  if (typeof value === 'string') {
    const decrypted = decryptPersistedJson<Partial<DBData>>(value, 'canonical-db');
    const data = sanitizeDBData(decrypted);
    return { data, encrypted: true, sanitizedChanged: JSON.stringify(decrypted) !== JSON.stringify(data) };
  }
  if (value && typeof value === 'object') {
    const data = sanitizeDBData(value as Partial<DBData>);
    return { data, encrypted: false, sanitizedChanged: JSON.stringify(value) !== JSON.stringify(data) };
  }
  return null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string; // Hashed password
  googleId?: string; // Google account subject id, set for accounts linked/created via "Sign in with Google"
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
}

export interface PlaylistRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  trackCount: number;
  createdAt: string;
}

export interface TrackRecord {
  id: string;
  userId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string; // Real playable audio file URL
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
  followedArtistIds: string[];
}

export type ChatReasoningTimelineEntry =
  | { type: 'reasoning'; text: string }
  | { type: 'tool'; tool: 'web_search'; query: string; resultCount: number };

export interface ChatMessageRecord {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  matchedTracks?: any[];
  isError?: boolean;
  webSearchUsed?: boolean;
  searchProvider?: 'tavily';
  reasoningEffort?: 'medium' | 'high';
  searchQueries?: string[];
  sources?: { title: string; uri: string }[];
  reasoning?: string;
  reasoningTimeline?: ChatReasoningTimelineEntry[];
  thinkingSeconds?: number;
}

export interface DBData {
  users: UserRecord[];
  playlists: PlaylistRecord[];
  tracks: TrackRecord[];
  userStates: Record<string, UserStateRecord>;
  chatHistories: Record<string, ChatMessageRecord[]>;
}

function emptyUserState(): UserStateRecord {
  return { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [] };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPersistedMediaUrl(value: string, expected: 'audio' | 'image'): boolean {
  if (value.startsWith('/api/r2-file/') || isHttpUrl(value)) return true;
  // The built-in placeholder avatar is an inline SVG. User-uploaded base64
  // audio and images must be converted to R2 objects before database writes.
  return expected === 'image' && /^data:image\/svg\+xml(?:;|,)/i.test(value);
}

function normalizedIsoDate(value: unknown): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : new Date(0).toISOString();
}

function normalizeCopyright(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const fallbackMatch = fallback.trim().match(/^(\d{4})(?:\s+(.*))?$/);
  const year = fallbackMatch?.[1] || String(new Date().getFullYear());
  const fallbackOwner = fallbackMatch?.[2]?.trim() || '';
  const owner = raw.replace(/^(?:©|\(c\))\s*/i, '').replace(/^\d{4}\b\s*/, '').trim() || fallbackOwner;
  return `© ${year}${owner ? ` ${owner}` : ''}`.slice(0, 300).trimEnd();
}

/**
 * Removes legacy/orphaned entities before they can reach the API.
 * A playable track or playlist must always belong to a real registered user.
 * Tracks without a valid audio source are metadata-only records and are discarded.
 */
export function sanitizeDBData(input: Partial<DBData> | null | undefined): DBData {
  const rawUsers = Array.isArray(input?.users) ? input!.users : [];
  const usedUserIds = new Set<string>();
  const usedUsernames = new Set<string>();
  const usedEmails = new Set<string>();
  const users: UserRecord[] = [];
  for (const rawUser of rawUsers) {
    if (!rawUser || typeof rawUser !== 'object') continue;
    const id = typeof rawUser.id === 'string' ? rawUser.id.trim() : '';
    const username = typeof rawUser.username === 'string' ? rawUser.username.trim() : '';
    const email = typeof rawUser.email === 'string' ? rawUser.email.trim().toLowerCase() : '';
    const password = typeof rawUser.password === 'string' ? rawUser.password : '';
    const usernameKey = username.toLowerCase();
    // Registration applies today's strict username/email rules. Persisted
    // accounts must be read more conservatively: older real accounts may
    // predate those rules, and dropping one here also drops every track that
    // references it. Only reject structurally unusable or duplicate records.
    if (
      !id || usedUserIds.has(id) ||
      !username || usedUsernames.has(usernameKey) ||
      !email || usedEmails.has(email) ||
      !password
    ) continue;

    usedUserIds.add(id);
    usedUsernames.add(usernameKey);
    usedEmails.add(email);
    const googleId = typeof rawUser.googleId === 'string' && rawUser.googleId.trim()
      ? rawUser.googleId.trim().slice(0, 255)
      : undefined;
    const displayName = typeof rawUser.displayName === 'string' && rawUser.displayName.trim()
      ? rawUser.displayName.trim().slice(0, 80)
      : username;
    const avatarUrl = typeof rawUser.avatarUrl === 'string' && isPersistedMediaUrl(rawUser.avatarUrl.trim(), 'image')
      ? rawUser.avatarUrl.trim()
      : '';
    const bannerUrl = typeof rawUser.bannerUrl === 'string' && rawUser.bannerUrl.trim() && isPersistedMediaUrl(rawUser.bannerUrl.trim(), 'image')
      ? rawUser.bannerUrl.trim()
      : undefined;
    const cleanOptionalHttpUrl = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() && isHttpUrl(value.trim()) ? value.trim().slice(0, 2_000) : undefined;

    users.push({
      id,
      username,
      email,
      password,
      googleId,
      displayName,
      avatarUrl,
      bio: typeof rawUser.bio === 'string' ? rawUser.bio.trim().slice(0, 500) : '',
      favoriteGenres: Array.isArray(rawUser.favoriteGenres)
        ? Array.from(new Set(rawUser.favoriteGenres.filter((genre): genre is string => typeof genre === 'string' && Boolean(genre.trim())).map((genre) => genre.trim()).filter((genre) => genre.length <= 80))).slice(0, 20)
        : [],
      createdAt: normalizedIsoDate(rawUser.createdAt),
      isAdmin: rawUser.isAdmin === true,
      isArtist: rawUser.isArtist === true,
      artistName: typeof rawUser.artistName === 'string' && rawUser.artistName.trim() ? rawUser.artistName.trim().slice(0, 80) : undefined,
      artistBio: typeof rawUser.artistBio === 'string' ? rawUser.artistBio.trim().slice(0, 2_000) : undefined,
      artistVerified: rawUser.artistVerified === true,
      bannerUrl,
      instagramUrl: cleanOptionalHttpUrl(rawUser.instagramUrl),
      twitterUrl: cleanOptionalHttpUrl(rawUser.twitterUrl),
      websiteUrl: cleanOptionalHttpUrl(rawUser.websiteUrl),
      artistPickTrackId: typeof rawUser.artistPickTrackId === 'string' && rawUser.artistPickTrackId.trim() ? rawUser.artistPickTrackId.trim() : undefined,
      artistPickComment: typeof rawUser.artistPickComment === 'string' ? rawUser.artistPickComment.trim().slice(0, 500) : undefined,
      stats: rawUser.stats,
    });
  }

  const userById = new Map(users.map((user) => [user.id, user]));
  const rawTracks = Array.isArray(input?.tracks) ? input!.tracks : [];
  const usedTrackIds = new Set<string>();
  const tracks: TrackRecord[] = [];
  for (const rawTrack of rawTracks) {
    if (!rawTrack || typeof rawTrack !== 'object') continue;
    const id = typeof rawTrack.id === 'string' ? rawTrack.id.trim() : '';
    const owner = typeof rawTrack.userId === 'string' ? userById.get(rawTrack.userId) : undefined;
    const title = typeof rawTrack.title === 'string' ? rawTrack.title.trim() : '';
    const audioUrl = typeof rawTrack.audioUrl === 'string' ? rawTrack.audioUrl.trim() : '';
    const duration = Number(rawTrack.duration);
    if (
      !id || usedTrackIds.has(id) || !owner ||
      !title || title.length > 160 ||
      !audioUrl || !isPersistedMediaUrl(audioUrl, 'audio') ||
      !Number.isFinite(duration) || duration <= 0 || duration > 86_400
    ) continue;

    usedTrackIds.add(id);
    const canonicalArtistName = (owner.artistName || owner.displayName || owner.username).trim();
    const album = typeof rawTrack.album === 'string' && rawTrack.album.trim()
      ? rawTrack.album.trim().slice(0, 160)
      : 'Single';
    const rawReleaseType = typeof rawTrack.releaseType === 'string' ? rawTrack.releaseType.trim().toUpperCase() : '';
    const releaseType = ['SINGLE', 'EP', 'ALBUM'].includes(rawReleaseType)
      ? rawReleaseType
      : album === 'Single' ? 'SINGLE' : 'ALBUM';
    const releaseTitle = typeof rawTrack.releaseTitle === 'string' && rawTrack.releaseTitle.trim()
      ? rawTrack.releaseTitle.trim().slice(0, 160)
      : album === 'Single' ? title : album;
    const releaseYear = Number(rawTrack.releaseYear);
    const currentYear = new Date().getFullYear();
    const cleanReleaseYear = Number.isInteger(releaseYear) && releaseYear >= 1850 && releaseYear <= currentYear + 1
      ? releaseYear
      : undefined;
    const createdYear = typeof rawTrack.createdAt === 'string' && !Number.isNaN(Date.parse(rawTrack.createdAt))
      ? new Date(rawTrack.createdAt).getUTCFullYear()
      : currentYear;
    const trackNumber = Number(rawTrack.trackNumber);
    const coverCandidate = typeof rawTrack.coverUrl === 'string' ? rawTrack.coverUrl.trim() : '';
    const coverUrl = coverCandidate && isPersistedMediaUrl(coverCandidate, 'image')
      ? coverCandidate
      : owner.avatarUrl;
    const plays = Number.parseInt(String(rawTrack.plays || '0'), 10);

    tracks.push({
      id,
      userId: owner.id,
      title,
      artist: canonicalArtistName,
      album,
      coverUrl,
      audioUrl,
      duration,
      genre: typeof rawTrack.genre === 'string' ? rawTrack.genre.trim().slice(0, 80) : '',
      plays: String(Number.isFinite(plays) && plays >= 0 ? plays : 0),
      syncedLyrics: Array.isArray(rawTrack.syncedLyrics)
        ? rawTrack.syncedLyrics
            .filter((line): line is { time: number; text: string } => Boolean(line && Number.isFinite(Number(line.time)) && Number(line.time) >= 0 && Number(line.time) <= duration + 1 && typeof line.text === 'string' && line.text.trim()))
            .map((line) => ({ time: Number(line.time), text: line.text.trim().slice(0, 2_000) }))
            .slice(0, 5_000)
        : [],
      createdAt: normalizedIsoDate(rawTrack.createdAt),
      releaseType,
      releaseTitle,
      releaseId: typeof rawTrack.releaseId === 'string' && rawTrack.releaseId.trim() ? rawTrack.releaseId.trim().slice(0, 200) : undefined,
      copyright: normalizeCopyright(rawTrack.copyright, `${cleanReleaseYear || createdYear} ${canonicalArtistName}`),
      releaseYear: cleanReleaseYear,
      trackNumber: Number.isInteger(trackNumber) && trackNumber >= 1 && trackNumber <= 999 ? trackNumber : undefined,
    });
  }

  const trackIds = new Set(tracks.map((track) => track.id));
  const rawPlaylists = Array.isArray(input?.playlists) ? input!.playlists : [];
  const usedPlaylistIds = new Set<string>();
  const playlists = rawPlaylists
    .filter((playlist): playlist is PlaylistRecord => {
      const id = playlist && typeof playlist.id === 'string' ? playlist.id.trim() : '';
      const valid = Boolean(
        playlist && id && !usedPlaylistIds.has(id) &&
        typeof playlist.userId === 'string' && userById.has(playlist.userId) &&
        typeof playlist.title === 'string' && playlist.title.trim() && playlist.title.trim().length <= 120
      );
      if (valid) usedPlaylistIds.add(id);
      return valid;
    })
    .map((playlist) => {
      const validPlaylistTrackIds = Array.isArray(playlist.trackIds)
        ? Array.from(new Set(playlist.trackIds.filter((id) => typeof id === 'string' && trackIds.has(id))))
        : [];
      const coverCandidate = typeof playlist.coverUrl === 'string' ? playlist.coverUrl.trim() : '';
      const owner = userById.get(playlist.userId)!;
      return {
        id: playlist.id.trim(),
        userId: playlist.userId,
        title: playlist.title.trim(),
        description: typeof playlist.description === 'string' ? playlist.description.trim().slice(0, 1_000) : '',
        coverUrl: coverCandidate && isPersistedMediaUrl(coverCandidate, 'image') ? coverCandidate : owner.avatarUrl,
        trackIds: validPlaylistTrackIds,
        trackCount: validPlaylistTrackIds.length,
        createdAt: normalizedIsoDate(playlist.createdAt),
      };
    });

  const realArtistIds = new Set(
    users
      .filter((user) => user.isArtist || tracks.some((track) => track.userId === user.id))
      .map((user) => user.id)
  );
  const rawStates = input?.userStates && typeof input.userStates === 'object' ? input.userStates : {};
  const userStates: Record<string, UserStateRecord> = {};
  for (const user of users) {
    const raw = rawStates[user.id] || emptyUserState();
    userStates[user.id] = {
      likedTrackIds: Array.isArray(raw.likedTrackIds)
        ? Array.from(new Set(raw.likedTrackIds.filter((id) => typeof id === 'string' && trackIds.has(id))))
        : [],
      recentTrackIds: Array.isArray(raw.recentTrackIds)
        ? Array.from(new Set(raw.recentTrackIds.filter((id) => typeof id === 'string' && trackIds.has(id))))
        : [],
      followedArtistIds: Array.isArray((raw as UserStateRecord).followedArtistIds)
        ? Array.from(new Set((raw as UserStateRecord).followedArtistIds.filter(
            (id) => typeof id === 'string' && id !== user.id && realArtistIds.has(id)
          )))
        : [],
    };
  }

  // Recompute relationship and ownership-derived counters from authoritative data.
  // Persisted relationship counters from older versions are not trusted.
  for (const user of users) {
    const followedArtistIds = userStates[user.id]?.followedArtistIds || [];
    const followersCount = users.reduce(
      (count, candidate) => count + (userStates[candidate.id]?.followedArtistIds.includes(user.id) ? 1 : 0),
      0
    );
    const ownedTracks = tracks.filter((track) => track.userId === user.id);
    const artistPickTrackId = user.artistPickTrackId && ownedTracks.some((track) => track.id === user.artistPickTrackId)
      ? user.artistPickTrackId
      : undefined;

    user.artistPickTrackId = artistPickTrackId;
    if (!artistPickTrackId) user.artistPickComment = undefined;
    const secondsListened = Math.max(0, Number(user.stats?.secondsListened) || 0);
    const recentGenreCounts = new Map<string, number>();
    for (const recentTrackId of userStates[user.id]?.recentTrackIds || []) {
      const recentTrack = tracks.find((track) => track.id === recentTrackId);
      const genre = recentTrack?.genre?.trim();
      if (genre) recentGenreCounts.set(genre, (recentGenreCounts.get(genre) || 0) + 1);
    }
    const topGenre = [...recentGenreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    user.stats = {
      hoursListened: secondsListened / 3600,
      secondsListened,
      tracksPlayed: Math.max(0, Math.floor(Number(user.stats?.tracksPlayed) || 0)),
      topGenre,
      playlistsCreated: playlists.filter((playlist) => playlist.userId === user.id).length,
      followersCount,
      followingCount: followedArtistIds.length,
    };
  }

  const rawHistories = input?.chatHistories && typeof input.chatHistories === 'object' ? input.chatHistories : {};
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const chatHistories: Record<string, ChatMessageRecord[]> = {};
  const chatRetentionCutoff = Date.now() - getChatRetentionMs();
  for (const user of users) {
    const history = Array.isArray(rawHistories[user.id]) ? rawHistories[user.id] : [];
    chatHistories[user.id] = history.filter((message): message is ChatMessageRecord =>
      Boolean(
        message &&
        typeof message.id === 'string' && message.id.trim() &&
        (message.sender === 'user' || message.sender === 'ai') &&
        typeof message.text === 'string' && message.text.trim() &&
        typeof message.timestamp === 'string' &&
        !Number.isNaN(Date.parse(message.timestamp)) &&
        Date.parse(message.timestamp) >= chatRetentionCutoff
      )
    ).slice(-200).map((message) => ({
      id: message.id.trim(),
      sender: message.sender,
      text: message.text.trim().slice(0, 20_000),
      timestamp: new Date(message.timestamp).toISOString(),
      matchedTracks: Array.isArray(message.matchedTracks)
        ? message.matchedTracks
            .map((track: any) => typeof track === 'string' ? track : track?.id)
            .filter((trackId: unknown): trackId is string => typeof trackId === 'string' && trackById.has(trackId))
            .slice(0, 20)
            .map((trackId) => trackById.get(trackId)!)
        : undefined,
      webSearchUsed: message.webSearchUsed === true,
      isError: message.isError === true ? true : undefined,
      searchProvider: message.searchProvider === 'tavily' ? 'tavily' : undefined,
      reasoningEffort: message.reasoningEffort === 'high' ? 'high' : message.reasoningEffort === 'medium' ? 'medium' : undefined,
      searchQueries: Array.isArray(message.searchQueries)
        ? message.searchQueries.filter((query): query is string => typeof query === 'string' && Boolean(query.trim())).map((query) => query.trim().slice(0, 500)).slice(0, 10)
        : undefined,
      sources: Array.isArray(message.sources)
        ? message.sources
            .filter((source): source is { title: string; uri: string } => Boolean(source && typeof source.title === 'string' && source.title.trim() && typeof source.uri === 'string' && isHttpUrl(source.uri)))
            .map((source) => ({ title: source.title.trim().slice(0, 500), uri: source.uri.trim().slice(0, 2_000) }))
            .slice(0, 10)
        : undefined,
      reasoning: typeof message.reasoning === 'string' && message.reasoning.trim()
        ? message.reasoning.trim().slice(0, 12_000)
        : undefined,
      reasoningTimeline: Array.isArray(message.reasoningTimeline)
        ? message.reasoningTimeline.slice(0, 24).flatMap<ChatReasoningTimelineEntry>((entry) => {
            if (entry?.type === 'reasoning' && typeof entry.text === 'string') {
              const text = entry.text.trim().slice(0, 2_000);
              return text ? [{ type: 'reasoning' as const, text }] : [];
            }
            if (entry?.type === 'tool' && entry.tool === 'web_search' && typeof entry.query === 'string') {
              const query = entry.query.trim().slice(0, 2_000);
              if (!query) return [];
              const resultCount = Number.isFinite(entry.resultCount)
                ? Math.max(0, Math.min(1_000, Math.round(entry.resultCount)))
                : 0;
              return [{ type: 'tool' as const, tool: 'web_search' as const, query, resultCount }];
            }
            return [];
          })
        : undefined,
      thinkingSeconds: Number.isFinite(message.thinkingSeconds)
        ? Math.max(1, Math.min(600, Math.round(message.thinkingSeconds!)))
        : undefined,
    }));
  }

  return { users, playlists, tracks, userStates, chatHistories };
}

let cachedDB: DBData | null = null;
let writeChain: Promise<void> = Promise.resolve();
let cachedDBFetchedAt = 0;
let lastPersistedJson = '';
let lastCanonicalBackupAt = 0;

function getRemoteCacheTtlMs(): number {
  const configured = Number(process.env.UPSTASH_DB_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : 5_000;
}

let redisClient: Redis | null = null;

export function getUpstashClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url?.trim() || !token?.trim()) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.');
  }
  if (!redisClient) {
    redisClient = new Redis({
      url: url.trim(),
      token: token.trim(),
    });
  }
  return redisClient;
}

export function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function enforceBackupRetentionAndEncryption(redis: Redis): Promise<void> {
  const storedBackup = await redis.get<unknown>(UPSTASH_DB_BACKUP_KEY);
  if (storedBackup === null || storedBackup === undefined) return;

  const backupTtlSeconds = getBackupTtlSeconds();
  if (storedBackup && typeof storedBackup === 'object') {
    const sanitized = sanitizeDBData(storedBackup as Partial<DBData>);
    await redis.set(UPSTASH_DB_BACKUP_KEY, encryptPersistedJson(sanitized, 'backup-db'), { ex: backupTtlSeconds });
    return;
  }

  if (typeof storedBackup === 'string' && storedBackup.startsWith(`${ENCRYPTED_JSON_PREFIX}:`)) {
    try {
      const decrypted = decryptPersistedJson<Partial<DBData>>(storedBackup, 'backup-db');
      const sanitized = sanitizeDBData(decrypted);
      if (JSON.stringify(decrypted) !== JSON.stringify(sanitized)) {
        await redis.set(UPSTASH_DB_BACKUP_KEY, encryptPersistedJson(sanitized, 'backup-db'), { ex: backupTtlSeconds });
        return;
      }
      const currentTtl = await redis.ttl(UPSTASH_DB_BACKUP_KEY);
      if (!Number.isFinite(currentTtl) || currentTtl < 0 || currentTtl > backupTtlSeconds) {
        await redis.expire(UPSTASH_DB_BACKUP_KEY, backupTtlSeconds);
      }
      return;
    } catch {
      // A backup is never authoritative. Delete an unreadable payload instead
      // of retaining unknown/plaintext data indefinitely.
    }
  }

  await redis.del(UPSTASH_DB_BACKUP_KEY);
}

/** Privacy deletion must also remove recovery copies containing old values. */
export async function deleteDatabaseBackupFromRedis(): Promise<void> {
  await getUpstashClient().del(UPSTASH_DB_BACKUP_KEY);
  lastCanonicalBackupAt = Date.now();
}

async function enforceUserEntityEncryption(redis: Redis, data: DBData): Promise<void> {
  const currentUserIds = data.users.map((user) => user.id);
  const indexedUserIds = await redis.get<string[]>('app:users:ids');
  const staleUserIds = Array.isArray(indexedUserIds)
    ? indexedUserIds.filter((id) => typeof id === 'string' && !currentUserIds.includes(id))
    : [];
  if (staleUserIds.length > 0) {
    await redis.del(...staleUserIds.map((id) => `app:user:${id}`));
  }
  if (!Array.isArray(indexedUserIds) || JSON.stringify(indexedUserIds) !== JSON.stringify(currentUserIds)) {
    await redis.set('app:users:ids', currentUserIds);
  }

  // Small batches avoid a startup request burst for installations with many
  // accounts while still repairing a partial prior migration.
  for (let offset = 0; offset < data.users.length; offset += 25) {
    await Promise.all(data.users.slice(offset, offset + 25).map(async (user) => {
      const key = `app:user:${user.id}`;
      const stored = await redis.get<unknown>(key);
      if (typeof stored === 'string' && stored.startsWith(`${ENCRYPTED_JSON_PREFIX}:`)) {
        try {
          const decrypted = decryptPersistedJson<UserRecord>(stored, `user:${user.id}`);
          if (JSON.stringify(decrypted) === JSON.stringify(user)) return;
        } catch {
          // Replace malformed, wrong-context, or old-key ciphertext below.
        }
      }
      await redis.set(key, encryptPersistedJson(user, `user:${user.id}`));
    }));
  }
}

export async function syncUpstashIndices(redis: Redis, data: DBData): Promise<void> {
  try {
    data = sanitizeDBData(data);
    const userIds = (data.users || []).map((u) => u.id).filter(Boolean);
    const trackIds = (data.tracks || []).map((t) => t.id).filter(Boolean);
    const playlistIds = (data.playlists || []).map((p) => p.id).filter(Boolean);

    // Artists are real registered user IDs only; track metadata must never create artist identities.
    const allArtistIds = (data.users || [])
      .filter((u) => u.isArtist || data.tracks.some((track) => track.userId === u.id))
      .map((u) => u.id);

    // Compare against the previous canonical snapshot so routine mutations do
    // not rewrite every entity and every index. This is especially important
    // for listening-time updates, which only change one user record.
    const previousCanonical = await redis.get<unknown>(UPSTASH_DB_KEY);
    const decodedPrevious = decodeStoredDatabase(previousCanonical);
    const previous = decodedPrevious?.data || null;
    const previousWasEncrypted = decodedPrevious?.encrypted === true;
    const nextCanonicalJson = JSON.stringify(data);
    if (previousWasEncrypted && !decodedPrevious?.sanitizedChanged && previous && JSON.stringify(previous) === nextCanonicalJson) {
      await enforceUserEntityEncryption(redis, data);
      return;
    }

    const previousUserIds = (previous?.users || []).map((item) => item.id);
    const previousTrackIds = (previous?.tracks || []).map((item) => item.id);
    const previousPlaylistIds = (previous?.playlists || []).map((item) => item.id);
    const previousArtistIds = (previous?.users || [])
      .filter((user) => user.isArtist || previous?.tracks.some((track) => track.userId === user.id))
      .map((user) => user.id);
    const indexPromises: Promise<any>[] = [
      redis.set(UPSTASH_DB_KEY, encryptPersistedJson(data, 'canonical-db')),
    ];
    const changed = (before: string[], after: string[]) => JSON.stringify(before) !== JSON.stringify(after);
    const structureChanged = !previous
      || changed(previousUserIds, userIds)
      || changed(previousTrackIds, trackIds)
      || changed(previousPlaylistIds, playlistIds);
    // Keep recovery snapshots, but do not rewrite a full duplicate database
    // for every play counter, chat message, or listening-time tick.
    if (
      previous &&
      (structureChanged || Date.now() - lastCanonicalBackupAt >= 15 * 60_000)
    ) {
      await redis.set(
        UPSTASH_DB_BACKUP_KEY,
        encryptPersistedJson(previous, 'backup-db'),
        { ex: getBackupTtlSeconds() },
      );
      lastCanonicalBackupAt = Date.now();
    }
    if (!previous || changed(previousUserIds, userIds)) indexPromises.push(redis.set('app:users:ids', userIds));
    if (!previous || changed(previousTrackIds, trackIds)) {
      indexPromises.push(redis.set('app:songs:ids', trackIds), redis.set('app:tracks:ids', trackIds));
    }
    if (!previous || changed(previousPlaylistIds, playlistIds)) indexPromises.push(redis.set('app:playlists:ids', playlistIds));
    if (!previous || changed(previousArtistIds, allArtistIds)) indexPromises.push(redis.set('app:artists:ids', allArtistIds));
    await Promise.all(indexPromises);

    // Store only new or changed entity keys in Upstash Redis.
    const entityPromises: Promise<any>[] = [];
    const previousUsers = new Map((previous?.users || []).map((item) => [item.id, JSON.stringify(item)]));
    const previousTracks = new Map((previous?.tracks || []).map((item) => [item.id, JSON.stringify(item)]));
    const previousPlaylists = new Map((previous?.playlists || []).map((item) => [item.id, JSON.stringify(item)]));

    for (const u of data.users || []) {
      if (u.id && (!previousWasEncrypted || previousUsers.get(u.id) !== JSON.stringify(u))) {
        entityPromises.push(redis.set(`app:user:${u.id}`, encryptPersistedJson(u, `user:${u.id}`)));
      }
    }

    for (const t of data.tracks || []) {
      if (t.id && previousTracks.get(t.id) !== JSON.stringify(t)) {
        entityPromises.push(redis.set(`app:song:${t.id}`, t));
        entityPromises.push(redis.set(`app:track:${t.id}`, t));
      }
    }

    for (const p of data.playlists || []) {
      if (p.id && previousPlaylists.get(p.id) !== JSON.stringify(p)) {
        entityPromises.push(redis.set(`app:playlist:${p.id}`, p));
      }
    }

    await Promise.all(entityPromises);

    // Derive stale keys from the previous canonical snapshot. Four wildcard
    // KEYS scans on every write were both costly and unnecessary.
    const nextUserIdSet = new Set(userIds);
    const nextTrackIdSet = new Set(trackIds);
    const nextPlaylistIdSet = new Set(playlistIds);
    const staleEntityKeys = [
      ...previousUserIds.filter((id) => !nextUserIdSet.has(id)).map((id) => `app:user:${id}`),
      ...previousTrackIds.filter((id) => !nextTrackIdSet.has(id)).flatMap((id) => [`app:song:${id}`, `app:track:${id}`]),
      ...previousPlaylistIds.filter((id) => !nextPlaylistIdSet.has(id)).map((id) => `app:playlist:${id}`),
    ];
    if (staleEntityKeys.length > 0) {
      await redis.del(...staleEntityKeys);
    }
  } catch (err) {
    console.error('Failed syncing indices to Upstash Redis:', err);
    throw err;
  }
}

/**
 * Initializes the canonical database exclusively from Upstash Redis.
 */
export async function initUpstashDB(): Promise<DBData> {
  const redis = getUpstashClient();
  console.log('⚡ Loading canonical database from Upstash Redis...');
  const remoteData = await redis.get<unknown>(UPSTASH_DB_KEY);
  const decoded = decodeStoredDatabase(remoteData);
  const data = decoded?.data || sanitizeDBData({});

  if (!decoded) {
    console.log('ℹ️ Upstash database is empty. Initializing a new canonical database in Redis...');
    await syncUpstashIndices(redis, data);
  } else if (!decoded.encrypted || decoded.sanitizedChanged) {
    console.log('🔐 Migrating canonical Redis data to encrypted, retention-limited storage...');
    await syncUpstashIndices(redis, data);
  }
  await enforceUserEntityEncryption(redis, data);
  await enforceBackupRetentionAndEncryption(redis);

  cachedDB = data;
  cachedDBFetchedAt = Date.now();
  lastPersistedJson = JSON.stringify(data);
  console.log(`✅ Loaded ${data.users.length} users and ${data.tracks.length} tracks from Upstash Redis.`);
  return data;
}

export async function readDBAsync(forceRemote = false): Promise<DBData> {
  await writeChain.catch(() => undefined);
  const redis = getUpstashClient();
  if (!forceRemote && cachedDB && Date.now() - cachedDBFetchedAt < getRemoteCacheTtlMs()) {
    const retentionSanitized = sanitizeDBData(cachedDB);
    if (JSON.stringify(retentionSanitized) !== JSON.stringify(cachedDB)) {
      await enqueueDatabaseWrite(retentionSanitized);
    }
    return retentionSanitized;
  }

  const remoteData = await redis.get<unknown>(UPSTASH_DB_KEY);
  const decoded = decodeStoredDatabase(remoteData);
  if (!decoded) {
    cachedDB = null;
    cachedDBFetchedAt = 0;
    throw new Error('Canonical Upstash database is missing or invalid.');
  }

  const validated = decoded.data;
  if (!decoded.encrypted || decoded.sanitizedChanged) {
    await syncUpstashIndices(redis, validated);
  }
  cachedDB = validated;
  cachedDBFetchedAt = Date.now();
  lastPersistedJson = JSON.stringify(validated);
  return validated;
}

function enqueueDatabaseWrite(input: DBData): Promise<void> {
  const data = sanitizeDBData(input);
  const serialized = JSON.stringify(data);
  if (serialized === lastPersistedJson) return writeChain;
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const redis = getUpstashClient();
      await syncUpstashIndices(redis, data);
      cachedDB = data;
      cachedDBFetchedAt = Date.now();
      lastPersistedJson = serialized;
    })
    .catch((error) => {
      cachedDB = null;
      cachedDBFetchedAt = 0;
      console.error('Failed to persist database write:', error);
      throw error;
    });
  return writeChain;
}

export async function writeDBAsync(data: DBData): Promise<void> {
  await enqueueDatabaseWrite(data);
}

// ==========================================
// SESSION PERSISTENCE (Upstash required)
// ==========================================
// Every session has its own expiring Redis key. Only a SHA-256 digest of the
// browser token is used in Redis keys and indices; the bearer secret itself is
// never persisted server-side.
const LEGACY_SESSIONS_HASH_KEY = 'app:sessions';
const SESSION_KEY_PREFIX = 'app:session:';
const USER_SESSIONS_KEY_PREFIX = 'app:user-sessions:';
const USER_SESSION_VERSION_KEY_PREFIX = 'app:user-session-version:';

export interface SessionRecord {
  userId: string;
  createdAt: number;
  absoluteExpiresAt: number;
  sessionVersion: number;
}

function sessionKey(tokenDigest: string): string {
  return `${SESSION_KEY_PREFIX}${tokenDigest}`;
}

function userSessionsKey(userId: string): string {
  return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
}

function userSessionVersionKey(userId: string): string {
  return `${USER_SESSION_VERSION_KEY_PREFIX}${userId}`;
}

export async function getUserSessionVersionFromRedis(userId: string): Promise<number> {
  const version = await getUpstashClient().get<number>(userSessionVersionKey(userId));
  return Number.isSafeInteger(version) && Number(version) >= 0 ? Number(version) : 0;
}

/** Remove the old non-expiring hash, whose fields contained raw bearer tokens. */
export async function purgeLegacySessionsFromRedis(): Promise<void> {
  await getUpstashClient().del(LEGACY_SESSIONS_HASH_KEY);
}

export async function persistSessionToRedis(
  tokenDigest: string,
  record: SessionRecord,
  idleTtlSeconds: number,
): Promise<void> {
  if (!tokenDigest || !record.userId) throw new Error('A session digest and user ID are required.');
  const redis = getUpstashClient();
  const absoluteTtlSeconds = Math.max(1, Math.ceil((record.absoluteExpiresAt - Date.now()) / 1_000));
  const keyTtlSeconds = Math.max(1, Math.min(idleTtlSeconds, absoluteTtlSeconds));

  await redis.set(sessionKey(tokenDigest), record, { ex: keyTtlSeconds });
  await redis.sadd(userSessionsKey(record.userId), tokenDigest);
  // The index contains no bearer secrets. Its TTL is extended so it covers
  // every session that can still be alive for this user.
  await redis.expire(userSessionsKey(record.userId), absoluteTtlSeconds);
}

export async function readAndTouchSessionFromRedis(
  tokenDigest: string,
  idleTtlSeconds: number,
): Promise<SessionRecord | null> {
  if (!tokenDigest) return null;
  const redis = getUpstashClient();
  const key = sessionKey(tokenDigest);
  const record = await redis.get<SessionRecord>(key);

  if (
    !record ||
    typeof record.userId !== 'string' ||
    !Number.isFinite(record.createdAt) ||
    !Number.isFinite(record.absoluteExpiresAt) ||
    !Number.isSafeInteger(record.sessionVersion)
  ) {
    return null;
  }
  const currentSessionVersion = await getUserSessionVersionFromRedis(record.userId);
  if (record.sessionVersion !== currentSessionVersion) {
    await redis.del(key);
    await redis.srem(userSessionsKey(record.userId), tokenDigest);
    return null;
  }

  const absoluteTtlSeconds = Math.ceil((record.absoluteExpiresAt - Date.now()) / 1_000);
  if (absoluteTtlSeconds <= 0) {
    await redis.del(key);
    await redis.srem(userSessionsKey(record.userId), tokenDigest);
    return null;
  }

  // Redis key expiry is the idle timeout. Touching it on an authenticated
  // request can never extend the session beyond its absolute expiration.
  await redis.expire(key, Math.max(1, Math.min(idleTtlSeconds, absoluteTtlSeconds)));
  return record;
}

export async function deleteSessionFromRedis(tokenDigest: string, userId?: string): Promise<void> {
  if (!tokenDigest) return;
  const redis = getUpstashClient();
  await redis.del(sessionKey(tokenDigest));
  if (userId) await redis.srem(userSessionsKey(userId), tokenDigest);
}

export async function deleteAllUserSessionsFromRedis(userId: string): Promise<void> {
  if (!userId) return;
  const redis = getUpstashClient();
  // Incrementing the generation invalidates every existing session
  // immediately, even if an index cleanup is interrupted or another server
  // has already read an older session record.
  await redis.incr(userSessionVersionKey(userId));
  try {
    const indexKey = userSessionsKey(userId);
    const tokenDigests = await redis.smembers<string[]>(indexKey);
    if (Array.isArray(tokenDigests) && tokenDigests.length > 0) {
      await redis.del(...tokenDigests.map(sessionKey));
    }
    await redis.del(indexKey);
  } catch (error) {
    // Generation invalidation above is authoritative; deletion is storage
    // cleanup and must not turn a successful invalidation into a false failure.
    console.error('Failed to clean up invalidated session keys:', error);
  }
}
