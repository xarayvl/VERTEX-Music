import { getArtistStats, groupTracksByRelease } from "../../utils/artistUtils";
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Copy,
  ExternalLink,
  UserPlus,
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
    instagramUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    artistPickTrackId?: string;
    artistPickComment?: string;
  }) => void;
  isShuffle?: boolean;
  onToggleShuffle?: (tracks: Track[]) => void;
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
  isShuffle = false,
  onToggleShuffle,
  isFollowing = false,
  onToggleFollow,
  isLoading = false,
  loadError = null,
}) => {
  const [discographyFilter, setDiscographyFilter] = useState<'popular' | 'singles'>('popular');
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArtistMenuOpen, setIsArtistMenuOpen] = useState(false);
  const artistMenuButtonRef = useRef<HTMLButtonElement>(null);
  const artistMenuPanelRef = useRef<HTMLDivElement>(null);
  const [artistMenuPosition, setArtistMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setIsArtistMenuOpen(false);
  }, [artist?.id]);

  useEffect(() => {
    if (!isArtistMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!artistMenuButtonRef.current?.contains(target) && !artistMenuPanelRef.current?.contains(target)) {
        setIsArtistMenuOpen(false);
      }
    };
    const closeMenu = () => setIsArtistMenuOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [isArtistMenuOpen]);

  useLayoutEffect(() => {
    if (!isArtistMenuOpen || !artistMenuButtonRef.current || !artistMenuPanelRef.current) return;
    const buttonRect = artistMenuButtonRef.current.getBoundingClientRect();
    const panelRect = artistMenuPanelRef.current.getBoundingClientRect();
    const padding = 12;
    const left = Math.min(Math.max(padding, buttonRect.left), window.innerWidth - panelRect.width - padding);
    const preferredTop = buttonRect.bottom + 8;
    const top = preferredTop + panelRect.height <= window.innerHeight - padding
      ? preferredTop
      : Math.max(padding, buttonRect.top - panelRect.height - 8);
    setArtistMenuPosition({ top, left });
  }, [isArtistMenuOpen]);

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
          {loadError || '404 — Artist not found.'}
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
    : (artist as Artist).bio || 'No artist biography has been added yet.';

  const isVerified = isUserProfile
    ? (artist as UserProfile).artistVerified === true
    : (artist as Artist).verified === true;

  const profileStats = artist.stats;

  // NOTE: ownership must be decided by id only. An earlier version also
  // matched by comparing artistName to the logged-in user's displayName,
  // which meant that if your own display name happened to match some OTHER
  // artist's name (a different registered user, or just a track's artist
  // string), you'd see Edit controls on THEIR page — even though it isn't
  // your account.
  const isOwner = Boolean(userProfile && artist && artist.id === userProfile.id);

  // Get unified stats from global helper
  const { totalPlays: totalArtistPlays, totalStreamsLabel, artistTracks } = getArtistStats(artist, allTracks);

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
    ? displayTracks.find((track) => track.id === artistPickTrackId)
    : displayTracks[0];

  const instagramUrl = artist.instagramUrl;
  const twitterUrl = artist.twitterUrl;
  const websiteUrl = artist.websiteUrl;

  const closeArtistMenu = () => setIsArtistMenuOpen(false);

  const toggleArtistMenu = () => {
    if (!isArtistMenuOpen && artistMenuButtonRef.current) {
      const rect = artistMenuButtonRef.current.getBoundingClientRect();
      setArtistMenuPosition({ top: rect.bottom + 8, left: Math.max(12, rect.left) });
    }
    setIsArtistMenuOpen((open) => !open);
  };

  const copyArtistLink = async () => {
    const link = `${window.location.origin}/artist/${artist.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement('textarea');
      input.value = link;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    closeArtistMenu();
  };

  const openArtistUrl = (value: string, provider: 'instagram' | 'twitter' | 'website') => {
    const normalized = value.startsWith('http')
      ? value
      : provider === 'instagram'
        ? `https://instagram.com/${value.replace('@', '')}`
        : provider === 'twitter'
          ? `https://twitter.com/${value.replace('@', '')}`
          : `https://${value}`;
    window.open(normalized, '_blank', 'noopener,noreferrer');
    closeArtistMenu();
  };

  const handlePlayArtist = () => {
    if (displayTracks.length > 0) {
      onPlayTrack(displayTracks[0]);
    }
  };

  if (isEditModalOpen) {
    return (
      <EditArtistModal
        isOpen
        artist={artist}
        artistTracks={artistTracks}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updatedData) => {
          onUpdateArtist?.(updatedData);
        }}
      />
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24 select-none touch-pan-y animate-in fade-in duration-300 sm:space-y-8">
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
      <div data-artist-id={artist.id} data-context-type="artist" className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#312e81] via-[#581c87] to-[#111827] p-5 shadow-2xl sm:min-h-[380px] sm:p-10">
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
          <h1 className="max-w-full break-words text-3xl font-black leading-[1.05] tracking-tight text-white drop-shadow-2xl [overflow-wrap:anywhere] sm:text-6xl md:text-8xl">
            {artistName}
          </h1>

          {/* Monthly Listeners Counter */}
          <p className="text-xs sm:text-sm font-semibold text-zinc-200 drop-shadow flex flex-wrap items-center gap-2">
            <span>{totalStreamsLabel}</span>
            {isUserProfile && (
              <>
                <span className="text-zinc-400">•</span>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white text-[10px] font-mono uppercase font-bold">
                  User & Artist Profile
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* VERTEX ACTION BAR (Play Button, Follow, Edit Profile, Shuffle, Options) */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-1 sm:justify-start sm:gap-4 sm:px-2">
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
        {!isOwner && (
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
            <span className="sm:hidden">Edit profile</span>
            <span className="hidden sm:inline">Edit Artist Profile</span>
          </button>
        )}

        {/* Shuffle Button */}
        <button
          onClick={() => onToggleShuffle?.(displayTracks)}
          disabled={displayTracks.length === 0 || !onToggleShuffle}
          className={`p-3 rounded-full hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isShuffle
              ? 'text-[#D946EF] hover:text-[#E879F9]'
              : 'text-zinc-400 hover:text-white'
          }`}
          title={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
          aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
          aria-pressed={isShuffle}
        >
          <Shuffle className="w-6 h-6" />
        </button>

        {/* Artist-specific options — this intentionally does not dispatch the global right-click menu. */}
        <div className="relative">
          <button
            ref={artistMenuButtonRef}
            type="button"
            onClick={(event) => { event.stopPropagation(); toggleArtistMenu(); }}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
            aria-haspopup="menu"
            aria-expanded={isArtistMenuOpen}
            aria-label="More artist actions"
            className={`control-press flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${isArtistMenuOpen ? 'border-[#D946EF]/40 bg-[#D946EF]/15 text-[#F0ABFC]' : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
            title="More artist actions"
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>

          {isArtistMenuOpen && createPortal(
            <div
              ref={artistMenuPanelRef}
              role="menu"
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
              className="viewport-menu fixed z-[1000] max-h-[calc(100dvh-24px)] max-w-64 overflow-y-auto rounded-2xl border border-white/12 bg-[#161618] p-1.5 text-xs font-medium text-zinc-200 shadow-[0_24px_70px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-100 select-none"
              style={{ top: artistMenuPosition.top, left: artistMenuPosition.left }}
            >
              <div className="space-y-0.5">
                <button type="button" onClick={() => { handlePlayArtist(); closeArtistMenu(); }} disabled={displayTracks.length === 0} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4 text-zinc-400" /><span>Play artist</span></button>
                <button type="button" onClick={() => { onToggleShuffle?.(displayTracks); closeArtistMenu(); }} disabled={displayTracks.length === 0 || !onToggleShuffle} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Shuffle className="h-4 w-4 text-zinc-400" /><span>{isShuffle ? 'Disable artist shuffle' : 'Shuffle artist'}</span></button>

                {!isOwner && <button type="button" onClick={() => { onToggleFollow?.(artist); closeArtistMenu(); }} disabled={!onToggleFollow} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40">{isFollowing ? <Check className="h-4 w-4 text-[#D946EF]" /> : <UserPlus className="h-4 w-4 text-zinc-400" />}<span>{isFollowing ? 'Unfollow artist' : 'Follow artist'}</span></button>}
                {isOwner && <button type="button" onClick={() => { setIsEditModalOpen(true); closeArtistMenu(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"><Edit3 className="h-4 w-4 text-[#D946EF]" /><span>Edit artist profile</span></button>}

                <div className="my-1 h-px bg-white/[0.08]" />
                <button type="button" onClick={() => void copyArtistLink()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"><Copy className="h-4 w-4 text-zinc-400" /><span>Copy artist link</span></button>

                {(instagramUrl || twitterUrl || websiteUrl) && <div className="my-1 h-px bg-white/[0.08]" />}
                {instagramUrl && <button type="button" onClick={() => openArtistUrl(instagramUrl, 'instagram')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"><Instagram className="h-4 w-4 text-pink-400" /><span>Open Instagram</span><ExternalLink className="ml-auto h-3 w-3 text-zinc-600" /></button>}
                {twitterUrl && <button type="button" onClick={() => openArtistUrl(twitterUrl, 'twitter')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"><Twitter className="h-4 w-4 text-sky-400" /><span>Open Twitter</span><ExternalLink className="ml-auto h-3 w-3 text-zinc-600" /></button>}
                {websiteUrl && <button type="button" onClick={() => openArtistUrl(websiteUrl, 'website')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"><Globe className="h-4 w-4 text-[#D946EF]" /><span>Open official site</span><ExternalLink className="ml-auto h-3 w-3 text-zinc-600" /></button>}
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* MAIN CONTENT GRID (Popular Tracks + Artist Pick) */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
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
                    className={`group flex cursor-pointer items-center justify-between gap-2 px-3 py-3 transition-colors hover:bg-white/10 sm:gap-4 sm:px-4 ${
                      isCurrent ? 'bg-white/10 text-[#D946EF]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
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
                          className={`text-sm font-extrabold truncate tracking-tight ${
                            isCurrent ? 'text-[#D946EF]' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right w-24 flex-shrink-0">
                      <span className="text-xs font-mono text-zinc-400">
                        {track.plays ? `${Number(track.plays).toLocaleString()}` : '0'} plays
                      </span>
                    </div>

                    <div className="flex flex-shrink-0 items-center justify-end gap-2 sm:w-20 sm:gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track.id);
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                          track.isLiked ? 'text-[#D946EF]' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-[#D946EF]' : ''}`} />
                      </button>

                      <span className="hidden min-w-[36px] text-right font-mono text-xs text-zinc-400 sm:inline">
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
              data-track-id={featuredTrack.id}
              data-context-type="track"
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
                  <p className="text-xs text-zinc-400">Posted by {artistName}</p>
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
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Discography</h2>
          {displayTracks.length > 0 && (
            <div className="scrollbar-none flex max-w-full items-center gap-2 overflow-x-auto pb-1">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {(discographyFilter === 'singles'
              ? releaseGroups.filter((g) => g.releaseType === 'Single' || g.releaseType === 'EP')
              : releaseGroups
            ).map((group) => {
              const isThisGroupPlaying = group.tracks.some((t) => t.id === currentTrackId) && isPlaying;
              return (
                <div
                  key={group.key}
                  data-track-id={group.representative.id}
                  data-context-type="track"
                  onClick={() => {
                    if (onSelectAlbum) {
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
                      className={`mobile-card-action absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#D946EF] text-white flex items-center justify-center shadow-2xl transition-all transform ${
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
                    <h3 className="truncate text-sm font-extrabold tracking-tight text-white">{group.title}</h3>
                    <p className="mt-1 text-xs text-zinc-400">
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
        <div data-artist-id={artist.id} data-context-type="artist" className="relative rounded-2xl overflow-hidden p-8 sm:p-10 bg-[#181818] border border-white/10 shadow-2xl group cursor-pointer">
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
                <p className="text-xl font-black text-white">{totalStreamsLabel}</p>
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

    </div>
  );
};
