import { getArtistStats, groupTracksByRelease } from "../../utils/artistUtils";
import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  Shuffle,
  ShieldCheck,
  Sparkles,
  Music,
  Disc,
  Radio,
  User,
  Check,
  Plus,
  ArrowLeft,
  Instagram,
  Twitter,
  Globe,
  Edit3,
} from 'lucide-react';
import { Artist, UserProfile, Track, Playlist } from '../../types';
import { EditArtistModal } from '../Modals/EditArtistModal';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

interface ArtistViewProps {
  artist: Artist | UserProfile | null;
  allTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onSelectAlbum?: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onSelectArtist?: (artist: Artist | UserProfile) => void;
  onSelectPlaylist?: (playlist: Playlist) => void;
  onGoBack?: () => void;
  userProfile?: UserProfile | null;
  onUpdateArtist?: (updatedData: {
    artistName: string;
    artistBio: string;
    avatarUrl: string;
    bannerUrl: string;
    genre: string;
    artistVerified: boolean;
    monthlyListeners: string;
    instagramUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
  }) => void;
  onShufflePlay?: (tracks: Track[]) => void;
  isFollowing?: boolean;
  onToggleFollow?: (artist: Artist | UserProfile) => void;
  isLoading?: boolean;
  loadError?: string | null;
}

