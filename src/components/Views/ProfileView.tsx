import React, { useState } from 'react';
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

interface ProfileViewProps {
  userProfile: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  tracks: Track[];
  playlists?: Playlist[];
  recentlyPlayed?: Track[];
  onPlayTrack: (track: Track) => void;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
  onSelectArtist?: (artist: Artist | UserProfile) => void;
  onDeleteTrack?: (trackId: string) => void;
  onOpenAddTrackModal?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  tracks,
  playlists = [],
  recentlyPlayed = [],
  onPlayTrack,
  onLogout,
  onOpenAuthModal,
  onSelectArtist,
  onDeleteTrack,
  onOpenAddTrackModal,
}) => {
  // "This month" stats must reflect the CURRENT user's own listening history, not the
  // global/shared track catalog. Falls back to an empty state (not someone else's data)
  // when the user hasn't played anything yet.
  const personalTopTracks = (recentlyPlayed || []).filter((t): t is Track => Boolean(t && t.id)).slice(0, 5);
  const personalTopArtistNames: string[] = Array.from(
    new Set((recentlyPlayed || []).filter((t) => t && t.artist).map((t) => t.artist))
  );
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'audioEngine' | 'settings'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Record<string, boolean>>({
    'trk-1': true,
    'trk-3': true,
    'trk-5': true,
  });

  // Edit profile form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(userProfile?.favoriteGenres || []);
  const [newGenre, setNewGenre] = useState('');

  // Audio & App Preferences state
  const [settings, setSettings] = useState({
    losslessAudio: userProfile?.settings?.losslessAudio ?? true,
    autoplay: userProfile?.settings?.autoplay ?? true,
    audioNormalization: userProfile?.settings?.audioNormalization ?? true,
    offlineDownloads: userProfile?.settings?.offlineDownloads ?? true,
  });

  const presetAvatars = [
    {
      name: 'Violet Glow',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Neon DJ',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Cyberpunk Girl',
      url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Synth Producer',
      url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    },
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      displayName: displayName.trim() || userProfile.displayName,
      username: username.trim() || userProfile.username,
      bio: bio.trim(),
      avatarUrl: avatarUrl || userProfile.avatarUrl,
      favoriteGenres,
      settings,
    });
    setIsEditing(false);
  };

  const handleToggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedTrackIds((prev) => ({ ...prev, [id]: !prev[id] }));
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
    ? playlists.filter((p) => !p.userId || p.userId === userProfile?.id).length
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
  tracks.forEach((t) => {
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
    const totalGenreTracks = tracks.length;
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
          Sign in or register for a VERTEX Music account to save custom playlists, customize your profile, and keep your audio settings synced.
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
                {userProfile.membershipTier || 'Free 24-Bit Lossless Account'}
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-md truncate">
              {userProfile.displayName}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-xl line-clamp-2">
              {userProfile.bio || 'Synthwave producer & spatial audio enthusiast listening on VERTEX Music.'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-400 font-medium pt-1">
              <span className="text-white font-bold">{realPlaylistsCount} Public Playlist{realPlaylistsCount === 1 ? '' : 's'}</span>
              <span>•</span>
              <span className="text-white font-bold">{followersCount.toLocaleString()} Followers</span>
              <span>•</span>
              <span className="text-white font-bold">{followingCount.toLocaleString()} Following</span>
              <span>•</span>
              <span className="font-mono text-zinc-500">Member since {userProfile.memberSince}</span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center space-x-3 pt-8 flex-wrap gap-y-3">
          <button
            onClick={() => tracks[0] && onPlayTrack(tracks[0])}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
            title="Play Favorite Mix"
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
          onClick={() => setActiveSubTab('audioEngine')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
            activeSubTab === 'audioEngine'
              ? 'bg-[#D946EF] text-white shadow'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>Hi-Res Audio Features</span>
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
          <span>Account Settings</span>
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

              {/* Avatar Presets */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Choose Preset Avatar
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {presetAvatars.map((av, i) => (
                    <div
                      key={i}
                      onClick={() => setAvatarUrl(av.url)}
                      className={`aspect-square rounded-full overflow-hidden cursor-pointer border-2 transition-all ${
                        avatarUrl === av.url
                          ? 'border-[#D946EF] ring-2 ring-[#D946EF]/50 scale-105'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={av.url}
                        alt={av.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
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
              <p className="text-[10px] text-zinc-500">{tracksPlayedCount > 0 ? 'Hi-Res FLAC quality' : 'No tracks played yet'}</p>
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
              const myUploadedTracks = (tracks || []).filter(
                (t) =>
                  t &&
                  t.id &&
                  userProfile &&
                  (t.userId === userProfile.id ||
                    (t.artist && userProfile.displayName && t.artist.toLowerCase() === userProfile.displayName.toLowerCase()) ||
                    (t.artist && userProfile.artistName && t.artist.toLowerCase() === userProfile.artistName.toLowerCase()))
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

          {/* Top Tracks This Month Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Top tracks this month</h2>
                <p className="text-xs text-zinc-400">Only visible to you</p>
              </div>
              <button className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider">
                Show all
              </button>
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
                        onClick={(e) => handleToggleLike(track.id, e)}
                        className={`transition-colors ${
                          likedTrackIds[track.id]
                            ? 'text-[#D946EF]'
                            : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${likedTrackIds[track.id] ? 'fill-[#D946EF]' : ''}`}
                        />
                      </button>

                      <span className="text-xs font-mono text-zinc-400">{track.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* Top Artists This Month */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Top artists this month</h2>
                <p className="text-xs text-zinc-400">Only visible to you</p>
              </div>
              <button className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider">
                Show all
              </button>
            </div>

            {(() => {
              if (personalTopArtistNames.length === 0) {
                return (
                  <p className="text-xs text-zinc-400 italic bg-white/5 p-4 rounded-xl border border-white/5">
                    Play some songs to see your personal top artists here!
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {personalTopArtistNames.map((artistName, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#181818] hover:bg-[#282828] transition-all group cursor-pointer flex flex-col items-center text-center space-y-3 border border-white/5"
                    >
                      <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg group-hover:scale-105 transition-transform bg-gradient-to-br from-[#A855F7] to-[#D946EF] flex items-center justify-center text-white text-xl font-black">
                        {artistName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold text-white truncate w-full">
                          {artistName}
                        </h3>
                        <p className="text-[11px] text-zinc-400">Artist</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Favorite Genres Manager */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">Favorite Genres</h2>
            <div className="flex flex-wrap items-center gap-2 p-4 rounded-2xl bg-[#181818] border border-white/5">
              {favoriteGenres.map((genre) => (
                <span
                  key={genre}
                  className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-2"
                >
                  <span>{genre}</span>
                  <button
                    onClick={() => handleRemoveGenre(genre)}
                    className="text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                <input
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="Add genre..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGenre())}
                  className="w-28 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
                <button onClick={handleAddGenre} className="text-[#D946EF] hover:text-white">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: HI-RES AUDIO FEATURES */}
      {activeSubTab === 'audioEngine' && (
        <div className="space-y-8 animate-in fade-in">
          {/* Free App Announcement Banner */}
          <div className="relative rounded-2xl p-8 bg-gradient-to-r from-purple-950/80 via-[#181818] to-fuchsia-950/60 border border-[#D946EF]/30 space-y-4 shadow-2xl">
            <span className="px-3 py-1 rounded-full bg-[#D946EF]/20 text-[#D946EF] font-black text-xs uppercase tracking-wider inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 100% FREE AUDIO ENGINE
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Uncompromised Studio Audio. Completely Free.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
              VERTEX Music provides 24-bit / 96kHz Lossless FLAC streaming, real-time spatial audio, interactive AI DJ voice interactions, and offline listening to every listener with zero paywalls.
            </p>
          </div>

          {/* Core Free Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#181818] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#D946EF]/20 text-[#D946EF] flex items-center justify-center font-bold">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">24-Bit FLAC Lossless Stream</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bit-perfect studio master resolution without lossy compression artifacting.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#181818] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#D946EF]/20 text-[#D946EF] flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">VERTEX AI DJ Assistant</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Conversational AI music curator powered by Gemini for intelligent recommendations.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#181818] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Parametric Equalizer</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Customize bass boost, vocal clarity, and acoustic sound stages on any output device.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#181818] border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Offline Caching</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Save your favorite tracks and mixes directly to local browser storage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ACCOUNT SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Audio Engine & Application Preferences</h2>
            <p className="text-xs text-zinc-400">Configure playback quality, downloads, and playback normalization.</p>
          </div>

          <div className="bg-[#181818] rounded-2xl p-6 divide-y divide-white/10 border border-white/10 space-y-4">
            <div className="flex items-center justify-between pt-1">
              <div>
                <h4 className="text-sm font-bold text-white">24-bit Lossless FLAC Streaming</h4>
                <p className="text-xs text-zinc-400">Stream studio master files up to 24-bit / 96kHz (100% free).</p>
              </div>
              <button
                onClick={() => {
                  const next = !settings.losslessAudio;
                  setSettings({ ...settings, losslessAudio: next });
                  onUpdateProfile({ ...userProfile, settings: { ...settings, losslessAudio: next } });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                  settings.losslessAudio ? 'bg-[#D946EF]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform ${
                    settings.losslessAudio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <h4 className="text-sm font-bold text-white">Autoplay Recommended Tracks</h4>
                <p className="text-xs text-zinc-400">Keep listening to similar songs when your queue finishes.</p>
              </div>
              <button
                onClick={() => {
                  const next = !settings.autoplay;
                  setSettings({ ...settings, autoplay: next });
                  onUpdateProfile({ ...userProfile, settings: { ...settings, autoplay: next } });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                  settings.autoplay ? 'bg-[#D946EF]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform ${
                    settings.autoplay ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <h4 className="text-sm font-bold text-white">Loudness Normalization</h4>
                <p className="text-xs text-zinc-400">Maintain constant volume levels across all tracks.</p>
              </div>
              <button
                onClick={() => {
                  const next = !settings.audioNormalization;
                  setSettings({ ...settings, audioNormalization: next });
                  onUpdateProfile({ ...userProfile, settings: { ...settings, audioNormalization: next } });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative p-1 ${
                  settings.audioNormalization ? 'bg-[#D946EF]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform ${
                    settings.audioNormalization ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
