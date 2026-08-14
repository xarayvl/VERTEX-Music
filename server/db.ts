import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { isStoredSessionRecord, remainingSessionTtlMs, type StoredSessionRecord } from './sessionSecurity.js';

const UPSTASH_DB_KEY = 'app:spotify:db_v1';
const UPSTASH_DB_BACKUP_KEY = 'app:spotify:db_v1:previous';
export const ADMIN_USER_ID = 'usr_1785645840720_7coat';

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
  bannedAt: string | null;
  banReason: string | null;
  bannedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
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
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
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
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
}

export interface AdminAuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  targetType: 'user' | 'track' | 'playlist';
  targetId: string;
  timestamp: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
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
  adminAuditLog: AdminAuditLogRecord[];
}

function emptyUserState(): UserStateRecord {
  return { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [] };
}

function emptyDBData(): DBData {
  return {
    users: [],
    playlists: [],
    tracks: [],
    userStates: {},
    chatHistories: {},
    adminAuditLog: [],
  };
}

function cloneDBData(data: DBData): DBData {
  return JSON.parse(JSON.stringify(data)) as DBData;
}

function hasLegacyLocalMedia(input: Partial<DBData>): boolean {
  const isLegacy = (value: unknown) => typeof value === 'string' && value.startsWith('/uploads/');
  return (Array.isArray(input.users) && input.users.some((user) => isLegacy(user?.avatarUrl) || isLegacy(user?.bannerUrl)))
    || (Array.isArray(input.tracks) && input.tracks.some((track) => isLegacy(track?.audioUrl) || isLegacy(track?.coverUrl)))
    || (Array.isArray(input.playlists) && input.playlists.some((playlist) => isLegacy(playlist?.coverUrl)));
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
  return expected === 'audio'
    ? /^data:audio\/[^;]+;base64,/i.test(value)
    : /^data:image\/[^;]+;base64,/i.test(value) || /^data:image\/svg\+xml/i.test(value);
}

function normalizedIsoDate(value: unknown): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : new Date(0).toISOString();
}

function normalizedOptionalIsoDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function normalizedOptionalText(value: unknown, maxLength = 500): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

const SENSITIVE_AUDIT_KEY = /password|passwd|hash|token|credential|secret|authorization|cookie/i;

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === undefined) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (Array.isArray(value)) {
    return value.slice(0, 100).flatMap((item) => {
      const clean = sanitizeAuditValue(item, depth + 1);
      return clean === undefined ? [] : [clean];
    });
  }
  if (typeof value !== 'object') return undefined;

  const clean: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    if (SENSITIVE_AUDIT_KEY.test(key)) continue;
    const sanitized = sanitizeAuditValue(nested, depth + 1);
    if (sanitized !== undefined) clean[key.slice(0, 120)] = sanitized;
  }
  return clean;
}