export const ArtistView: React.FC<ArtistViewProps> = ({
  artist,
  allTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onSelectAlbum,
  onToggleLike,
  onSelectArtist,
  onGoBack,
  userProfile,
  onUpdateArtist,
  onShufflePlay,
  isFollowing = false,
  onToggleFollow,
  isLoading = false,
  loadError = null,
}) => {
  const [discographyFilter, setDiscographyFilter] = useState<'popular' | 'albums' | 'singles'>('popular');
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24 animate-pulse" aria-label="Loading artist profile">
        <div className="h-[380px] rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-white/10 p-10 flex flex-col justify-end gap-4">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-16 w-2/3 rounded-xl bg-white/10" />
          <div className="h-4 w-56 rounded bg-white/10" />
        </div>
        <div className="h-16 w-64 rounded-full bg-white/10" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-white/5 border border-white/5" />
          <div className="h-72 rounded-2xl bg-white/5 border border-white/5" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 text-zinc-400">
        <User className="w-12 h-12 mb-3 text-zinc-600" />
        <p className="text-base font-bold text-white">Artist profile unavailable</p>
        <p className="text-xs text-zinc-500 mt-1">
          {loadError || 'Select an artist from Search, Home, or Profile to view their page.'}
        </p>
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="mt-4 px-4 py-2 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/20"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  // Determine normalized properties whether artist is an Artist object or UserProfile
  const isUserProfile = 'email' in artist;
  
  let artistName = '';
  if (!isUserProfile) {
    artistName = (artist as Artist).name;
  } else {
    const p = artist as UserProfile;
    artistName = p.artistName || p.displayName || p.username || (p.email ? p.email.split('@')[0] : 'Artist');
  }

  const avatarUrl = isUserProfile
    ? ((artist as UserProfile).avatarUrl || DEFAULT_AVATAR_URL)
    : ((artist as Artist).avatarUrl || DEFAULT_AVATAR_URL);

  const bannerUrl = isUserProfile
    ? ((artist as UserProfile).bannerUrl || '')
    : ((artist as Artist).bannerUrl || '');

  const bio = isUserProfile
    ? (artist as UserProfile).artistBio || (artist as UserProfile).bio || 'No artist biography has been added yet.'
    : (artist as Artist).bio || ((artist as Artist).isSynthetic
      ? 'This catalog artist is not linked to a registered user profile.'
      : 'No artist biography has been added yet.');

  const isVerified = isUserProfile
    ? (artist as UserProfile).artistVerified === true
    : (artist as Artist).verified === true;

  const profileStats = artist.stats;
  const followersCount = profileStats?.followersCount || 0;
  const followingCount = profileStats?.followingCount || 0;
  const isSyntheticArtist = !isUserProfile && (artist as Artist).isSynthetic === true;

  // NOTE: ownership must be decided by id only. An earlier version also
  // matched by comparing artistName to the logged-in user's displayName,
  // which meant that if your own display name happened to match some OTHER
  // artist's name (a different registered user, or just a track's artist
  // string), you'd see Edit controls on THEIR page — even though it isn't
  // your account.
  const isOwner = Boolean(userProfile && artist && artist.id === userProfile.id);

  // Get unified stats from global helper
  const { totalPlays: totalArtistPlays, monthlyListenersStr: monthlyListeners, artistTracks } = getArtistStats(artist, allTracks);

  // Display tracks belong strictly to this artist
  const displayTracks = artistTracks;

  const topTracks = showAllPopular ? displayTracks : displayTracks.slice(0, 5);

  // Group tracks that were uploaded together as one album/EP so the
  // discography grid shows a single card per release instead of one
  // card per track.
  const releaseGroups = groupTracksByRelease(displayTracks);
  
  const artistPickTrackId = artist.artistPickTrackId;
  const artistPickComment = artist.artistPickComment;

  const featuredTrack = artistPickTrackId
    ? (displayTracks.find((t) => t.id === artistPickTrackId) || (displayTracks.length > 0 ? displayTracks[0] : undefined))
    : (displayTracks.length > 0 ? displayTracks[0] : undefined);

  const instagramUrl = artist.instagramUrl;
  const twitterUrl = artist.twitterUrl;
  const websiteUrl = artist.websiteUrl;

  const handlePlayArtist = () => {
    if (displayTracks.length > 0) {
      onPlayTrack(displayTracks[0]);
    }
  };

  return (
    <div className="space-y-8 pb-24 select-none animate-in fade-in duration-300">
      {loadError && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
          {loadError}
        </div>
      )}
      {/* Back Button Header */}
      {onGoBack && (
        <button
          onClick={onGoBack}
          className="flex items-center space-x-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors pt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* SPOTIFY HERO ARTIST BANNER */}
      <div className="relative rounded-2xl overflow-hidden min-h-[320px] sm:min-h-[380px] flex flex-col justify-end p-6 sm:p-10 border border-white/10 shadow-2xl group bg-gradient-to-br from-[#312e81] via-[#581c87] to-[#111827]">
        {/* Background Image & Dynamic Gradient Overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={bannerUrl ? {
            backgroundImage: `url(${bannerUrl})`,
            filter: 'brightness(0.65) saturate(1.2)',
          } : undefined}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />

        {/* Hero Artist Info */}
        <div className="relative z-20 space-y-3">
          {/* Verified Badge */}
          {isVerified && (
            <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-xs">
              <ShieldCheck className="w-5 h-5 fill-blue-500 text-black" />
              <span className="text-white font-extrabold text-xs uppercase tracking-wider">
                Verified Artist
              </span>
            </div>
          )}

          {/* Massive Artist Name */}
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-tight drop-shadow-2xl">
            {artistName}
          </h1>

          {/* Monthly Listeners Counter */}
          <p className="text-xs sm:text-sm font-semibold text-zinc-200 drop-shadow flex flex-wrap items-center gap-2">
            <span>{monthlyListeners}</span>
            <span className="text-zinc-400">•</span>
            <span>{followersCount.toLocaleString()} followers</span>
            <span className="text-zinc-400">•</span>
            <span>{followingCount.toLocaleString()} following</span>
            {isUserProfile && (
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white text-[10px] font-mono uppercase font-bold">
                User & Artist Profile
              </span>
            )}
          </p>
        </div>
      </div>

      {/* VERTEX ACTION BAR (Play Button, Follow, Edit Profile, Shuffle, Options) */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-2">
        {/* Play Button */}
        <button
          onClick={handlePlayArtist}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white flex items-center justify-center shadow-[0_8px_24px_rgba(217,70,239,0.4)] hover:scale-105 active:scale-95 transition-all"
          title={`Play ${artistName}`}
        >
          {isPlaying && displayTracks.some((t) => t.id === currentTrackId) ? (
            <Pause className="w-7 h-7 fill-white text-white" />
          ) : (
            <Play className="w-7 h-7 fill-white text-white ml-1" />
          )}
        </button>

        {/* Follow / Following Button */}
        {!isOwner && !isSyntheticArtist && (
          <button
            onClick={() => {
              if (onToggleFollow && artist) onToggleFollow(artist);
            }}
            className={`px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${
              isFollowing
                ? 'bg-transparent border border-white/40 text-white hover:border-white'
                : 'bg-transparent border border-[#D946EF] text-[#D946EF] hover:bg-[#D946EF]/10'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}

        {/* Edit Artist Profile Button (Owner Only) */}
        {isOwner && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg"
            title="Edit Artist Profile"
          >
            <Sparkles className="w-4 h-4 text-[#D946EF]" />
            <span>Edit Artist Profile</span>
          </button>
        )}

        {/* Shuffle Button */}
        <button
          onClick={() => {
            if (displayTracks.length === 0) return;
            if (onShufflePlay) {
              onShufflePlay(displayTracks);
            } else {
              // Fallback if no dedicated handler was wired up: pick a
              // genuinely random track rather than always track 0, so this
              // doesn't just re-toggle-pause whatever's already playing.
              const pool =
                isPlaying && currentTrackId && displayTracks.length > 1
                  ? displayTracks.filter((t) => t.id !== currentTrackId)
                  : displayTracks;
              const randomTrack = pool[Math.floor(Math.random() * pool.length)];
              onPlayTrack(randomTrack);
            }
          }}
          className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title="Shuffle Play"
        >
          <Shuffle className="w-6 h-6" />
        </button>

        {/* Context Options Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const event = new MouseEvent('contextmenu', {
              clientX: e.clientX,
              clientY: e.clientY,
              bubbles: true,
            });
            e.target?.dispatchEvent(event);
          }}
          data-artist-id={artist.id}
          data-context-type="artist"
          className="p-3 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title="More options"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      {/* MAIN CONTENT GRID (Popular Tracks + Artist Pick) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLUMNS: POPULAR TRACKS TABLE */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight">Popular</h2>

          {displayTracks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400 space-y-2">
              <Music className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-bold text-white">No tracks uploaded yet</p>
              <p className="text-xs text-zinc-500">This artist hasn't uploaded any music yet.</p>
            </div>
          ) : (
            <div className="bg-[#181818]/70 rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5 shadow-xl">
              {topTracks.map((track, index) => {
                const isCurrent = currentTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    data-track-id={track.id}
                    onClick={() => onPlayTrack(track)}
                    className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/10 group transition-colors cursor-pointer ${
                      isCurrent ? 'bg-white/10 text-[#D946EF]' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <span
                        className={`w-6 text-center text-xs font-mono ${
                          isCurrent ? 'text-[#D946EF] font-bold' : 'text-zinc-400 group-hover:hidden'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <span className="flex items-center justify-center space-x-0.5">
                            <span className="w-1 h-3 bg-[#D946EF] animate-bounce" />
                            <span className="w-1 h-4 bg-[#D946EF] animate-bounce delay-75" />
                            <span className="w-1 h-2 bg-[#D946EF] animate-bounce delay-150" />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayTrack(track);
                        }}
                        className="w-6 text-center hidden group-hover:block text-white"
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white" />
                        )}
                      </button>

                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded shadow object-cover flex-shrink-0"
                      />

                      <div className="min-w-0">
                        <p
                          className={`text-xs font-extrabold truncate ${
                            isCurrent ? 'text-[#D946EF]' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right w-24 flex-shrink-0">
                      <span className="text-xs font-mono text-zinc-400">
                        {track.plays ? `${Number(track.plays).toLocaleString()}` : '0'} plays
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-4 w-20 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track.id);
                        }}
                        className={`transition-colors ${
                          track.isLiked ? 'text-[#D946EF]' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-[#D946EF]' : ''}`} />
                      </button>

                      <span className="text-xs font-mono text-zinc-400 text-right min-w-[36px]">
                        {Math.floor(track.duration / 60)}:
                        {(track.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {displayTracks.length > 5 && (
            <button
              onClick={() => setShowAllPopular(!showAllPopular)}
              className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider pt-2"
            >
              {showAllPopular ? 'Show less' : 'See more'}
            </button>
          )}
        </div>

        {/* RIGHT COLUMN: ARTIST PICK CARD */}
        {featuredTrack && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-white tracking-tight">Artist Pick</h2>
            <div
              onClick={() => onPlayTrack(featuredTrack)}
              className="p-5 rounded-2xl bg-[#181818] border border-white/10 hover:border-white/20 transition-all cursor-pointer group space-y-4 shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <img
                  src={avatarUrl}
                  alt={artistName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
                <div className="text-xs">
                  <p className="text-zinc-400 text-[11px]">Posted by {artistName}</p>
                  <p className="font-extrabold text-white">{artistPickComment || 'Artist Pick'}</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <img
                  src={featuredTrack.coverUrl}
                  alt={featuredTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-sm font-black text-white truncate">{featuredTrack.title}</p>
                  <p className="text-xs text-zinc-400 truncate">{featuredTrack.album || 'Single'}</p>
                  <span className="mt-2 text-[10px] font-bold text-[#D946EF] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Latest Release
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DISCOGRAPHY SECTION */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Discography</h2>
          {displayTracks.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDiscographyFilter('popular')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  discographyFilter === 'popular'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                Popular releases
              </button>
              <button
                onClick={() => setDiscographyFilter('singles')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  discographyFilter === 'singles'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                Singles & EPs
              </button>
            </div>
          )}
        </div>

        {displayTracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400 space-y-2">
            <Disc className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-bold text-white">No tracks uploaded yet</p>
            <p className="text-xs text-zinc-500">This artist hasn't uploaded any music yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(discographyFilter === 'singles'
              ? releaseGroups.filter((g) => g.releaseType === 'Single' || g.releaseType === 'EP')
              : releaseGroups
            ).map((group) => {
              const isThisGroupPlaying = group.tracks.some((t) => t.id === currentTrackId) && isPlaying;
              return (
                <div
                  key={group.key}
                  onClick={() => {
                    if (group.isMultiTrack && onSelectAlbum) {
                      onSelectAlbum(group.representative);
                    } else {
                      onPlayTrack(group.representative);
                    }
                  }}
                  className="p-3.5 rounded-xl bg-[#181818] hover:bg-[#282828] transition-all group cursor-pointer border border-white/5 space-y-3"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden shadow-lg">
                    <img
                      src={group.coverUrl}
                      alt={group.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(group.representative);
                      }}
                      className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#D946EF] text-white flex items-center justify-center shadow-2xl transition-all transform ${
                        isThisGroupPlaying
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
                      }`}
                    >
                      {isThisGroupPlaying ? (
                        <Pause className="w-5 h-5 fill-white" />
                      ) : (
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-white truncate">{group.title}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {group.releaseType}
                      {group.isMultiTrack ? ` • ${group.tracks.length} songs` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SPOTIFY ABOUT SECTION */}
      <div className="space-y-4 pt-4">
        <h2 className="text-2xl font-black text-white tracking-tight">About</h2>
        <div className="relative rounded-2xl overflow-hidden p-8 sm:p-10 bg-[#181818] border border-white/10 shadow-2xl group cursor-pointer">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                <img
                  src={avatarUrl}
                  alt={artistName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xl font-black text-white">{monthlyListeners}</p>
                <p className="text-xs text-zinc-400">Streaming Listeners on VERTEX</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-4">
              {bio}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isVerified && (
                <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold border border-white/10">
                  Verified Artist
                </span>
              )}
              {isSyntheticArtist && (
                <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-200 text-xs font-bold border border-amber-400/20">
                  Unclaimed Catalog Artist
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-[#D946EF]/20 text-[#D946EF] text-xs font-bold border border-[#D946EF]/30">
                Studio FLAC Audio
              </span>

              {instagramUrl && (
                <a
                  href={instagramUrl.startsWith('http') ? instagramUrl : `https://instagram.com/${instagramUrl.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-pink-400 font-bold border border-white/10 transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>{instagramUrl.startsWith('@') ? instagramUrl : `@${instagramUrl}`}</span>
                </a>
              )}

              {twitterUrl && (
                <a
                  href={twitterUrl.startsWith('http') ? twitterUrl : `https://twitter.com/${twitterUrl.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-sky-400 font-bold border border-white/10 transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5" />
                  <span>{twitterUrl.startsWith('@') ? twitterUrl : `@${twitterUrl}`}</span>
                </a>
              )}

              {websiteUrl && (
                <a
                  href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-[#D946EF] font-bold border border-white/10 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Official Site</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Artist Profile Modal */}
      <EditArtistModal
        isOpen={isEditModalOpen}
        artist={artist}
        artistTracks={artistTracks}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updatedData) => {
          if (onUpdateArtist) {
            onUpdateArtist(updatedData);
          }
        }}
      />
    </div>
  );
};
