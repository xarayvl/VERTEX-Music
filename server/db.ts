import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
const UPSTASH_DB_KEY = 'app:spotify:db_v1';
const UPSTASH_DB_BACKUP_KEY = 'app:spotify:db_v1:previous';

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

export interface ChatMessageRecord {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  matchedTracks?: any[];
  webSearchUsed?: boolean;
  searchQueries?: string[];
  sources?: { title: string; uri: string }[];
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
  if (value.startsWith('/uploads/') || value.startsWith('/api/r2-file/') || isHttpUrl(value)) return true;
  return expected === 'audio'
    ? /^data:audio\/[^;]+;base64,/i.test(value)
    : /^data:image\/[^;]+;base64,/i.test(value) || /^data:image\/svg\+xml/i.test(value);
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
  for (const user of users) {
    const history = Array.isArray(rawHistories[user.id]) ? rawHistories[user.id] : [];
    chatHistories[user.id] = history.slice(-200).filter((message): message is ChatMessageRecord =>
      Boolean(
        message &&
        typeof message.id === 'string' && message.id.trim() &&
        (message.sender === 'user' || message.sender === 'ai') &&
        typeof message.text === 'string' && message.text.trim() &&
        typeof message.timestamp === 'string' && !Number.isNaN(Date.parse(message.timestamp))
      )
    ).map((message) => ({
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
      searchQueries: Array.isArray(message.searchQueries)
        ? message.searchQueries.filter((query): query is string => typeof query === 'string' && Boolean(query.trim())).map((query) => query.trim().slice(0, 500)).slice(0, 10)
        : undefined,
      sources: Array.isArray(message.sources)
        ? message.sources
            .filter((source): source is { title: string; uri: string } => Boolean(source && typeof source.title === 'string' && source.title.trim() && typeof source.uri === 'string' && isHttpUrl(source.uri)))
            .map((source) => ({ title: source.title.trim().slice(0, 500), uri: source.uri.trim().slice(0, 2_000) }))
            .slice(0, 10)
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
    const previousCanonical = await redis.get<DBData>(UPSTASH_DB_KEY);
    const previous = previousCanonical && typeof previousCanonical === 'object'
      ? sanitizeDBData(previousCanonical)
      : null;
    const nextCanonicalJson = JSON.stringify(data);
    if (previous && JSON.stringify(previous) === nextCanonicalJson) return;

    const previousUserIds = (previous?.users || []).map((item) => item.id);
    const previousTrackIds = (previous?.tracks || []).map((item) => item.id);
    const previousPlaylistIds = (previous?.playlists || []).map((item) => item.id);
    const previousArtistIds = (previous?.users || [])
      .filter((user) => user.isArtist || previous?.tracks.some((track) => track.userId === user.id))
      .map((user) => user.id);
    const indexPromises: Promise<any>[] = [redis.set(UPSTASH_DB_KEY, data)];
    const changed = (before: string[], after: string[]) => JSON.stringify(before) !== JSON.stringify(after);
    const structureChanged = !previous
      || changed(previousUserIds, userIds)
      || changed(previousTrackIds, trackIds)
      || changed(previousPlaylistIds, playlistIds);
    // Keep recovery snapshots, but do not rewrite a full duplicate database
    // for every play counter, chat message, or listening-time tick.
    if (
      previousCanonical &&
      typeof previousCanonical === 'object' &&
      (structureChanged || Date.now() - lastCanonicalBackupAt >= 15 * 60_000)
    ) {
      await redis.set(UPSTASH_DB_BACKUP_KEY, previousCanonical);
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
      if (u.id && previousUsers.get(u.id) !== JSON.stringify(u)) {
        entityPromises.push(redis.set(`app:user:${u.id}`, u));
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
        const validated = sanitizeDBData(remoteData);
        cachedDB = validated;
        cachedDBFetchedAt = Date.now();
        lastPersistedJson = JSON.stringify(validated);
        // Also mirror to local disk as secondary fallback
        saveToLocalDisk(validated);
        await syncUpstashIndices(redis, validated);
        console.log(`✅ Loaded ${validated.users.length} users, ${validated.tracks.length} tracks from Upstash Redis.`);
        return validated;
      } else {
        console.log('ℹ️ Upstash Redis key empty. Initializing from the canonical local database...');
        const localData = readFromLocalDisk();
        cachedDB = localData;
        cachedDBFetchedAt = Date.now();
        lastPersistedJson = JSON.stringify(localData);
        await syncUpstashIndices(redis, localData);
        return localData;
      }
    } catch (err) {
      console.error('Failed to communicate with Upstash Redis, falling back to local disk:', err);
    }
  }

  const diskData = readFromLocalDisk();
  cachedDB = diskData;
  cachedDBFetchedAt = Date.now();
  lastPersistedJson = JSON.stringify(diskData);
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
    return sanitizeDBData(parsed);
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
    const tempFile = `${DB_FILE}.tmp.${crypto.randomUUID()}`;
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

export async function readDBAsync(forceRemote = false): Promise<DBData> {
  await writeChain.catch(() => undefined);
  const redis = getUpstashClient();
  if (redis && (forceRemote || !cachedDB || Date.now() - cachedDBFetchedAt >= getRemoteCacheTtlMs())) {
    try {
      const remoteData = await redis.get<DBData>(UPSTASH_DB_KEY);
      if (remoteData && typeof remoteData === 'object') {
        const validated = sanitizeDBData(remoteData);
        cachedDB = validated;
        cachedDBFetchedAt = Date.now();
        lastPersistedJson = JSON.stringify(validated);
        saveToLocalDisk(validated);
        return validated;
      }
    } catch (err) {
      console.error('Async Upstash read error:', err);
    }
  }
  return readDB();
}

function enqueueDatabaseWrite(input: DBData): Promise<void> {
  const data = sanitizeDBData(input);
  const serialized = JSON.stringify(data);
  if (serialized === lastPersistedJson) return writeChain;
  cachedDB = data;
  cachedDBFetchedAt = Date.now();
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      saveToLocalDisk(data);
      const redis = getUpstashClient();
      if (redis) await syncUpstashIndices(redis, data);
      lastPersistedJson = serialized;
    })
    .catch((error) => {
      console.error('Failed to persist database write:', error);
      throw error;
    });
  return writeChain;
}

export function writeDB(data: DBData): void {
  void enqueueDatabaseWrite(data).catch(() => undefined);
}

export async function writeDBAsync(data: DBData): Promise<void> {
  await enqueueDatabaseWrite(data);
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
