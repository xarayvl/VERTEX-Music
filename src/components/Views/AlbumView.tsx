import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Heart, Clock, MoreHorizontal, ListPlus, FolderPlus, Copy, ChevronRight, Plus, Music2, User, Edit3 } from 'lucide-react';
import { Track, Artist, UserProfile, Playlist } from '../../types';

interface AlbumViewProps {
  albumTrack: Track;
  allTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTogglePlay?: () => void;
  onToggleLike: (trackId: string) => void;
  onSetReleaseLiked: (trackIds: string[], shouldLike: boolean) => Promise<boolean>;
  onEditTrack?: (track: Track) => void;
  onSelectArtist: (artist: Artist | string) => void;
  onSelectAlbum: (track: Track) => void;
  onGoBack?: () => void;
  userProfile?: UserProfile | null;
  playlists?: Playlist[];
  onAddToQueue?: (track: Track) => void;
  onAddTracksToQueue?: (tracks: Track[]) => void;
  onAddToPlaylist?: (playlistId: string, trackId: string) => Promise<boolean> | boolean;
  onAddTracksToPlaylist?: (playlistId: string, trackIds: string[]) => Promise<boolean> | boolean;
  onOpenNewPlaylist?: () => void;
  showToast?: (msg: string) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  albumTrack,
  allTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  onToggleLike,
  onSetReleaseLiked,
  onEditTrack,
  onSelectArtist,
  onSelectAlbum,
  userProfile,
  playlists = [],
  onAddToQueue,
  onAddTracksToQueue,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onOpenNewPlaylist,
  showToast,
}) => {
  // Find all tracks from the same release or album
  const albumTracks = allTracks
    .filter((t) => {
      if (albumTrack.releaseId) return t.releaseId === albumTrack.releaseId;
      if (albumTrack.album === 'Single') return t.id === albumTrack.id;
      return t.album === albumTrack.album;
    })
    // Respect the tracklist order chosen at upload time (trackNumber).
    // Tracks without a trackNumber (legacy uploads) fall back to
    // chronological order and are placed after numbered tracks.
    .slice()
    .sort((a, b) => {
      const aNum = a.trackNumber ?? Infinity;
      const bNum = b.trackNumber ?? Infinity;
      if (aNum !== bNum) return aNum - bNum;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

  // “More by” is a release shelf, not a track list. Collapse every album or
  // single to one representative track so a multi-track album is shown once.
  const moreByArtist = Array.from(
    new Map(
      allTracks
        .filter(
          (track) => track.artist === albumTrack.artist &&
            (albumTrack.releaseId
              ? track.releaseId !== albumTrack.releaseId
              : albumTrack.album === 'Single'
                ? track.id !== albumTrack.id
                : track.album !== albumTrack.album)
        )
        .map((track) => {
          const releaseKey = track.releaseId ||
            (track.album === 'Single'
              ? `single:${track.id}`
              : `album:${track.userId || track.artist}:${track.releaseTitle || track.album}`);
          return [releaseKey, track] as const;
        })
    ).values()
  );

  const isCurrentAlbumActive = albumTracks.some((t) => t.id === currentTrackId);
  const isCurrentAlbumPlaying = isCurrentAlbumActive && isPlaying;

  // Track the freshest liked state for the whole release. Albums are saved as
  // one action instead of only toggling the representative track.
  const freshAlbumTracks = albumTracks.map((track) => allTracks.find((item) => item.id === track.id) || track);
  const isReleaseLiked = freshAlbumTracks.length > 0 && freshAlbumTracks.every((track) => track.isLiked);
  const isReleaseOwner = Boolean(userProfile?.id && albumTrack.userId === userProfile.id);
  const primaryTrack = albumTracks[0] || albumTrack;

  // Dropdown context menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuButtonRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) {
        setIsMenuOpen(false);
        setShowPlaylistSubmenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setShowPlaylistSubmenu(false);
      }
    };
    const handleViewportChange = () => {
      setIsMenuOpen(false);
      setShowPlaylistSubmenu(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setShowPlaylistSubmenu(false);
  }, [albumTrack.id]);

  useLayoutEffect(() => {
    if (!isMenuOpen || !menuButtonRef.current || !menuPanelRef.current) return;
    const buttonRect = menuButtonRef.current.getBoundingClientRect();
    const panelRect = menuPanelRef.current.getBoundingClientRect();
    const padding = 12;
    const left = Math.min(Math.max(padding, buttonRect.left), window.innerWidth - panelRect.width - padding);
    const preferredTop = buttonRect.bottom + 8;
    const top = preferredTop + panelRect.height <= window.innerHeight - padding
      ? preferredTop
      : Math.max(padding, buttonRect.top - panelRect.height - 8);
    setMenuPosition({ top, left });
  }, [isMenuOpen, showPlaylistSubmenu]);

  const toggleMenu = () => {
    if (!isMenuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 8, left: Math.max(12, rect.left) });
    }
    setIsMenuOpen((open) => !open);
    setShowPlaylistSubmenu(false);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setShowPlaylistSubmenu(false);
  };

  const copyReleaseLink = async () => {
    const link = `${window.location.origin}/track/${albumTrack.id}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast?.('Copied release link to clipboard!');
    } catch {
      const input = document.createElement('textarea');
      input.value = link;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      showToast?.(copied ? 'Copied release link to clipboard!' : 'Could not copy the release link.');
    }
    closeMenu();
  };

  const toggleReleaseLike = async (closeAfter = false) => {
    if (isLikePending) return;
    setIsLikePending(true);
    const shouldLike = !isReleaseLiked;
    try {
      const succeeded = await onSetReleaseLiked(albumTracks.map((track) => track.id), shouldLike);
      if (succeeded) {
        showToast?.(
          shouldLike
            ? albumTracks.length > 1
              ? `Saved ${albumTracks.length} songs from this release to Liked Songs`
              : `Added "${primaryTrack.title}" to Liked Songs`
            : albumTracks.length > 1
              ? `Removed this release from Liked Songs`
              : `Removed "${primaryTrack.title}" from Liked Songs`
        );
      }
    } finally {
      setIsLikePending(false);
      if (closeAfter) closeMenu();
    }
  };

  const effectiveYear = albumTrack.releaseYear || (albumTrack.createdAt ? new Date(albumTrack.createdAt).getFullYear() : new Date().getFullYear());
  const formattedReleaseDate = albumTrack.createdAt ? new Date(albumTrack.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : `Released ${effectiveYear}`;

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-500 min-h-full">
      {/* Dynamic Header mimicking Spotify Release Page */}
      <div className="relative -mx-6 -mt-4 p-8 flex flex-col md:flex-row items-end gap-6 overflow-hidden">
        {/* Background Blur */}
        <div
          className="absolute inset-0 opacity-40 blur-[100px] z-0 saturate-200"
          style={{
            backgroundImage: `url(${albumTrack.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent z-0" />

        <img
          data-track-id={albumTrack.id}
          data-context-type="track"
          src={albumTrack.coverUrl}
          alt={albumTrack.album}
          referrerPolicy="no-referrer"
          className="w-48 h-48 md:w-56 md:h-56 rounded-lg shadow-2xl z-10 object-cover flex-shrink-0"
        />

        <div className="z-10 flex flex-col space-y-3 pb-2 w-full">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">
            {albumTrack.releaseType ? albumTrack.releaseType.toUpperCase() : (albumTrack.album === 'Single' ? 'SINGLE' : 'ALBUM')}
          </p>
          <h1 data-track-id={albumTrack.id} data-context-type="track" className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-lg leading-none py-1">
            {albumTrack.releaseTitle || (albumTrack.album === 'Single' ? albumTrack.title : albumTrack.album)}
          </h1>
          <div className="flex items-center space-x-2 text-sm text-zinc-300 font-medium pt-2">
            <span
              data-artist-id={albumTrack.userId}
              data-context-type="artist"
              onClick={() => onSelectArtist(albumTrack.userId || '')}
              className="font-bold text-white hover:underline cursor-pointer tracking-tight"
            >
              {albumTrack.artist}
            </span>
            <span>•</span>
            <span>{effectiveYear}</span>
            <span>•</span>
            <span>{albumTracks.length} song{albumTracks.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>
              {Math.floor(albumTracks.reduce((acc, t) => acc + t.duration, 0) / 60)} min
            </span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center space-x-6 px-2">
        <button
          onClick={() => isCurrentAlbumActive && onTogglePlay ? onTogglePlay() : onPlayTrack(albumTracks[0])}
          className="w-14 h-14 rounded-full bg-[#D946EF] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
        >
          {isCurrentAlbumPlaying ? (
            <Pause className="w-6 h-6 fill-white" />
          ) : (
            <Play className="w-6 h-6 fill-white ml-1" />
          )}
        </button>
        <button
          onClick={() => void toggleReleaseLike()}
          disabled={isLikePending}
          className={`${isReleaseLiked ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'} transition-colors disabled:cursor-wait disabled:opacity-50`}
          aria-label={isReleaseLiked ? 'Remove release from Liked Songs' : 'Save release to Liked Songs'}
        >
          <Heart className={`w-8 h-8 ${isReleaseLiked ? 'fill-[#D946EF]' : ''}`} />
        </button>
        <div className="relative">
          <button
            ref={menuButtonRef}
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="More release actions"
            className={`control-press flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${isMenuOpen ? 'border-[#D946EF]/40 bg-[#D946EF]/15 text-[#F0ABFC]' : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>

          {isMenuOpen && createPortal(
            <div
              ref={menuPanelRef}
              role="menu"
              onClick={(event) => event.stopPropagation()}
              className="custom-scrollbar fixed z-[1000] w-72 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-white/12 bg-[#161618] p-1.5 text-xs font-medium text-zinc-200 shadow-[0_24px_70px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-100 select-none"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <div className="mb-1.5 flex items-center gap-3 border-b border-white/10 px-2.5 py-2.5">
                <img src={albumTrack.coverUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-xl object-cover shadow" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#D8B4FE]">{albumTracks.length > 1 ? 'Release actions' : 'Song actions'}</p>
                  <p className="mt-0.5 truncate text-sm font-black text-white">{albumTrack.releaseTitle || primaryTrack.title}</p>
                </div>
              </div>

              <div className="space-y-0.5">
                {isReleaseOwner && onEditTrack && (
                  <button
                    onClick={() => {
                      onEditTrack(primaryTrack);
                      closeMenu();
                    }}
                    className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-left font-semibold text-[#E9D5FF] transition-colors hover:bg-[#A855F7]/20 hover:text-white"
                  >
                    <Edit3 className="h-4 w-4 text-[#D946EF]" />
                    <span>{albumTracks.length > 1 ? 'Edit release & tracklist' : 'Edit song'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (isCurrentAlbumActive && onTogglePlay) onTogglePlay();
                    else onPlayTrack(primaryTrack);
                    closeMenu();
                  }}
                  className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-left font-semibold text-white transition-colors hover:bg-gradient-to-r hover:from-[#A855F7]/30 hover:to-[#D946EF]/20"
                >
                  {isCurrentAlbumPlaying ? <Pause className="h-4 w-4 fill-current text-[#F0ABFC]" /> : <Play className="h-4 w-4 fill-current text-[#F0ABFC]" />}
                  <span>{isCurrentAlbumPlaying ? 'Pause' : isCurrentAlbumActive ? 'Resume' : albumTracks.length > 1 ? 'Play release' : 'Play song'}</span>
                </button>

                <button
                  onClick={() => void toggleReleaseLike(true)}
                  disabled={isLikePending}
                  className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  <Heart className={`h-4 w-4 ${isReleaseLiked ? 'fill-[#D946EF] text-[#D946EF]' : 'text-zinc-400'}`} />
                  <span>{isReleaseLiked ? 'Remove from Liked Songs' : albumTracks.length > 1 ? 'Save release to Liked Songs' : 'Save to Liked Songs'}</span>
                </button>

                {/* Add to Queue */}
                <button
                  onClick={() => {
                    if (onAddTracksToQueue) onAddTracksToQueue(albumTracks);
                    else albumTracks.forEach((track) => onAddToQueue?.(track));
                    showToast?.(albumTracks.length > 1 ? `Added ${albumTracks.length} release tracks to queue` : `Added "${albumTracks[0]?.title || albumTrack.title}" to queue`);
                    closeMenu();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <ListPlus className="w-4 h-4 text-zinc-400" />
                  <span>{albumTracks.length > 1 ? 'Add release to queue' : 'Add to queue'}</span>
                </button>

                {/* Add to Playlist */}
                <div className="relative">
                  <button
                    onClick={() => setShowPlaylistSubmenu((open) => !open)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <FolderPlus className="w-4 h-4 text-zinc-400" />
                      <span>{albumTracks.length > 1 ? 'Add release to playlist' : 'Add to playlist'}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </button>

                  {showPlaylistSubmenu && (
                    <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/25 p-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        onClick={() => {
                          onOpenNewPlaylist?.();
                          closeMenu();
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#D946EF]/20 text-[#D946EF] font-bold text-left"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Playlist</span>
                      </button>
                      <div className="h-[1px] bg-white/10 my-1" />
                      {playlists && playlists.length > 0 ? (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={async () => {
                              const succeeded = onAddTracksToPlaylist
                                ? await onAddTracksToPlaylist(pl.id, albumTracks.map((track) => track.id))
                                : await onAddToPlaylist?.(pl.id, (albumTracks[0] || albumTrack).id);
                              if (succeeded !== false) showToast?.(albumTracks.length > 1 ? `Added release to "${pl.title}"` : `Added to "${pl.title}"`);
                              closeMenu();
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-left truncate"
                          >
                            <Music2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span className="truncate">{pl.title}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-2.5 py-1.5 text-zinc-500 italic text-[11px]">No playlists available</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="my-1 h-px bg-white/[0.08]" />

                {/* Go to Artist */}
                <button
                  onClick={() => {
                    onSelectArtist(albumTrack.userId || '');
                    closeMenu();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>Go to Artist</span>
                </button>

                {/* Copy Link / Share */}
                <button
                  onClick={() => void copyReleaseLink()}
                  className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span>{albumTracks.length > 1 ? 'Copy album link' : 'Copy song link'}</span>
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="bg-[#181818]/60 rounded-xl overflow-hidden border border-white/[0.04]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-bold text-zinc-400 border-b border-white/10 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-8 sm:col-span-9">Title</div>
          <div className="col-span-3 sm:col-span-2 flex items-center justify-end pr-2 gap-4">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        
        {/* Table Rows */}
        <div className="divide-y divide-white/[0.03]">
          {albumTracks.map((track, idx) => {
            const isSelected = currentTrackId === track.id;
            return (
              <div
                key={track.id}
                data-track-id={track.id}
                data-context-type="track"
                onClick={() => onPlayTrack(track)}
                className={`grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm cursor-pointer transition-colors group ${
                  isSelected ? 'bg-white/10 text-[#D946EF]' : 'hover:bg-white/10 text-zinc-300'
                }`}
              >
                {/* # Index or Play Icon — same render pattern as ArtistView's track rows */}
                <div className="col-span-1 flex items-center justify-center">
                  <span
                    className={`w-6 text-center text-xs font-mono ${
                      isSelected ? 'text-[#D946EF] font-bold' : 'text-zinc-400 group-hover:hidden'
                    }`}
                  >
                    {isSelected && isPlaying ? (
                      <span className="flex items-center justify-center space-x-0.5">
                        <span className="w-1 h-3 bg-[#D946EF] animate-bounce" />
                        <span className="w-1 h-4 bg-[#D946EF] animate-bounce delay-75" />
                        <span className="w-1 h-2 bg-[#D946EF] animate-bounce delay-150" />
                      </span>
                    ) : (
                      idx + 1
                    )}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected && onTogglePlay) onTogglePlay();
                      else onPlayTrack(track);
                    }}
                    className="w-6 text-center hidden group-hover:block text-white"
                  >
                    {isSelected && isPlaying ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white" />
                    )}
                  </button>
                </div>
                
                {/* Title (No cover art since it's an album page) */}
                <div className="col-span-8 sm:col-span-9 flex flex-col min-w-0">
                  <h4
                    className={`font-bold truncate tracking-tight group-hover:text-white ${
                      isSelected ? 'text-[#D946EF]' : 'text-white'
                    }`}
                  >
                    {track.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate group-hover:text-white transition-colors">
                    <span 
                      data-artist-id={track.userId}
                      data-context-type="artist"
                      onClick={(e) => { e.stopPropagation(); onSelectArtist(track.userId || ''); }}
                      className="hover:underline cursor-pointer"
                    >
                      {track.artist}
                    </span>
                  </p>
                </div>
                
                {/* Like & Duration */}
                <div className="col-span-3 sm:col-span-2 flex items-center justify-end space-x-3 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(track.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        track.isLiked ? 'fill-[#D946EF] text-[#D946EF]' : ''
                      }`}
                    />
                  </button>
                  <span className="text-xs font-mono text-zinc-400">
                    {Math.floor(track.duration / 60)}:
                    {track.duration % 60 < 10 ? '0' : ''}
                    {track.duration % 60}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="px-2 pb-6">
        <p className="text-[11px] text-zinc-500 font-medium">{formattedReleaseDate}</p>
        {albumTrack.copyright ? (
          <p className="text-[11px] text-zinc-500">{albumTrack.copyright}</p>
        ) : (
          <>
            <p className="text-[11px] text-zinc-500">© {effectiveYear} {albumTrack.artist} Records</p>
            <p className="text-[11px] text-zinc-500">℗ {effectiveYear} {albumTrack.artist} Records</p>
          </>
        )}
      </div>

      {/* More by Artist Section */}
      {moreByArtist.length > 0 && (
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 data-artist-id={albumTrack.userId} data-context-type="artist" className="text-xl font-bold text-white hover:underline cursor-pointer" onClick={() => onSelectArtist(albumTrack.userId || '')}>
              More by {albumTrack.artist}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {moreByArtist.slice(0, 5).map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                data-context-type="track"
                onClick={() => onSelectAlbum(track)}
                className="group bg-[#181818] hover:bg-[#282828] p-4 rounded-xl transition-all cursor-pointer flex flex-col justify-between shadow-md"
                aria-label={`Open ${track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}`}
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="mobile-card-action absolute right-2 bottom-2 w-10 h-10 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                    <ChevronRight className="h-4 w-4 stroke-[3]" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                  <p className="mt-1 truncate text-xs text-zinc-400">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
