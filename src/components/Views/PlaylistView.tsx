import React, { useState } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Clock,
  Heart,
  Plus,
  Trash2,
  Edit3,
  Search,
  Music,
  ListPlus,
  Tag,
  Check,
} from 'lucide-react';
import { Playlist, Track } from '../../types';

interface PlaylistViewProps {
  playlist: Playlist | null;
  canManage: boolean;
  allTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onToggleLike: (trackId: string) => void;
  onOpenEditModal: () => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  canManage,
  allTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onPlayPlaylist,
  onToggleLike,
  onOpenEditModal,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
}) => {
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);

  if (!playlist) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <p className="text-5xl font-black text-white">404</p>
          <h2 className="text-xl font-bold text-white">Playlist not found</h2>
          <p className="text-sm text-zinc-400">This playlist does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Resolve tracks inside this playlist
  const playlistTracks = playlist.trackIds
    .map((id) => allTracks.find((t) => t.id === id))
    .filter((t): t is Track => t !== undefined);

  // Tracks available to add
  const availableTracks = allTracks.filter(
    (t) =>
      !playlist.trackIds.includes(t.id) &&
      (t.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
        t.genre.toLowerCase().includes(songSearchQuery.toLowerCase()))
  );

  const totalDurationSeconds = playlistTracks.reduce((acc, t) => acc + t.duration, 0);
  const durationMinutes = Math.floor(totalDurationSeconds / 60);

  const isCurrentPlaylistPlaying =
    playlistTracks.some((t) => t.id === currentTrackId) && isPlaying;

  return (
    <div className="space-y-8 pb-16 select-none">
      {/* Top VERTEX Music Header Banner */}
      <div
        data-playlist-id={playlist.id}
        data-context-type="playlist"
        className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#A855F7]/30 via-[#181818]/80 to-[#121212] p-6 sm:p-8 border border-white/[0.06] shadow-2xl flex flex-col md:flex-row gap-6 md:items-end"
      >
        {/* Playlist Cover Art */}
        <div className="w-44 h-44 sm:w-52 sm:h-52 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl relative group border border-white/10">
          <img
            src={playlist.coverUrl}
            alt={playlist.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {canManage && (
            <button
              onClick={onOpenEditModal}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1.5 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Cover</span>
            </button>
          )}
        </div>

        {/* Playlist Metadata Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-bold">
            Public Playlist
          </span>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none break-words">
            {playlist.title}
          </h1>

          {playlist.description && (
            <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed pt-1">{playlist.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-2 font-medium">
            <span className="text-white font-bold flex items-center gap-1">
              <Music className="w-3.5 h-3.5 text-[#D946EF]" />
              {playlistTracks.length} tracks
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {durationMinutes} min
            </span>
          </div>
        </div>
      </div>

      {/* Action Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center space-x-4">
          {/* Main Play Playlist Button */}
          <button
            onClick={() => onPlayPlaylist(playlist)}
            disabled={playlistTracks.length === 0}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-2xl transition-all disabled:opacity-50"
            title={isCurrentPlaylistPlaying ? 'Pause Playlist' : 'Play Playlist'}
          >
            {isCurrentPlaylistPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white ml-1" />
            )}
          </button>

          {/* Shuffle Button */}
          <button
            onClick={() => {
              if (playlistTracks.length > 0) {
                const randomTrack =
                  playlistTracks[Math.floor(Math.random() * playlistTracks.length)];
                onPlayTrack(randomTrack);
              }
            }}
            disabled={playlistTracks.length === 0}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            title="Shuffle Play"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {canManage && (
            <>
              <button
                onClick={onOpenEditModal}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors border border-white/10"
              >
                <Edit3 className="w-4 h-4 text-[#D946EF]" />
                <span>Edit Details</span>
              </button>
              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs transition-colors border ${
                  showAddSection
                    ? 'bg-[#A855F7] text-white border-[#A855F7]'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                }`}
              >
                <ListPlus className="w-4 h-4" />
                <span>{showAddSection ? 'Hide Songs' : 'Add Songs'}</span>
              </button>
            </>
          )}
        </div>

        {/* Delete Playlist Button */}
        {canManage && (
        <button
          onClick={() => {
            if (
              window.confirm(
                `Are you sure you want to delete the playlist "${playlist.title}"?`
              )
            ) {
              onDeletePlaylist(playlist.id);
            }
          }}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Playlist</span>
        </button>
        )}
      </div>

      {/* Playlist Tracklist Table */}
      <div className="bg-[#181818]/60 rounded-2xl overflow-hidden border border-white/[0.04]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold text-zinc-400 border-b border-white/10 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-5 sm:col-span-5">Title</div>
          <div className="hidden sm:block sm:col-span-4">Album</div>
          <div className="col-span-6 sm:col-span-2 flex items-center justify-end pr-2 gap-4">
            <Clock className="w-4 h-4" />
            <span className="sr-only">Actions</span>
          </div>
        </div>

        {/* Empty State */}
        {playlistTracks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-500">
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">This playlist is empty</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Find songs from the library below and click "+ Add to Playlist" to build your custom mix.
            </p>
            {canManage && (
            <button
              onClick={() => setShowAddSection(true)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-bold text-xs shadow-lg"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Songs Now</span>
            </button>
            )}
          </div>
        ) : (
          /* Table Rows */
          <div className="divide-y divide-white/[0.03]">
            {playlistTracks.map((track, idx) => {
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
                        onPlayTrack(track);
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

                  {/* Title & Cover */}
                  <div className="col-span-5 sm:col-span-5 flex items-center space-x-3 min-w-0">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded object-cover flex-shrink-0 shadow"
                    />
                    <div className="min-w-0">
                      <h4
                        className={`font-bold truncate tracking-tight group-hover:text-[#D946EF] ${
                          isSelected ? 'text-[#D946EF]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                    </div>
                  </div>

                  {/* Album Name */}
                  <div className="hidden sm:block sm:col-span-4 text-xs text-zinc-400 truncate">
                    {track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}
                  </div>

                  {/* Like & Duration & Remove Action */}
                  <div className="col-span-6 sm:col-span-2 flex items-center justify-end space-x-3 pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(track.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-white transition-colors"
                      title="Like song"
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

                    {/* Remove Track from Playlist */}
                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrackFromPlaylist(playlist.id, track.id);
                        }}
                        className="mobile-row-action flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Songs to Playlist Drawer / Section */}
      {canManage && (showAddSection || playlistTracks.length === 0) && (
        <div className="bg-[#181818] rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                Songs available for "{playlist.title}"
              </h3>
              <p className="text-xs text-zinc-400">
                Browse available tracks from your audio engine library to add to this playlist.
              </p>
            </div>

            {/* Song Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={songSearchQuery}
                onChange={(e) => setSongSearchQuery(e.target.value)}
                placeholder="Search songs to add..."
                className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
              />
            </div>
          </div>

          {availableTracks.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4">
              All matching songs are already in this playlist!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {availableTracks.map((track) => (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  data-context-type="track"
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-between border border-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                      <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onAddTrackToPlaylist(playlist.id, track.id)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-xs shadow flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
