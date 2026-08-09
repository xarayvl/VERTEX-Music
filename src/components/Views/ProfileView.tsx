import React, { useEffect, useState, useRef } from 'react';
import {
  AtSign,
  BadgeInfo,
  User,
  Edit3,
  Clock,
  Music,
  Heart,
  Headphones,
  Download,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Settings,
  MoreHorizontal,
  Play,
  Camera,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Zap,
  Radio,
  SlidersHorizontal,
  BarChart3,
  Disc3,
  ListMusic,
  Eye,
  EyeOff,
  KeyRound,
  Laptop2,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  UserCog,
  Users,
  ImagePlus,
} from 'lucide-react';
import { UserProfile, Track, Playlist, Artist } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';
import { groupTracksByRelease } from '../../utils/artistUtils';

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
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
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
  tracks = [],
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
  onChangePassword,
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
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'information' | 'settings'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit profile form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingAvatarFile, setIsReadingAvatarFile] = useState(false);

  const resetProfileDraft = () => {
    if (!userProfile) return;
    setDisplayName(userProfile.displayName || '');
    setUsername(userProfile.username || '');
    setBio(userProfile.bio || '');
    setAvatarUrl(userProfile.avatarUrl || '');
  };

  useEffect(() => {
    if (!userProfile || isEditing) return;
    resetProfileDraft();
  }, [userProfile?.id, userProfile?.displayName, userProfile?.username, userProfile?.bio, userProfile?.avatarUrl, isEditing]);

  const openProfileEditor = () => {
    if (!isEditing) resetProfileDraft();
    setActiveSubTab('settings');
    setIsEditing(true);
  };

  const closeProfileEditor = () => {
    resetProfileDraft();
    setIsEditing(false);
  };


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
      avatarUrl,
    });
    setIsEditing(false);
  };


  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({ type: 'error', message: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'Your new password must contain at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'The new passwords do not match.' });
      return;
    }
    if (!onChangePassword) {
      setPasswordStatus({ type: 'error', message: 'Password changes are unavailable right now.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await onChangePassword(currentPassword, newPassword);
      if (!result.success) {
        setPasswordStatus({ type: 'error', message: result.error || 'Could not update your password.' });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
    } finally {
      setIsChangingPassword(false);
    }
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
      <div className="mx-auto my-6 flex min-h-[52vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#181818] p-6 text-center shadow-2xl animate-in fade-in duration-300 sm:my-12 sm:min-h-[60vh] sm:p-8">
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
    <div className="no-button-lift w-full min-w-0 max-w-full overflow-x-hidden pb-20 select-none touch-pan-y animate-in fade-in duration-300">
      {/* SPOTIFY PROFILE HERO BANNER */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#A855F7]/30 via-[#181818] to-[#121212] p-4 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:gap-8 md:flex-row md:items-end">
          {/* Circular Avatar with Edit Overlay */}
          <div
            onClick={openProfileEditor}
            className="group relative h-32 w-32 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-4 border-black/40 shadow-2xl sm:h-44 sm:w-44"
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
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                PROFILE
              </span>
            </div>

            <h1 className="max-w-full break-words text-3xl font-black leading-tight tracking-tight text-white drop-shadow-md [overflow-wrap:anywhere] sm:text-6xl md:text-7xl">
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
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6 md:justify-start md:pt-8">
          {onSelectArtist && (
            <button
              data-artist-id={userProfile.id}
              data-context-type="artist"
              onClick={() => onSelectArtist(userProfile)}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-4 py-2.5 text-xs font-extrabold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 sm:flex-none sm:px-5"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>View Artist Page</span>
            </button>
          )}

          <button
            onClick={openProfileEditor}
            className="min-w-0 flex-1 rounded-full border border-zinc-500 px-4 py-2.5 text-xs font-bold text-white transition-all hover:border-white active:scale-95 sm:flex-none sm:px-5"
          >
            {isEditing ? 'Continue Editing' : 'Edit Profile'}
          </button>

        </div>
      </div>

      {/* Profile workspace navigation */}
      <div className="mb-7 grid max-w-full grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.08] bg-[#181818] p-2 shadow-xl sm:gap-2">
        {([
          { key: 'overview', label: 'Overview & Listening', mobileLabel: 'Overview', icon: Headphones },
          { key: 'information', label: 'Account Information', mobileLabel: 'Info', icon: BadgeInfo },
          { key: 'settings', label: 'Account Settings', mobileLabel: 'Settings', icon: Settings },
        ] as const).map(({ key, label, mobileLabel, icon: Icon }) => {
          const active = activeSubTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSubTab(key)}
              className={`control-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-black transition-all sm:gap-2 sm:px-4 sm:text-xs ${
                active
                  ? 'border-[#C084FC]/50 bg-gradient-to-r from-[#A855F7]/30 to-[#D946EF]/20 text-white shadow-[0_10px_28px_rgba(168,85,247,0.14)]'
                  : 'border-transparent text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.055] hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#F0ABFC]' : 'text-zinc-500'}`} />
              <span className="min-w-0 truncate sm:hidden">{mobileLabel}</span>
              <span className="hidden min-w-0 truncate sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: OVERVIEW & ANALYTICS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in">
          {/* Listening Stats Cards */}
          <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
            <div className="min-w-0 space-y-1 overflow-hidden rounded-xl border border-white/5 bg-[#181818] p-3 sm:p-4">
              <div className="flex min-w-0 items-start justify-between gap-2 text-zinc-400">
                <span className="min-w-0 text-[9px] font-bold uppercase leading-4 sm:text-[11px]">Hours Listened</span>
                <Clock className="h-4 w-4 shrink-0 text-[#D946EF]" />
              </div>
              <p className="break-words text-xl font-black text-white sm:text-2xl">{computedHours} hrs</p>
              <p className="break-words text-[9px] leading-4 text-zinc-500 sm:text-[10px]">{secondsListened > 0 ? 'Active streaming time' : 'No activity logged'}</p>
            </div>

            <div className="min-w-0 space-y-1 overflow-hidden rounded-xl border border-white/5 bg-[#181818] p-3 sm:p-4">
              <div className="flex min-w-0 items-start justify-between gap-2 text-zinc-400">
                <span className="min-w-0 text-[9px] font-bold uppercase leading-4 sm:text-[11px]">Tracks Streamed</span>
                <Music className="h-4 w-4 shrink-0 text-[#D946EF]" />
              </div>
              <p className="break-words text-xl font-black text-white sm:text-2xl">{tracksPlayedCount.toLocaleString()}</p>
              <p className="break-words text-[9px] leading-4 text-zinc-500 sm:text-[10px]">{tracksPlayedCount > 0 ? 'Based on saved play history' : 'No tracks played yet'}</p>
            </div>

            <div className="min-w-0 space-y-1 overflow-hidden rounded-xl border border-white/5 bg-[#181818] p-3 sm:p-4">
              <div className="flex min-w-0 items-start justify-between gap-2 text-zinc-400">
                <span className="min-w-0 text-[9px] font-bold uppercase leading-4 sm:text-[11px]">Top Genre</span>
                <Zap className="h-4 w-4 shrink-0 text-amber-400" />
              </div>
              <p className="text-lg font-black text-white truncate">{calculatedTopGenre}</p>
              <p className="break-words text-[9px] leading-4 text-zinc-500 sm:text-[10px]">{topGenrePercentage > 0 ? `${topGenrePercentage}% of listening time` : '0% of listening time'}</p>
            </div>

            <div className="min-w-0 space-y-1 overflow-hidden rounded-xl border border-white/5 bg-[#181818] p-3 sm:p-4">
              <div className="flex min-w-0 items-start justify-between gap-2 text-zinc-400">
                <span className="min-w-0 text-[9px] font-bold uppercase leading-4 sm:text-[11px]">Playlists</span>
                <BarChart3 className="h-4 w-4 shrink-0 text-cyan-400" />
              </div>
              <p className="break-words text-xl font-black text-white sm:text-2xl">{realPlaylistsCount}</p>
              <p className="break-words text-[9px] leading-4 text-zinc-500 sm:text-[10px]">Created by you</p>
            </div>
          </div>

          {/* MY UPLOADED SONGS & ARTIST RELEASES SECTION */}
          <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-[#181818]/80 p-4 shadow-xl sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="min-w-0 text-lg font-black tracking-tight text-white sm:text-xl">My Uploaded Songs & Releases</h2>
                </div>
                <p className="text-xs text-zinc-400">Songs uploaded to your user folder persist across session reloads.</p>
              </div>

              {onOpenAddTrackModal && (
                <button
                  onClick={onOpenAddTrackModal}
                  className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-4 py-2 text-xs font-black text-white shadow-lg transition-all hover:opacity-90 active:scale-95 sm:w-auto"
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
              const uploadedReleases = groupTracksByRelease(myUploadedTracks);

              if (myUploadedTracks.length === 0) {
                return (
                  <div className="p-6 text-center bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <Music className="w-8 h-8 mx-auto text-zinc-500" />
                    <p className="text-sm font-bold text-white">No uploaded songs yet</p>
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
                <div className="space-y-3">
                  {uploadedReleases.map((release, releaseIndex) => {
                    const isCollection = release.tracks.length > 1 || release.releaseType !== 'Single';
                    const representative = release.representative;
                    return (
                      <article
                        key={release.key}
                        data-track-id={representative.id}
                        data-context-type="track"
                        style={{ '--stagger-index': releaseIndex } as React.CSSProperties}
                        className="stagger-item overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121212] shadow-lg transition-colors hover:border-white/[0.14]"
                      >
                        <div className="flex items-center gap-3 p-3 sm:p-4">
                          <button
                            type="button"
                            onClick={() => onPlayTrack(representative)}
                            className="control-press relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg"
                            aria-label={`Play ${release.title}`}
                          >
                            <img src={release.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity hover:opacity-100">
                              <Play className="h-5 w-5 fill-white text-white" />
                            </span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isCollection ? <Disc3 className="h-3.5 w-3.5 shrink-0 text-[#D946EF]" /> : <Music className="h-3.5 w-3.5 shrink-0 text-[#D946EF]" />}
                              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#D8B4FE]">{release.releaseType}</span>
                            </div>
                            <p className="mt-1 truncate text-sm font-black text-white">{release.title}</p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-zinc-500">
                              <span>{release.tracks.length} track{release.tracks.length === 1 ? '' : 's'}</span>
                              <span>•</span>
                              <span>{representative.releaseYear || new Date(representative.createdAt || Date.now()).getFullYear()}</span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {onEditTrack && (
                              <button
                                type="button"
                                onClick={() => onEditTrack(representative)}
                                className="control-press flex items-center gap-2 rounded-xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-3 py-2 text-[10px] font-black text-[#F0ABFC] hover:bg-[#D946EF]/20"
                                title={isCollection ? 'Edit release and tracklist' : 'Edit track'}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{isCollection ? 'Edit release' : 'Edit'}</span>
                              </button>
                            )}
                            {!isCollection && onDeleteTrack && (
                              <button type="button" onClick={() => onDeleteTrack(representative.id)} className="control-press rounded-xl p-2 text-zinc-500 hover:bg-red-400/10 hover:text-red-300" title="Delete track">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isCollection && (
                          <div className="border-t border-white/[0.06] bg-black/15 px-2 py-2 sm:px-3">
                            <div className="mb-1 flex items-center gap-2 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                              <ListMusic className="h-3 w-3" /> Tracklist
                            </div>
                            {release.tracks.map((releaseTrack, trackIndex) => (
                              <div key={releaseTrack.id} data-track-id={releaseTrack.id} data-context-type="track" className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.055]">
                                <button type="button" onClick={() => onPlayTrack(releaseTrack)} className="control-press flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.055] text-zinc-400 hover:bg-[#D946EF]/15 hover:text-[#F0ABFC]" aria-label={`Play ${releaseTrack.title}`}>
                                  <Play className="h-3 w-3 fill-current" />
                                </button>
                                <span className="w-5 shrink-0 text-center font-mono text-[10px] text-zinc-600">{releaseTrack.trackNumber || trackIndex + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-zinc-200">{releaseTrack.title}</p>
                                  <p className="truncate text-[9px] text-zinc-600">{releaseTrack.genre || 'No genre'}</p>
                                </div>
                                <span className="hidden font-mono text-[10px] text-zinc-600 sm:block">{Math.floor(releaseTrack.duration / 60)}:{Math.floor(releaseTrack.duration % 60).toString().padStart(2, '0')}</span>
                                {onDeleteTrack && (
                                  <button type="button" onClick={() => onDeleteTrack(releaseTrack.id)} className="control-press rounded-lg p-1.5 text-zinc-600 opacity-100 hover:bg-red-400/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100" title="Delete track">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
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
                    data-track-id={track.id}
                    data-context-type="track"
                    onClick={() => onPlayTrack(track)}
                    className="group flex cursor-pointer items-center justify-between gap-2 px-3 py-3 transition-colors hover:bg-white/10 sm:px-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
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
                        <p className="truncate text-sm font-extrabold tracking-tight text-white">{track.title}</p>
                        <p className="truncate text-xs text-zinc-400">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-6">
                      <span className="hidden sm:inline text-xs font-mono text-zinc-400">
                        {track.plays ? `${Number(track.plays).toLocaleString()} plays` : '0 plays'}
                      </span>

                      <button
                        onClick={(event) => { event.stopPropagation(); onToggleLike(track.id); }}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                          track.isLiked
                            ? 'text-[#D946EF]'
                            : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${track.isLiked ? 'fill-[#D946EF]' : ''}`}
                        />
                      </button>

                      <span className="hidden font-mono text-xs text-zinc-400 sm:inline">{`${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, '0')}`}</span>
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5">
                  {personalTopArtists.map(({ profile: artist, fallbackAvatar }, idx) => (
                    <div
                      key={artist.id}
                      data-artist-id={artist.id}
                      data-context-type="artist"
                      onClick={() => onSelectArtist && onSelectArtist(artist)}
                      style={{ '--stagger-index': idx } as React.CSSProperties}
                      className="stagger-item card-interactive group flex cursor-pointer flex-col items-center space-y-3 rounded-xl border border-white/5 bg-[#181818] p-3 text-center transition-all hover:bg-[#282828] sm:p-4"
                    >
                      <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-xl font-black text-white shadow-lg transition-transform duration-300 group-hover:scale-105">
                        <ReliableArtistImage
                          src={artist.avatarUrl}
                          fallbackSrc={fallbackAvatar}
                          alt={artist.name}
                        />
                      </div>
                      <div className="w-full min-w-0">
                        <h3 className="w-full truncate text-sm font-extrabold tracking-tight text-white">
                          {artist.name}
                        </h3>
                        <p className="text-xs text-zinc-400">Artist</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* ACCOUNT INFORMATION */}
      {activeSubTab === 'information' && (
        <div className="animate-in space-y-6 fade-in">
          <header className="workspace-header flex items-center gap-4 border-b border-white/10 pb-6">
            <BadgeInfo className="h-7 w-7 shrink-0 text-[#D946EF]" />
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Account information</h2>
            </div>
          </header>

          <div className="grid items-start gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="workspace-card section-reveal overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <img src={userProfile.avatarUrl || DEFAULT_AVATAR_URL} alt={userProfile.displayName} className="h-24 w-24 shrink-0 rounded-3xl border-2 border-[#D946EF]/50 object-cover shadow-2xl" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-2xl font-black tracking-tight text-white">{userProfile.displayName}</h3>
                  <p className="mt-1 truncate text-xs font-semibold text-zinc-400">@{userProfile.username}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2 border-t border-white/10 pt-5">
                {[
                  { label: 'Email address', value: userProfile.email, icon: Mail },
                  { label: 'Username', value: `@${userProfile.username}`, icon: User },
                  { label: 'Account ID', value: userProfile.id, icon: ShieldCheck },
                  { label: 'Joined', value: userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unavailable', icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#E879F9]"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                      <p className="mt-0.5 truncate text-xs font-bold text-zinc-200" title={value}>{value}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-6">
              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Account snapshot</p>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-white">Your activity</h3>
                  </div>
                  <BarChart3 className="h-5 w-5 text-[#D946EF]" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Owned playlists', value: realPlaylistsCount, icon: ListMusic },
                    { label: 'Saved plays', value: tracksPlayedCount.toLocaleString(), icon: Play },
                    { label: 'Followers', value: followersCount.toLocaleString(), icon: Users },
                    { label: 'Following', value: followingCount.toLocaleString(), icon: User },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                      <Icon className="h-4 w-4 text-[#E879F9]" />
                      <p className="mt-3 text-xl font-black text-white">{value}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="workspace-card section-reveal rounded-3xl border border-[#D946EF]/20 bg-[#D946EF]/[0.07] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D946EF]/15 text-[#F0ABFC]"><UserCog className="h-5 w-5" /></div>
                  <div><h3 className="text-sm font-black text-white">Need to make a change?</h3><p className="mt-0.5 text-xs text-zinc-400">Profile and security controls are separated for clarity.</p></div>
                </div>
                <button onClick={() => setActiveSubTab('settings')} className="control-press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-4 py-3 text-xs font-black text-[#F0ABFC] hover:bg-[#D946EF]/15">
                  Open account settings <Settings className="h-4 w-4" />
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="animate-in space-y-6 fade-in">
          <header className="workspace-header flex min-w-0 items-center gap-3 border-b border-white/10 pb-5 sm:gap-4 sm:pb-6">
            <Settings className="h-7 w-7 shrink-0 text-[#D946EF]" />
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight sm:text-3xl">Account settings</h2>
            </div>
          </header>

          {isEditing && (
            <form onSubmit={handleSaveProfile} className="workspace-card section-reveal min-w-0 max-w-full overflow-hidden rounded-3xl border border-[#D946EF]/25 bg-[#181818] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
              <div className="flex min-w-0 items-start justify-between gap-2.5 border-b border-white/10 bg-gradient-to-r from-[#2a1833] via-[#201723] to-[#181818] px-4 py-4 sm:gap-4 sm:px-7 sm:py-6">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white shadow-[0_12px_32px_rgba(168,85,247,0.25)] sm:h-11 sm:w-11">
                    <Edit3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#D8B4FE] sm:text-[9px] sm:tracking-[0.22em]">Public profile</p>
                    <h3 className="mt-1 text-base font-black tracking-tight text-white sm:text-xl">Edit profile details</h3>
                    <p className="mt-1 text-[10px] leading-4 text-zinc-400 sm:text-xs">Changes update your listener profile and artist identity.</p>
                  </div>
                </div>
                <button type="button" onClick={closeProfileEditor} className="control-press shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white sm:p-2.5" aria-label="Close profile editor">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-w-0 items-start gap-4 p-3 sm:gap-6 sm:p-7 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#26182f] to-[#121212] p-4 sm:p-6">
                  <div className="relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-2xl">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#A855F7]/25 via-transparent to-[#D946EF]/15" />
                    <img
                      src={avatarUrl || DEFAULT_AVATAR_URL}
                      alt="Profile preview"
                      onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR_URL; }}
                      className="relative h-[72%] w-[72%] rounded-full border-4 border-[#D946EF]/60 object-cover shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
                    />
                    <span className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#F0ABFC]">Live preview</span>
                  </div>

                  <div className="mt-5 text-center">
                    <h4 className="truncate text-xl font-black tracking-tight text-white">{displayName.trim() || 'Your display name'}</h4>
                    <p className="mt-1 truncate text-xs font-semibold text-zinc-500">@{username.trim() || 'username'}</p>
                    <p className="mx-auto mt-3 line-clamp-3 max-w-sm text-xs leading-5 text-zinc-400">{bio.trim() || 'Add a short bio to introduce yourself.'}</p>
                  </div>

                  <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileUpload} className="hidden" />
                  <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <button type="button" onClick={() => avatarFileInputRef.current?.click()} disabled={isReadingAvatarFile} className="control-press flex items-center justify-center gap-2 rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-3 py-3 text-xs font-black text-[#F0ABFC] hover:bg-[#D946EF]/15 disabled:opacity-50">
                      <ImagePlus className="h-4 w-4" /> {isReadingAvatarFile ? 'Reading photo…' : 'Choose photo'}
                    </button>
                    <button type="button" onClick={() => setAvatarUrl('')} className="control-press rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-xs font-bold text-zinc-400 hover:bg-white/[0.08] hover:text-white">Remove photo</button>
                  </div>
                  <p className="mt-3 text-center text-[9px] font-semibold leading-4 text-zinc-600">JPG, PNG, WebP or GIF. Uploaded photos are stored with your account.</p>
                </section>

                <section className="min-w-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-black/15 p-4 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Display name</span>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                        <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required className="min-w-0 w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10" />
                      </div>
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Username</span>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                        <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]{3,32}" title="Use 3–32 letters, numbers, dots, underscores or hyphens" required className="min-w-0 w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10" />
                      </div>
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400"><span>Bio / status</span><span className="text-[9px] font-bold normal-case tracking-normal text-zinc-600">{bio.length}/500</span></span>
                    <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={4} placeholder="Tell listeners a little about yourself..." className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm leading-6 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10" />
                  </label>

                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={closeProfileEditor} className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white">Cancel</button>
                    <button type="submit" disabled={!displayName.trim() || !username.trim()} className="control-press flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-6 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"><Save className="h-4 w-4" /> Save profile</button>
                  </div>
                </section>
              </div>
            </form>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-6">
              {!isEditing && <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <img src={userProfile.avatarUrl || DEFAULT_AVATAR_URL} alt="" className="h-16 w-16 rounded-2xl border border-white/10 object-cover shadow-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D8B4FE]">Public identity</p>
                    <h3 className="mt-1 truncate text-lg font-black text-white">{userProfile.displayName}</h3>
                    <p className="truncate text-xs text-zinc-500">@{userProfile.username}</p>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-zinc-400">Change your photo, display name, username and bio from the profile editor.</p>
                <button
                  onClick={openProfileEditor}
                  className="control-press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-4 py-3 text-xs font-black text-[#F0ABFC] hover:bg-[#D946EF]/15"
                >
                  <Edit3 className="h-4 w-4" /> Edit profile details
                </button>
              </section>}

              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Laptop2 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-white">This browser</h3><span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">Active now</span></div>
                    <p className="mt-1 text-xs text-zinc-500">Web Player session for @{userProfile.username}</p>
                  </div>
                </div>
                <button onClick={onLogout} className="control-press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-black text-red-300 hover:bg-red-500/15">
                  <LogOut className="h-4 w-4" /> Log out of this session
                </button>
              </section>
            </div>

            <form onSubmit={handleChangePassword} className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D8B4FE]">Login & security</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">Change password</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Confirm your current password before choosing a new one.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#A855F7]/15 text-[#E879F9]"><LockKeyhole className="h-5 w-5" /></div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  { label: 'Current password', value: currentPassword, setter: setCurrentPassword, autoComplete: 'current-password' },
                  { label: 'New password', value: newPassword, setter: setNewPassword, autoComplete: 'new-password' },
                  { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword, autoComplete: 'new-password' },
                ].map(({ label, value, setter, autoComplete }) => (
                  <label key={label} className="block">
                    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</span>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={value}
                        onChange={(event) => { setter(event.target.value); setPasswordStatus(null); }}
                        autoComplete={autoComplete}
                        maxLength={128}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3.5 pl-11 pr-12 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10"
                      />
                      <button type="button" onClick={() => setShowPasswords((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white" aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}>
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-[10px] leading-5 text-zinc-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D946EF]" /> Use at least 8 characters. Your password is securely hashed and is never shown in your profile.
              </div>

              {passwordStatus && (
                <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${passwordStatus.type === 'success' ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200' : 'border-red-400/25 bg-red-400/[0.08] text-red-200'}`}>
                  {passwordStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                  {passwordStatus.message}
                </div>
              )}

              <div className="mt-6 flex justify-end border-t border-white/10 pt-5">
                <button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword} className="control-press flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-6 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
                  {isChangingPassword ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Updating…</> : <><Save className="h-4 w-4" /> Update password</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
