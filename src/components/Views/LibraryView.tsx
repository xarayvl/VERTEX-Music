import React, { useState } from 'react';
import { Library, Plus, Heart, Play, Grid, List, Disc } from 'lucide-react';
import { Track, Playlist, Artist } from '../../types';

interface LibraryViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  onPlayTrack: (track: Track) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectAlbum?: (track: Track) => void;
  onSelectArtist?: (artist: Artist | string) => void;
  onOpenNewPlaylistModal: () => void;
  onOpenAddTrackModal?: () => void;
  onWipeAllTracks?: () => void;
  onToggleLike: (trackId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  playlists,
  artists,
  onPlayTrack,
  onPlayPlaylist,
  onSelectPlaylist,
  onSelectAlbum,
  onSelectArtist,
  onOpenNewPlaylistModal,
  onOpenAddTrackModal,
  onWipeAllTracks,
  onToggleLike,
}) => {
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'liked' | 'artists'>(
    'all'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const likedTracks = tracks.filter((t) => t.isLiked);

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Header & Create Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Library</h1>

        <div className="flex items-center space-x-2">
          {onOpenAddTrackModal && (
            <button
              onClick={onOpenAddTrackModal}
              className="flex items-center space-x-1.5 px-2 py-2 text-white/80 hover:text-white font-extrabold text-xs transition-all active:scale-95 hover:drop-shadow-[0_0_8px_rgba(217,70,239,0.85)]"
            >
              <span aria-hidden="true" className="text-[#D946EF]">+</span>
              <span>Upload</span>
            </button>
          )}

          <button
            onClick={onOpenNewPlaylistModal}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Playlist</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'playlists', label: `Playlists (${playlists.length})` },
            { id: 'liked', label: `Liked Songs (${likedTracks.length})` },
            { id: 'artists', label: `Artists (${artists.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLibraryFilter(tab.id as typeof libraryFilter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                libraryFilter === tab.id
                  ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 p-1 bg-white/5 rounded-lg border border-white/10">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Liked Songs Gradient Banner */}
      {(libraryFilter === 'all' || libraryFilter === 'liked') && (
        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-purple-800 via-fuchsia-800 to-pink-700 shadow-xl flex items-center justify-between border border-white/10">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Liked Songs</h2>
              <p className="text-xs text-white/80 font-medium mt-1">
                {likedTracks.length} favorite tracks saved
              </p>
            </div>
          </div>

          <button
            onClick={() => likedTracks[0] && onPlayTrack(likedTracks[0])}
            disabled={likedTracks.length === 0}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <Play className="w-6 h-6 fill-black ml-0.5" />
          </button>
        </div>
      )}

      {/* Your Library Collection: Playlists + Followed Artists live together
          in one unified grid, just like the tracks above — they used to be
          two separate sections that could each vanish independently when
          empty, leaving an ugly blank gap at the bottom of the screen. */}
      {(libraryFilter === 'all' || libraryFilter === 'playlists' || libraryFilter === 'artists') && (
        <div>
          <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">
            {libraryFilter === 'playlists'
              ? 'Playlists'
              : libraryFilter === 'artists'
              ? 'Followed Artists'
              : 'Your Collection'}
          </h3>

          {(libraryFilter === 'playlists' ? playlists.length === 0 : false) ||
          (libraryFilter === 'artists' ? artists.length === 0 : false) ||
          (libraryFilter === 'all' ? playlists.length === 0 && artists.length === 0 : false) ? (
            <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400 space-y-2">
              <Library className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-bold text-white">
                {libraryFilter === 'artists' ? 'No followed artists yet' : 'Nothing here yet'}
              </p>
              <p className="text-xs text-zinc-500">
                {libraryFilter === 'artists'
                  ? 'Follow an artist from their profile to see them here.'
                  : 'Create a playlist or follow an artist to fill up your library.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
                playlists.map((pl) => (
                  <div
                    key={`pl-${pl.id}`}
                    data-playlist-id={pl.id}
                    data-context-type="playlist"
                    onClick={() => onSelectPlaylist(pl)}
                    className="card-interactive bg-[#181818] hover:bg-[#282828] p-4 rounded-xl flex flex-col justify-between group cursor-pointer transition-all shadow relative"
                  >
                    <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow">
                      <img
                        src={pl.coverUrl}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {/* Quick Play Button */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPlaylist(pl);
                        }}
                        className="mobile-card-action absolute right-2 bottom-2 w-10 h-10 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 hover:scale-110"
                        title="Quick Play"
                      >
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                        {pl.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate mt-1">
                        Playlist • {pl.trackCount} tracks
                      </p>
                    </div>
                  </div>
                ))}

              {(libraryFilter === 'all' || libraryFilter === 'artists') &&
                artists.map((artist) => (
                  <div
                    key={`artist-${artist.id}`}
                    data-artist-id={artist.id}
                    data-context-type="artist"
                    onClick={() => onSelectArtist && onSelectArtist(artist)}
                    className="bg-[#181818] hover:bg-[#282828] p-4 rounded-xl flex flex-col justify-between group cursor-pointer transition-all shadow relative"
                  >
                    <div className="relative aspect-square w-full rounded-full overflow-hidden mb-3 shadow border border-white/5">
                      <img
                        src={artist.avatarUrl}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                        {artist.name}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate mt-1">
                        Artist • {artist.totalStreamsLabel || '0 total streams'}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-[#181818]/60 rounded-xl divide-y divide-white/[0.04] border border-white/[0.04]">
              {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
                playlists.map((pl) => (
                  <div
                    key={`pl-${pl.id}`}
                    data-playlist-id={pl.id}
                    data-context-type="playlist"
                    onClick={() => onSelectPlaylist(pl)}
                    className="p-3.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <img
                        src={pl.coverUrl}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded object-cover shadow"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF]">
                          {pl.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate">{pl.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono text-zinc-400">{pl.trackCount} Tracks</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPlaylist(pl);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#A855F7] text-white flex items-center justify-center transition-colors"
                        title="Quick Play"
                      >
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {(libraryFilter === 'all' || libraryFilter === 'artists') &&
                artists.map((artist) => (
                  <div
                    key={`artist-${artist.id}`}
                    data-artist-id={artist.id}
                    data-context-type="artist"
                    onClick={() => onSelectArtist && onSelectArtist(artist)}
                    className="p-3.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <img
                        src={artist.avatarUrl}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover shadow border border-white/5"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF]">
                          {artist.name}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate">
                          {artist.totalStreamsLabel || '0 total streams'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Liked Songs List View */}
      {(libraryFilter === 'all' || libraryFilter === 'liked') && (
        <div>
          <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">Saved Tracks</h3>
          {likedTracks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400 space-y-2">
              <Heart className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-bold text-white">No liked songs yet</p>
              <p className="text-xs text-zinc-500">Tap the heart on any track to save it here.</p>
            </div>
          ) : (
          <div className="bg-[#181818]/60 rounded-xl divide-y divide-white/[0.04] border border-white/[0.04]">
            {likedTracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                data-context-type="track"
                onClick={() => {
                  if (onSelectAlbum) onSelectAlbum(track);
                }}
                className="p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className="absolute inset-0 bg-black/60 items-center justify-center rounded hidden group-hover:flex"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF]">
                      {track.title}
                    </h4>
                    <p
                      data-artist-id={track.userId}
                      data-context-type="artist"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectArtist) onSelectArtist(track.userId || '');
                      }}
                      className="text-xs text-zinc-400 truncate hover:underline hover:text-[#D946EF]"
                    >
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(track.id);
                    }}
                    className="p-1.5 text-[#D946EF]"
                  >
                    <Heart className="w-4 h-4 fill-[#D946EF]" />
                  </button>
                  <span className="text-xs font-mono text-zinc-400">
                    {Math.floor(track.duration / 60)}:
                    {track.duration % 60 < 10 ? '0' : ''}
                    {track.duration % 60}
                  </span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

    </div>
  );
};