function sanitizeAuditSummary(value: unknown): Record<string, unknown> | null {
  const sanitized = sanitizeAuditValue(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : null;
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
      bannedAt: id === ADMIN_USER_ID ? null : normalizedOptionalIsoDate(rawUser.bannedAt),
      banReason: id === ADMIN_USER_ID ? null : normalizedOptionalText(rawUser.banReason),
      bannedBy: id === ADMIN_USER_ID ? null : normalizedOptionalText(rawUser.bannedBy, 200),
      archivedAt: id === ADMIN_USER_ID ? null : normalizedOptionalIsoDate(rawUser.archivedAt),
      archivedBy: id === ADMIN_USER_ID ? null : normalizedOptionalText(rawUser.archivedBy, 200),
      archiveReason: id === ADMIN_USER_ID ? null : normalizedOptionalText(rawUser.archiveReason),
      // The requested account is the single reserved admin identity. This
      // keeps the allowlist effective when the canonical record is hydrated
      // from an older Upstash snapshot that predates the local flag update.
      isAdmin: id === ADMIN_USER_ID,
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
      archivedAt: normalizedOptionalIsoDate(rawTrack.archivedAt),
      archivedBy: normalizedOptionalText(rawTrack.archivedBy, 200),
      archiveReason: normalizedOptionalText(rawTrack.archiveReason),
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
        archivedAt: normalizedOptionalIsoDate(playlist.archivedAt),
        archivedBy: normalizedOptionalText(playlist.archivedBy, 200),
        archiveReason: normalizedOptionalText(playlist.archiveReason),
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
      (count, candidate) => count + (!candidate.archivedAt && userStates[candidate.id]?.followedArtistIds.includes(user.id) ? 1 : 0),
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
    const derivedTopGenre = [...recentGenreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const persistedTopGenre = typeof user.stats?.topGenre === 'string' && user.stats.topGenre.trim()
      ? user.stats.topGenre.trim().slice(0, 80)
      : derivedTopGenre;
    const activeFollowedArtistIds = followedArtistIds.filter((artistId) => !userById.get(artistId)?.archivedAt);
    user.stats = {
      hoursListened: secondsListened / 3600,
      secondsListened,
      tracksPlayed: Math.max(0, Math.floor(Number(user.stats?.tracksPlayed) || 0)),
      topGenre: persistedTopGenre,
      playlistsCreated: user.archivedAt ? 0 : playlists.filter((playlist) => playlist.userId === user.id && !playlist.archivedAt).length,
      followersCount: user.archivedAt ? 0 : followersCount,
      followingCount: activeFollowedArtistIds.length,
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

  const rawAuditLog = Array.isArray(input?.adminAuditLog) ? input!.adminAuditLog : [];
  const seenAuditIds = new Set<string>();
  const adminAuditLog: AdminAuditLogRecord[] = rawAuditLog
    .slice(-2_000)
    .flatMap((entry): AdminAuditLogRecord[] => {
      if (!entry || typeof entry !== 'object') return [];
      const id = typeof entry.id === 'string' ? entry.id.trim().slice(0, 200) : '';
      const actorId = typeof entry.actorId === 'string' ? entry.actorId.trim().slice(0, 200) : '';
      const action = typeof entry.action === 'string' ? entry.action.trim().slice(0, 160) : '';
      const targetType = entry.targetType === 'user' || entry.targetType === 'track' || entry.targetType === 'playlist'
        ? entry.targetType
        : null;
      const targetId = typeof entry.targetId === 'string' ? entry.targetId.trim().slice(0, 200) : '';
      if (!id || seenAuditIds.has(id) || !actorId || !action || !targetType || !targetId) return [];
      seenAuditIds.add(id);
      return [{
        id,
        actorId,
        action,
        targetType,
        targetId,
        timestamp: normalizedIsoDate(entry.timestamp),
        reason: normalizedOptionalText(entry.reason, 1_000) || 'No reason recorded',
        before: sanitizeAuditSummary(entry.before),
        after: sanitizeAuditSummary(entry.after),
      }];
    });

  return { users, playlists, tracks, userStates, chatHistories, adminAuditLog };
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

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test';
}

function requireTestRuntimeWithoutUpstash(): void {
  if (!isTestRuntime()) {
    throw new Error('Upstash Redis is required. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
}

function testDatabaseSeed(): DBData {
  requireTestRuntimeWithoutUpstash();
  const encoded = process.env.VERTEX_TEST_DB_BASE64?.trim();
  if (!encoded) return emptyDBData();
  try {
    return sanitizeDBData(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
  } catch (error) {
    throw new Error('VERTEX_TEST_DB_BASE64 does not contain a valid database fixture.', { cause: error });
  }
}

function allowEmptyDatabaseInitialization(): boolean {
  return process.env.ALLOW_EMPTY_DATABASE_INIT === '1';
}

export async function syncUpstashIndices(redis: Redis, data: DBData): Promise<void> {
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
}

/**
 * Initializes the canonical database from Upstash Redis. Tests use an
 * explicitly injected in-memory fixture so production never falls back to a
 * filesystem database.
 */
export async function initUpstashDB(): Promise<DBData> {
  const redis = getUpstashClient();
  if (!redis) {
    requireTestRuntimeWithoutUpstash();
    const seeded = testDatabaseSeed();
    cachedDB = seeded;
    cachedDBFetchedAt = Date.now();
    lastPersistedJson = JSON.stringify(seeded);
    return seeded;
  }

  try {
    console.log('⚡ Upstash Redis detected! Loading the canonical database...');
    const remoteData = await redis.get<DBData>(UPSTASH_DB_KEY);
    if ((!remoteData || typeof remoteData !== 'object') && !allowEmptyDatabaseInitialization()) {
      throw new Error(
        `Upstash key ${UPSTASH_DB_KEY} is empty. Set ALLOW_EMPTY_DATABASE_INIT=1 only for an intentional first-time initialization.`,
      );
    }
    if (remoteData && typeof remoteData === 'object' && hasLegacyLocalMedia(remoteData)) {
      throw new Error('The Upstash database still references legacy /uploads media. Migrate those objects to R2 before startup.');
    }
    const validated = remoteData && typeof remoteData === 'object' ? sanitizeDBData(remoteData) : emptyDBData();
    cachedDB = validated;
    cachedDBFetchedAt = Date.now();
    lastPersistedJson = JSON.stringify(validated);
    await syncUpstashIndices(redis, validated);
    console.log(`✅ Loaded ${validated.users.length} users, ${validated.tracks.length} tracks from Upstash Redis.`);
    return validated;
  } catch (error) {
    throw new Error('The canonical Upstash database could not be initialized.', { cause: error });
  }
}

export function readDB(): DBData {
  if (!cachedDB) throw new Error('The database has not been initialized from Upstash Redis.');
  return cloneDBData(cachedDB);
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
        return cloneDBData(validated);
      }
      if (forceRemote) throw new Error(`Upstash key ${UPSTASH_DB_KEY} is missing.`);
    } catch (err) {
      console.error('Async Upstash read error:', err);
      if (forceRemote) throw new Error('The latest Upstash database snapshot could not be read.', { cause: err });
    }
  }
  return readDB();
}

function enqueueDatabaseWrite(input: DBData): Promise<void> {
  const data = sanitizeDBData(input);
  const serialized = JSON.stringify(data);
  if (serialized === lastPersistedJson) return writeChain;
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const redis = getUpstashClient();
      if (redis) await syncUpstashIndices(redis, data);
      else requireTestRuntimeWithoutUpstash();
      cachedDB = data;
      cachedDBFetchedAt = Date.now();
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
// SESSION PERSISTENCE (digest-keyed Redis records, test-only memory adapter)
// ==========================================
// The raw bearer secret exists only in the browser's HttpOnly cookie and
// transient request memory. Redis and the test adapter are keyed exclusively
// by SHA-256 digests, with one TTL-bearing Redis key per session.
const LEGACY_SESSIONS_HASH_KEY = 'app:sessions';
const SESSION_KEY_PREFIX = 'app:session:';
const USER_SESSIONS_KEY_PREFIX = 'app:user-sessions:';
const USER_SESSION_VERSION_KEY_PREFIX = 'app:user-session-version:';
const inMemorySessions = new Map<string, StoredSessionRecord>();
const inMemoryUserSessionVersions = new Map<string, number>();

function sessionKey(digest: string): string {
  return `${SESSION_KEY_PREFIX}${digest}`;
}

function userSessionsKey(userId: string): string {
  const userDigest = crypto.createHash('sha256').update(userId, 'utf8').digest('hex');
  return `${USER_SESSIONS_KEY_PREFIX}${userDigest}`;
}

function userSessionVersionKey(userId: string): string {
  const userDigest = crypto.createHash('sha256').update(userId, 'utf8').digest('hex');
  return `${USER_SESSION_VERSION_KEY_PREFIX}${userDigest}`;
}

function validSessionDigest(digest: string): boolean {
  return /^[a-f0-9]{64}$/.test(digest);
}

function ttlSeconds(record: StoredSessionRecord): number {
  return Math.max(1, Math.ceil(remainingSessionTtlMs(record) / 1_000));
}

export async function deleteLegacySessionsFromRedis(): Promise<number> {
  const redis = getUpstashClient();
  if (!redis) {
    requireTestRuntimeWithoutUpstash();
    return 0;
  }
  return redis.del(LEGACY_SESSIONS_HASH_KEY);
}

export async function createSessionInStore(digest: string, record: StoredSessionRecord): Promise<void> {
  if (!validSessionDigest(digest) || !isStoredSessionRecord(record) || remainingSessionTtlMs(record) <= 0) {
    throw new Error('Refusing to persist an invalid session record.');
  }

  const redis = getUpstashClient();
  if (!redis) {
    requireTestRuntimeWithoutUpstash();
    inMemorySessions.set(digest, { ...record });
    return;
  }

  const recordKey = sessionKey(digest);
  const indexKey = userSessionsKey(record.userId);
  try {
    await Promise.all([
      redis.set(recordKey, record, { ex: ttlSeconds(record) }),
      redis.sadd(indexKey, digest),
    ]);
    await redis.expire(indexKey, Math.max(1, Math.ceil((record.absoluteExpiresAt - Date.now()) / 1_000)));
  } catch (error) {
    await Promise.allSettled([redis.del(recordKey), redis.srem(indexKey, digest)]);
    throw error;
  }
}

export async function readSessionFromStore(digest: string): Promise<StoredSessionRecord | null> {
  if (!validSessionDigest(digest)) return null;
  const redis = getUpstashClient();
  if (redis) {
    const record = await redis.get<StoredSessionRecord>(sessionKey(digest));
    return isStoredSessionRecord(record) ? record : null;
  }

  requireTestRuntimeWithoutUpstash();
  const record = inMemorySessions.get(digest);
  if (!record) return null;
  if (!isStoredSessionRecord(record) || remainingSessionTtlMs(record) <= 0) {
    inMemorySessions.delete(digest);
    return null;
  }
  return { ...record };
}

export async function readUserSessionVersionFromStore(userId: string): Promise<number> {
  if (!userId) return -1;
  const redis = getUpstashClient();
  if (redis) {
    const version = await redis.get<number>(userSessionVersionKey(userId));
    return Number.isInteger(version) && Number(version) >= 0 ? Number(version) : 0;
  }
  requireTestRuntimeWithoutUpstash();
  return inMemoryUserSessionVersions.get(userId) || 0;
}

/** Refresh idle expiry without resurrecting a concurrently revoked Redis key. */
export async function touchSessionInStore(digest: string, record: StoredSessionRecord): Promise<boolean> {
  if (!validSessionDigest(digest) || !isStoredSessionRecord(record) || remainingSessionTtlMs(record) <= 0) return false;
  const redis = getUpstashClient();
  if (redis) {
    const result = await redis.set(sessionKey(digest), record, { ex: ttlSeconds(record), xx: true });
    return result !== null;
  }
  requireTestRuntimeWithoutUpstash();
  if (!inMemorySessions.has(digest)) return false;
  inMemorySessions.set(digest, { ...record });
  return true;
}

export async function deleteSessionFromStore(digest: string, userId?: string): Promise<number> {
  if (!validSessionDigest(digest)) return 0;
  const redis = getUpstashClient();
  if (redis) {
    let ownerId = userId;
    if (!ownerId) {
      const record = await redis.get<StoredSessionRecord>(sessionKey(digest));
      if (isStoredSessionRecord(record)) ownerId = record.userId;
    }
    const deleted = await redis.del(sessionKey(digest));
    if (ownerId) await redis.srem(userSessionsKey(ownerId), digest);
    return deleted;
  }
  requireTestRuntimeWithoutUpstash();
  return inMemorySessions.delete(digest) ? 1 : 0;
}

export async function deleteSessionsForUserFromStore(userId: string): Promise<number> {
  if (!userId) return 0;
  const redis = getUpstashClient();
  if (redis) {
    // The version bump is the authoritative invalidation. Even if cleanup of
    // individual expired/orphaned keys later fails, no old record can pass the
    // version check performed by any application instance.
    await redis.incr(userSessionVersionKey(userId));
    const indexKey = userSessionsKey(userId);
    try {
      const digests = await redis.smembers<string[]>(indexKey);
      const keys = digests.filter(validSessionDigest).map(sessionKey);
      if (keys.length > 0) await redis.del(...keys);
      await redis.del(indexKey);
      return keys.length;
    } catch (error) {
      console.error('Session keys could not be cleaned after version invalidation:', error);
      return 0;
    }
  }

  requireTestRuntimeWithoutUpstash();
  inMemoryUserSessionVersions.set(userId, (inMemoryUserSessionVersions.get(userId) || 0) + 1);
  let deleted = 0;
  for (const [digest, record] of inMemorySessions) {
    if (record.userId !== userId) continue;
    inMemorySessions.delete(digest);
    deleted += 1;
  }
  return deleted;
}

export async function countSessionsInStore(): Promise<number> {
  const redis = getUpstashClient();
  if (redis) {
    let cursor: string | number = 0;
    let count = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${SESSION_KEY_PREFIX}*`, count: 1_000 });
      cursor = nextCursor;
      count += keys.length;
    } while (String(cursor) !== '0');
    return count;
  }

  requireTestRuntimeWithoutUpstash();
  for (const [digest, record] of inMemorySessions) {
    if (remainingSessionTtlMs(record) <= 0) inMemorySessions.delete(digest);
  }
  return inMemorySessions.size;
}
