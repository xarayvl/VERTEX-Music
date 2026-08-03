import React, { useEffect, useState, useRef } from 'react';
import {
  User,
  Edit3,
  Clock,
  Music,
  Heart,
  Sparkles,
  Headphones,
  Download,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Settings,
  MoreHorizontal,
  Play,
  Camera, Upload,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Zap,
  Radio,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { UserProfile, Track, Playlist, Artist } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

interface ProfileViewProps {
  userProfile: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  tracks: Track[];
  playlists?: Playlist[];
  recentlyPlayed?: Track[];
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
  onSelectArtist?: (artist: Artist | UserProfile | string) => void;
  onDeleteTrack?: (trackId: string) => void;
  onEditTrack?: (track: Track) => void;
  onOpenAddTrackModal?: () => void;
  artists?: Artist[];
}

interface ReliableArtistImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
}

const ReliableArtistImage: React.FC<ReliableArtistImageProps> = ({ src, fallbackSrc, alt }) => {
  const firstSource = src || fallbackSrc || DEFAULT_AVATAR_URL;
  const [currentSource, setCurrentSource] = useState(firstSource);

  useEffect(() => {
    setCurrentSource(src || fallbackSrc || DEFAULT_AVATAR_URL);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (fallbackSrc && currentSource !== fallbackSrc) {
      setCurrentSource(fallbackSrc);
      return;
    }
    if (currentSource !== DEFAULT_AVATAR_URL) {
      setCurrentSource(DEFAULT_AVATAR_URL);
    }
  };

  return (
    <img
      src={currentSource}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={handleError}
      className="media-fade h-full w-full object-cover"
    />
  );
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  tracks,
  playlists = [],
  recentlyPlayed = [],
  onPlayTrack,
  onToggleLike,
  onLogout,
  onOpenAuthModal,
  onSelectArtist,
  onDeleteTrack,
  onEditTrack,
  onOpenAddTrackModal,
  artists = [],
}) => {
  // Personal history is resolved from the current account's server-backed recent track IDs.
  // An empty history remains empty instead of borrowing another account's catalog data.
  const personalTopTracks = recentlyPlayed.filter((track): track is Track => Boolean(track?.id)).slice(0, 5);
  const recentArtistIds = Array.from(
    new Set(recentlyPlayed.map((track) => track.userId).filter((id): id is string => Boolean(id)))
  );
  const personalTopArtists = recentArtistIds
    .map((artistId) => {
      const profile = artistId === userProfile?.id
        ? ({
            id: userProfile.id,
            name: userProfile.artistName || userProfile.displayName || userProfile.username,
            avatarUrl: userProfile.avatarUrl || DEFAULT_AVATAR_URL,
            totalStreamsLabel: userProfile.totalStreamsLabel || '0 total streams',
            verified: userProfile.artistVerified === true,
            genre: userProfile.favoriteGenres?.[0] || '',
            isUser: true,
          } as Artist)
        : artists.find((artist) => artist.id === artistId);
      if (!profile) return null;
      const trackCover = recentlyPlayed.find((track) => track.userId === artistId)?.coverUrl;
      return { profile, fallbackAvatar: trackCover || DEFAULT_AVATAR_URL };
    })
    .filter((item): item is { profile: Artist; fallbackAvatar: string } => Boolean(item));
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'settings'>('overview');
  const [isEditing, setIsEditing] = useState(false);

  // Edit profile form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(userProfile?.favoriteGenres || []);
  const [newGenre, setNewGenre] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingAvatarFile, setIsReadingAvatarFile] = useState(false);


  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    setIsReadingAvatarFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) setAvatarUrl(result);
      setIsReadingAvatarFile(false);
    };
    reader.onerror = () => setIsReadingAvatarFile(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      displayName: displayName.trim() || userProfile.displayName,
      username: username.trim() || userProfile.username,
      bio: bio.trim(),
      avatarUrl: avatarUrl || userProfile.avatarUrl,
      favoriteGenres,
    });
    setIsEditing(false);
  };


  const handleAddGenre = () => {
    if (newGenre.trim() && !favoriteGenres.includes(newGenre.trim())) {
      setFavoriteGenres([...favoriteGenres, newGenre.trim()]);
      setNewGenre('');
    }
  };

  const handleRemoveGenre = (genre: string) => {
    setFavoriteGenres(favoriteGenres.filter((g) => g !== genre));
  };

  // -------------------------------------------------------------
  // DYNAMIC USER ACTIVITY & STATS CALCULATION
  // -------------------------------------------------------------
  const realPlaylistsCount = playlists
    ? playlists.filter((p) => p.userId === userProfile?.id).length
    : userProfile?.stats?.playlistsCreated ?? 0;

  // Calculate Listening Hours dynamically from secondsListened or hoursListened
  const secondsListened = userProfile?.stats?.secondsListened ?? 0;
  const computedHours = secondsListened > 0
    ? (secondsListened / 3600).toFixed(1)
    : (userProfile?.stats?.hoursListened ?? 0).toString();

  // Calculate Tracks Streamed count
  const tracksPlayedCount = userProfile?.stats?.tracksPlayed ?? 0;

  // Calculate Top Genre & Genre Percentage dynamically from user's tracks & favorite genres
  const genreCounts: Record<string, number> = {};
  recentlyPlayed.forEach((t) => {
    if (t.genre) {
      genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    }
  });

  let calculatedTopGenre = userProfile?.stats?.topGenre && userProfile.stats.topGenre !== 'N/A'
    ? userProfile.stats.topGenre
    : 'N/A';
  let topGenrePercentage = 0;

  const genreEntries = Object.entries(genreCounts);
  if (genreEntries.length > 0) {
    genreEntries.sort((a, b) => b[1] - a[1]);
    calculatedTopGenre = genreEntries[0][0];
    const totalGenreTracks = recentlyPlayed.length;
    topGenrePercentage = totalGenreTracks > 0 ? Math.round((genreEntries[0][1] / totalGenreTracks) * 100) : 0;
  } else if (userProfile?.favoriteGenres && userProfile.favoriteGenres.length > 0) {
    calculatedTopGenre = userProfile.favoriteGenres[0];
    topGenrePercentage = Math.round(100 / userProfile.favoriteGenres.length);
  }

  // Followers & Following
  const followersCount = userProfile?.stats?.followersCount ?? 0;
  const followingCount = userProfile?.stats?.followingCount ?? 0;

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-[#181818] border border-white/10 rounded-2xl shadow-2xl max-w-xl mx-auto my-12 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] flex items-center justify-center mb-4 shadow-xl">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-black text-white">You are not signed in</h2>
        <p className="text-xs text-zinc-400 mt-2 max-w-md">
          Sign in or register for a VERTEX Music account to save custom playlists, customize your profile, and keep your account activity synced.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onOpenAuthModal}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-extrabold text-xs shadow-lg hover:opacity-90 active:scale-95 transition-all"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 select-none animate-in fade-in duration-300">
      {/* SPOTIFY PROFILE HERO BANNER */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#A855F7]/30 via-[#181818] to-[#121212] p-6 sm:p-8 border border-white/10 shadow-2xl mb-6">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8">
          {/* Circular Avatar with Edit Overlay */}
          <div
            onClick={() => setIsEditing(true)}
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden shadow-2xl border-4 border-black/40 group cursor-pointer flex-shrink-0"
            title="Click to edit profile avatar"
          >
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white space-y-1">
              <Camera className="w-8 h-8 text-[#D946EF]" />
              <span className="text-xs font-bold uppercase tracking-wider">Choose photo</span>
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-2 text-center md:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                PROFILE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#A855F7]/20 text-[#C084FC] text-[10px] font-mono border border-[#A855F7]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D946EF]" />
                {userProfile.isArtist ? 'Artist account' : 'Listener account'}
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-md truncate">
              {userProfile.displayName}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-xl line-clamp-2">
              {userProfile.bio || 'No profile biography has been added yet.'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-400 font-medium pt-1">
              <span className="text-white font-bold">{realPlaylistsCount} Public Playlist{realPlaylistsCount === 1 ? '' : 's'}</span>
              <span>•</span>
              <span className="text-white font-bold">{followersCount.toLocaleString()} Followers</span>
              <span>•</span>
              <span className="text-white font-bold">{followingCount.toLocaleString()} Following</span>
              <span>•</span>
              <span className="font-mono text-zinc-500">Joined {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'date unavailable'}</span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center space-x-3 pt-8 flex-wrap gap-y-3">
          <button
            onClick={() => personalTopTracks[0] && onPlayTrack(personalTopTracks[0])}
            disabled={personalTopTracks.length === 0}
            className="w-14 h-14 disabled:opacity-40 disabled:cursor-not-allowed rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
            title="Play your most recently played track"
          >
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </button>

          {onSelectArtist && (
            <button
              onClick={() => onSelectArtist(userProfile)}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white text-xs font-extrabold shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>View Artist Page</span>
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-5 py-2.5 rounded-full border border-zinc-500 hover:border-white text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
          >
            {isEditing ? 'Cancel Editing' : 'Edit Profile'}
          </button>

          <button
            onClick={onLogout}
            className="px-5 py-2.5 rounded-full border border-red-500/40 hover:bg-red-500/20 text-xs font-bold text-red-400 transition-all hover:scale-105 active:scale-95"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3.5 bg-[#121212] border-b border-white/10 flex items-center space-x-2 mt-0 mb-6 shadow-md">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'overview'
              ? 'bg-white text-black shadow'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Overview & Listening
        </button>


        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
            activeSubTab === 'settings'
              ? 'bg-white text-black shadow'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Account Information</span>
        </button>
      </div>

      {/* SUB-TAB 1: OVERVIEW & ANALYTICS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in">
          {/* EDIT PROFILE FORM MODAL/PANEL */}
          {isEditing && (
            <form
              onSubmit={handleSaveProfile}
              className="p-6 rounded-2xl bg-[#181818] border border-[#D946EF]/40 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#D946EF]" />
                  <span>Edit Profile Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#D946EF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#D946EF]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Bio / Status
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#D946EF] resize-none"
                />
              </div>

              {/* Avatar Upload / Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Profile Photo
                  </label>
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isReadingAvatarFile}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isReadingAvatarFile ? 'Reading...' : 'Upload Your Own Photo'}</span>
                  </button>
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileUpload}
                    className="hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl(DEFAULT_AVATAR_URL)}
                  className="text-[11px] text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                >
                  Reset to default icon
                </button>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-xs font-black text-white hover:scale-105 transition-transform shadow-lg"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* Listening Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#181818] border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold uppercase">Hours Listened</span>
                <Clock className="w-4 h-4 text-[#D946EF]" />
              </div>
              <p className="text-2xl font-black text-white">{computedHours} hrs</p>
              <p className="text-[10px] text-zinc-500">{secondsListened > 0 ? 'Active streaming time' : 'No activity logged'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#181818] border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold uppercase">Tracks Streamed</span>
                <Music className="w-4 h-4 text-[#D946EF]" />
              </div>
              <p className="text-2xl font-black text-white">{tracksPlayedCount.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500">{tracksPlayedCount > 0 ? 'Based on saved play history' : 'No tracks played yet'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#181818] border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold uppercase">Top Genre</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-lg font-black text-white truncate">{calculatedTopGenre}</p>
              <p className="text-[10px] text-zinc-500">{topGenrePercentage > 0 ? `${topGenrePercentage}% of listening time` : '0% of listening time'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#181818] border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold uppercase">Playlists</span>
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-white">{realPlaylistsCount}</p>
              <p className="text-[10px] text-zinc-500">Created by you</p>
            </div>
          </div>

          {/* MY UPLOADED SONGS & ARTIST RELEASES SECTION */}
          <div className="space-y-3 bg-[#181818]/80 p-5 rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-white tracking-tight">My Uploaded Songs & Releases</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D946EF]/20 text-[#D946EF] text-[10px] font-mono font-bold border border-[#D946EF]/30">
                    Disk Folder Storage
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Songs uploaded to your user folder persist across session reloads.</p>
              </div>

              {onOpenAddTrackModal && (
                <button
                  onClick={onOpenAddTrackModal}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Upload Track</span>
                </button>
              )}
            </div>

            {(() => {
              // IMPORTANT: ownership must ONLY ever be determined by userId.
              // A previous version of this filter also matched tracks by
              // comparing the track's "artist" text field against this
              // user's displayName/artistName. That caused tracks uploaded
              // by a completely different account to show up here (and be
              // deletable-looking) whenever two accounts happened to share a
              // similar display name or artist name. Do not reintroduce that
              // text-matching fallback.
              const myUploadedTracks = (tracks || []).filter(
                (t) => t && t.id && userProfile && t.userId === userProfile.id
              );

              if (myUploadedTracks.length === 0) {
                return (
                  <div className="p-6 text-center bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <Music className="w-8 h-8 mx-auto text-zinc-500" />
                    <p className="text-xs font-bold text-white">No uploaded songs yet</p>
                    <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                      Upload your MP3 / WAV audio files directly. They will be stored in your folder and featured on your Spotify artist profile.
                    </p>
                    {onOpenAddTrackModal && (
                      <button
                        onClick={onOpenAddTrackModal}
                        className="mt-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                      >
                        Upload First Track
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="bg-[#121212] rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">
                  {myUploadedTracks.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/10 group transition-colors"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <button
                          onClick={() => onPlayTrack(track)}
                          className="w-8 h-8 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-105 transition-all flex-shrink-0 shadow"
                        >
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </button>

                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded shadow flex-shrink-0 object-cover border border-white/10"
                        />

                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-white truncate">{track.title}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
                            <span className="truncate">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-[#C084FC] truncate">
                              {track.audioUrl?.startsWith('/uploads/') ? track.audioUrl : 'Uploaded File'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </span>

                        {onEditTrack && (
                          <button
                            onClick={() => onEditTrack(track)}
                            className="p-1.5 text-zinc-500 hover:text-[#D946EF] transition-colors"
                            title="Edit track"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {onDeleteTrack && (
                          <button
                            onClick={() => onDeleteTrack(track.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Recently Played Tracks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Recently played tracks</h2>
                <p className="text-xs text-zinc-400">Only visible to you</p>
              </div>
            </div>

            {personalTopTracks.length === 0 ? (
              <p className="text-xs text-zinc-400 italic bg-white/5 p-4 rounded-xl border border-white/5">
                Play some songs and they'll show up here — this list is personal to your account.
              </p>
            ) : (
            <div className="bg-[#181818]/60 rounded-xl overflow-hidden border border-white/5">
              <div className="divide-y divide-white/5">
                {personalTopTracks.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/10 group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <span className="w-5 text-center text-xs font-bold text-zinc-400 group-hover:hidden">
                        {index + 1}
                      </span>
                      <button className="w-5 text-center hidden group-hover:block text-white">
                        <Play className="w-4 h-4 fill-white" />
                      </button>

                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded shadow flex-shrink-0 object-cover"
                      />

                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-white truncate">{track.title}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <span className="hidden sm:inline text-xs font-mono text-zinc-400">
                        {track.plays ? `${Number(track.plays).toLocaleString()} plays` : '0 plays'}
                      </span>

                      <button
                        onClick={(event) => { event.stopPropagation(); onToggleLike(track.id); }}
                        className={`transition-colors ${
                          track.isLiked
                            ? 'text-[#D946EF]'
                            : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${track.isLiked ? 'fill-[#D946EF]' : ''}`}
                        />
                      </button>

                      <span className="text-xs font-mono text-zinc-400">{`${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, '0')}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* Recently Played Artists */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Recently played artists</h2>
                <p className="text-xs text-zinc-400">Only visible to you</p>
              </div>
            </div>

            {(() => {
              if (personalTopArtists.length === 0) {
                return (
                  <p className="text-xs text-zinc-400 italic bg-white/5 p-4 rounded-xl border border-white/5">
                    Play some songs to see your personal top artists here!
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {personalTopArtists.map(({ profile: artist, fallbackAvatar }, idx) => (
                    <div
                      key={artist.id}
                      onClick={() => onSelectArtist && onSelectArtist(artist)}
                      style={{ '--stagger-index': idx } as React.CSSProperties}
                      className="stagger-item card-interactive group flex cursor-pointer flex-col items-center space-y-3 rounded-xl border border-white/5 bg-[#181818] p-4 text-center transition-all hover:bg-[#282828]"
                    >
                      <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-xl font-black text-white shadow-lg transition-transform duration-300 group-hover:scale-105">
                        <ReliableArtistImage
                          src={artist.avatarUrl}
                          fallbackSrc={fallbackAvatar}
                          alt={artist.name}
                        />
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold text-white truncate w-full">
                          {artist.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400">Artist</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* ACCOUNT SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Account Information</h2>
            <p className="text-xs text-zinc-400">These values come from the authenticated account and server-side activity records.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#181818] border border-white/10 p-5">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Account type</p>
              <p className="mt-2 text-sm font-bold text-white">{userProfile.isArtist ? 'Artist' : 'Listener'}</p>
            </div>
            <div className="rounded-2xl bg-[#181818] border border-white/10 p-5">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Joined</p>
              <p className="mt-2 text-sm font-bold text-white">
                {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unavailable'}
              </p>
            </div>
            <div className="rounded-2xl bg-[#181818] border border-white/10 p-5">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Owned playlists</p>
              <p className="mt-2 text-sm font-bold text-white">{realPlaylistsCount}</p>
            </div>
            <div className="rounded-2xl bg-[#181818] border border-white/10 p-5">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Saved plays</p>
              <p className="mt-2 text-sm font-bold text-white">{tracksPlayedCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
