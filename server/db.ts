import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

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
  isAdmin?: boolean; // Must be set manually in data/db.json; never settable via any API endpoint.
  isArtist?: boolean;
  artistName?: string;
  artistBio?: string;
  artistVerified?: boolean;
  bannerUrl?: string;
  monthlyListeners?: string;
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

let writeQueue: Array<() => void> = [];
let isWriting = false;

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

export function readDB(): DBData {
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
      writeDB(defaultData);
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
      writeDB(defaultData);
      return defaultData;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const defaultData: DBData = {
        users: [],
        playlists: [],
        tracks: [],
        userStates: {},
        chatHistories: {},
      };
      writeDB(defaultData);
      return defaultData;
    }
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

export function writeDB(data: DBData): void {
  writeQueue.push(() => {
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
  });
  processWriteQueue();
}
