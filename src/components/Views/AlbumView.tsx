import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Heart, Clock, MoreHorizontal, ListPlus, FolderPlus, Copy, ChevronRight, Plus, Music2, User } from 'lucide-react';
import { Track, Artist, UserProfile, Playlist } from '../../types';

interface AlbumViewProps {
  albumTrack: Track;
  allTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onSelectArtist: (artist: Artist | string) => void;
  onGoBack?: () => void;
  userProfile?: UserProfile | null;
  playlists?: Playlist[];
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, trackId: string) => void;
  onOpenNewPlaylist?: () => void;
  showToast?: (msg: string) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  albumTrack,
  allTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onToggleLike,
  onSelectArtist,
  playlists = [],
  onAddToQueue,
  onAddToPlaylist,
  onOpenNewPlaylist,
  showToast,
}) => {
  // Find all tracks from the same release or album
  const albumTracks = allTracks.filter((t) => {
    if (albumTrack.releaseId) return t.releaseId === albumTrack.releaseId;
    if (albumTrack.album === 'Single') return t.id === albumTrack.id;
    return t.album === albumTrack.album;
  });

  // Find other albums/tracks by the same artist
  const moreByArtist = allTracks.filter(
    (t) => t.artist === albumTrack.artist && 
           (albumTrack.releaseId 
             ? t.releaseId !== albumTrack.releaseId 
             : (albumTrack.album === 'Single' ? t.id !== albumTrack.id : t.album !== albumTrack.album))
  );

  const isCurrentAlbumPlaying = albumTracks.some((t) => t.id === currentTrackId) && isPlaying;

  // Track the most up-to-date version of the track in allTracks to synchronize Heart state
  const freshAlbumTrack = allTracks.find((t) => t.id === albumTrack.id) || albumTrack;

  // Dropdown context menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowPlaylistSubmenu(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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
          src={albumTrack.coverUrl}
          alt={albumTrack.album}
          referrerPolicy="no-referrer"
          className="w-48 h-48 md:w-56 md:h-56 rounded-lg shadow-2xl z-10 object-cover flex-shrink-0"
        />

        <div className="z-10 flex flex-col space-y-3 pb-2 w-full">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">
            {albumTrack.releaseType ? albumTrack.releaseType.toUpperCase() : (albumTrack.album === 'Single' ? 'SINGLE' : 'ALBUM')}
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-lg leading-none py-1">
            {albumTrack.releaseTitle || (albumTrack.album === 'Single' ? albumTrack.title : albumTrack.album)}
          </h1>
          <div className="flex items-center space-x-2 text-sm text-zinc-300 font-medium pt-2">
            <span
              onClick={() => onSelectArtist(albumTrack.artist)}
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
          onClick={() => onPlayTrack(albumTracks[0])}
          className="w-14 h-14 rounded-full bg-[#D946EF] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
        >
          {isCurrentAlbumPlaying ? (
            <Pause className="w-6 h-6 fill-white" />
          ) : (
            <Play className="w-6 h-6 fill-white ml-1" />
          )}
        </button>
        <button
          onClick={() => {
            onToggleLike(freshAlbumTrack.id);
            showToast?.(
              freshAlbumTrack.isLiked
                ? `Removed "${freshAlbumTrack.title}" from Liked Songs`
                : `Added "${freshAlbumTrack.title}" to Liked Songs`
            );
          }}
          className={`${freshAlbumTrack.isLiked ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'} transition-colors`}
        >
          <Heart className={`w-8 h-8 ${freshAlbumTrack.isLiked ? 'fill-[#D946EF]' : ''}`} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center p-1"
          >
            <MoreHorizontal className="w-8 h-8" />
          </button>
          
          {isMenuOpen && (
            <div className="absolute left-0 mt-2 w-56 bg-[#161618]/95 backdrop-blur-2xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl py-2 px-1 text-zinc-200 text-xs font-medium z-50 animate-in fade-in zoom-in-95 duration-100 select-none">
              <div className="space-y-0.5">
                {/* Add to Queue */}
                <button
                  onClick={() => {
                    const trackToQueue = albumTracks[0] || albumTrack;
                    onAddToQueue?.(trackToQueue);
                    showToast?.(`Added "${trackToQueue.title}" to queue`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <ListPlus className="w-4 h-4 text-zinc-400" />
                  <span>Add to Queue</span>
                </button>

                {/* Add to Playlist */}
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowPlaylistSubmenu(true)}
                    onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <FolderPlus className="w-4 h-4 text-zinc-400" />
                      <span>Add to Playlist</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </button>

                  {showPlaylistSubmenu && (
                    <div
                      onMouseLeave={() => setShowPlaylistSubmenu(false)}
                      className="absolute left-full top-0 ml-1 w-48 bg-[#18181b]/95 backdrop-blur-2xl border border-white/12 shadow-2xl rounded-xl py-1 px-1 z-50 text-xs space-y-0.5 animate-in fade-in duration-100"
                    >
                      <button
                        onClick={() => {
                          onOpenNewPlaylist?.();
                          setIsMenuOpen(false);
                          setShowPlaylistSubmenu(false);
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
                            onClick={() => {
                              onAddToPlaylist?.(pl.id, (albumTracks[0] || albumTrack).id);
                              showToast?.(`Added to "${pl.title}"`);
                              setIsMenuOpen(false);
                              setShowPlaylistSubmenu(false);
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

                {/* Go to Artist */}
                <button
                  onClick={() => {
                    onSelectArtist(albumTrack.artist);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>Go to Artist</span>
                </button>

                {/* Copy Link / Share */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast?.('Copied release link to clipboard!');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span>Copy Link / Share</span>
                </button>
              </div>
            </div>
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
                {/* # Index or Play Icon */}
                <div className="col-span-1 text-center font-mono font-bold text-xs text-zinc-400 group-hover:text-white">
                  {isSelected && isPlaying ? (
                    <span className="text-[#D946EF] font-bold">▶</span>
                  ) : (
                    idx + 1
                  )}
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
                      onClick={(e) => { e.stopPropagation(); onSelectArtist(track.artist); }}
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
            <h2 className="text-xl font-bold text-white hover:underline cursor-pointer" onClick={() => onSelectArtist(albumTrack.artist)}>
              More by {albumTrack.artist}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {moreByArtist.slice(0, 5).map((track) => (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track)}
                className="group bg-[#181818] hover:bg-[#282828] p-4 rounded-xl transition-all cursor-pointer flex flex-col justify-between shadow-md"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute right-2 bottom-2 w-10 h-10 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                    {currentTrackId === track.id && isPlaying ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 truncate">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
