export type TabType = 'home' | 'browse' | 'search' | 'library' | 'chat' | 'playlist' | 'profile' | 'artist' | 'album';

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  membershipTier: string; // e.g. "Free Hi-Res Member"
  memberSince: string;
  favoriteGenres: string[];
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
  stats: {
    hoursListened: number;
    secondsListened?: number;
    tracksPlayed: number;
    topGenre: string;
    playlistsCreated: number;
    followersCount?: number;
    followingCount?: number;
  };
  settings?: {
    losslessAudio: boolean;
    autoplay: boolean;
    audioNormalization: boolean;
    offlineDownloads: boolean;
  };
}

export interface Track {
  id: string;
  userId?: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl?: string; // MP3 / Audio file URL or base64 data URL
  duration: number; // in seconds
  genre: string;
  accentColor: string; // e.g. '#5E5CE6'
  secondaryColor: string; // e.g. '#FF375F'
  bpm: number;
  scale?: string; // synth scale preset for web audio
  plays?: string;
  isLiked?: boolean;
  syncedLyrics?: { time: number; text: string }[];
  createdAt?: string;
  releaseType?: 'SINGLE' | 'EP' | 'ALBUM' | string;
  releaseTitle?: string;
  releaseId?: string;
  copyright?: string;
  releaseYear?: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: number;
  trackCount: number;
  genre: string;
}

export interface Playlist {
  id: string;
  userId?: string;
  title: string;
  description: string;
  coverUrl: string;
  trackCount: number;
  likes: string;
  tags: string[];
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl?: string;
  bio?: string;
  monthlyListeners: string;
  verified: boolean;
  genre: string;
  instagramUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  artistPickTrackId?: string;
  artistPickComment?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  matchedTracks?: Track[];
}

export interface AudioEQ {
  bass: number; // -10 to 10
  mid: number;
  treble: number;
  preset: 'Acoustic' | 'Bass Booster' | 'Electronic' | 'Pop' | 'Vocal' | 'Flat';
}

export interface DesignToken {
  category: 'Colors' | 'Typography' | 'Spacing' | 'Effects';
  name: string;
  value: string;
  description: string;
}
