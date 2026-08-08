import React, { useState } from 'react';
import { X, Heart, Plus, ShieldCheck, ExternalLink, FolderPlus, Music, Check } from 'lucide-react';
import { Track, Artist, Playlist, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { getArtistStats } from '../../utils/artistUtils';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

interface NowPlayingSidebarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  artists: Artist[];
  playlists: Playlist[];
  userProfile?: UserProfile | null;
  allTracks: Track[];
  onClose: () => void;
  onToggleLike: (trackId: string) => void;
  onSelectArtist: (artist: Artist | UserProfile | string) => void;
  onSelectAlbum: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onOpenNewPlaylistModal: () => void;
  showToast?: (msg: string) => void;
}

export const NowPlayingSidebar: React.FC<NowPlayingSidebarProps> = ({
  currentTrack,
  isPlaying,
  artists,
  playlists,
  userProfile,
  allTracks,
  onClose,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
  onAddToPlaylist,
  onOpenNewPlaylistModal,
  showToast,
}) => {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);

  if (!currentTrack) {
    return (
      <aside data-context-type="now-playing" className="w-full h-full flex-shrink-0 flex flex-col select-none text-zinc-300 relative z-20">
        <div className="bg-[#121212] rounded-xl flex-1 flex flex-col overflow-hidden border border-white/[0.04]">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <span className="font-bold text-sm text-white">Now Playing</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
              id="close-now-playing-empty"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500 border border-white/5 shadow-inner">
              <Music className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">No Track Playing</h4>
              <p className="text-xs text-zinc-500 max-w-[200px] mx-auto leading-relaxed">
                Select a song from Home, Search, or Library to start playing.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Artist identity is resolved exclusively through the immutable owner ID.
  const displayObj: Artist | UserProfile | null =
    currentTrack.userId && userProfile?.id === currentTrack.userId
      ? userProfile
      : artists.find((artist) => artist.id === currentTrack.userId) || null;

  const stats = getArtistStats(displayObj, allTracks);
  const artistStreams = stats.totalStreamsLabel;
  const finalDisplayName = displayObj ? stats.artistName : currentTrack.artist;

  const isUserProfileDisplay = !!displayObj && 'email' in displayObj;
  const artistAvatar = displayObj?.avatarUrl || DEFAULT_AVATAR_URL;
  const artistBanner = displayObj?.bannerUrl || currentTrack.coverUrl;

  // Prefer the artist-specific bio over a generic listener bio when the
  // resolved profile is a UserProfile (which always has both fields).
  let artistBio: string | null | undefined = null;
  if (displayObj && isUserProfileDisplay) {
    artistBio = (displayObj as UserProfile).artistBio || (displayObj as UserProfile).bio;
  } else if (displayObj && 'bio' in displayObj) {
    artistBio = displayObj.bio;
  }

  const isVerified = displayObj ? ('verified' in displayObj ? displayObj.verified : displayObj.artistVerified) : false;

  // Queue order alone is not enough to identify the playback source.
  // Showing a playlist name by comparing arrays caused unrelated queues with
  // the same tracks to be attributed to the wrong playlist.
  const releaseContextText = currentTrack.releaseType === 'SINGLE' || currentTrack.album === 'Single'
    ? 'PLAYING FROM SINGLE'
    : 'PLAYING FROM RELEASE';
  const releaseName = currentTrack.releaseTitle ||
    (currentTrack.album && currentTrack.album !== 'Single' ? currentTrack.album : currentTrack.title);

  return (
    <aside data-context-type="now-playing" className="w-full h-full flex-shrink-0 flex flex-col select-none text-zinc-300 relative z-20">
      <div className="bg-[#121212] rounded-xl flex-1 flex flex-col overflow-hidden border border-white/[0.04]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider truncate" title={releaseContextText}>{releaseContextText}</p>
            <h3
              data-track-id={currentTrack.id}
              data-context-type="track"
              className="text-xs font-bold text-white truncate hover:underline cursor-pointer"
              title={releaseName}
              onClick={() => onSelectAlbum(currentTrack)}
            >
              {releaseName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all ml-2"
            id="close-now-playing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Scrollable View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar pb-24">
          {/* Large Cover Art */}
          <div
            data-track-id={currentTrack.id}
            data-context-type="track"
            className="relative aspect-square w-full rounded-xl overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.6)] group cursor-pointer"
            onClick={() => onSelectAlbum(currentTrack)}
          >
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {isPlaying && (
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-extrabold text-[#D946EF] border border-white/10 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D946EF] animate-pulse" />
                <span>LIVE AUDIO</span>
              </div>
            )}
          </div>

          {/* Track Title and Artist Details */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2
                data-track-id={currentTrack.id}
                data-context-type="track"
                className="text-lg font-extrabold text-white truncate leading-tight tracking-tight hover:text-[#D946EF] cursor-pointer"
                onClick={() => onSelectAlbum(currentTrack)}
              >
                {currentTrack.title}
              </h2>
              <p data-artist-id={currentTrack.userId} data-context-type="artist" className="text-sm text-zinc-400 truncate mt-1 hover:text-[#D946EF] hover:underline cursor-pointer" onClick={() => onSelectArtist(displayObj || currentTrack.userId || '')}>
                {finalDisplayName}
              </p>
            </div>
            <div className="flex items-center space-x-1.5 ml-2 flex-shrink-0">
              {/* Like/Heart Button */}
              <button
                onClick={() => {
                  onToggleLike(currentTrack.id);
                  showToast?.(currentTrack.isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
                }}
                className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95"
                title={currentTrack.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              >
                <Heart className={`w-5 h-5 ${currentTrack.isLiked ? 'fill-[#D946EF] text-[#D946EF]' : ''}`} />
              </button>

              {/* Add to Playlist Button */}
              <div className="relative">
                <button
                  onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                  className={`p-2 rounded-full hover:bg-white/5 transition-all active:scale-95 ${showPlaylistMenu ? 'text-[#D946EF] bg-white/5' : 'text-zinc-400 hover:text-white'}`}
                  title="Add to Playlist"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* Mini Dropdown for Playlist Selection */}
                <AnimatePresence>
                  {showPlaylistMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 mt-2 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 px-1 z-50 text-xs text-zinc-300 space-y-0.5"
                    >
                      <button
                        onClick={() => {
                          onOpenNewPlaylistModal();
                          setShowPlaylistMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#D946EF]/20 text-[#D946EF] font-bold text-left"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Playlist</span>
                      </button>
                      <div className="h-[1px] bg-white/10 my-1" />
                      {playlists.length > 0 ? (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => {
                              onAddToPlaylist(pl.id, currentTrack.id);
                              showToast?.(`Added to "${pl.title}"`);
                              setShowPlaylistMenu(false);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-left truncate"
                          >
                            <span className="truncate flex-1">{pl.title}</span>
                            {pl.trackIds.includes(currentTrack.id) && <Check className="w-3.5 h-3.5 text-[#D946EF] ml-1 flex-shrink-0" />}
                          </button>
                        ))
                      ) : (
                        <p className="px-2.5 py-1.5 text-zinc-500 italic text-[10px]">No playlists available</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* 'About the Artist' Card */}
          <div data-artist-id={currentTrack.userId} data-context-type="artist" className="bg-[#18181a] border border-white/10 rounded-xl overflow-hidden shadow-lg transition-all hover:border-white/15 flex flex-col">
            {/* Cover Header */}
            <div className="relative h-28 overflow-hidden">
              <img
                src={artistBanner}
                alt={finalDisplayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover brightness-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#18181a] via-black/20 to-transparent" />
              
              {/* Overlay Verified Badge */}
              {isVerified && (
                <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-400 border border-white/5">
                  <ShieldCheck className="w-3.5 h-3.5 fill-blue-500 text-black" />
                  <span>VERIFIED</span>
                </div>
              )}
            </div>

            {/* Artist Info Body */}
            <div className="p-4 space-y-3">
              <div>
                <h4 className="font-extrabold text-white text-base tracking-tight truncate hover:underline cursor-pointer" onClick={() => onSelectArtist(displayObj || currentTrack.userId || '')}>
                  {finalDisplayName}
                </h4>
                <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                  {artistStreams}
                </p>
              </div>

              {artistBio && (
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                  {artistBio}
                </p>
              )}

              <button
                onClick={() => onSelectArtist(displayObj || currentTrack.userId || '')}
                className="w-full flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all hover:border-white/20 active:scale-95"
              >
                <span>Go to Artist Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
