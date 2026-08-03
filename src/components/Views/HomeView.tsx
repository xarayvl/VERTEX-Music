import React from 'react';
import { Play, Pause, Heart, Clock } from 'lucide-react';
import { Track, Playlist, Album, TabType } from '../../types';
import { groupTracksByRelease } from '../../utils/artistUtils';

interface HomeViewProps {
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  selectedCategory?: string;
  onSelectTab?: (tab: TabType) => void;
  onOpenAddTrackModal?: () => void;
  onOpenNewPlaylistModal?: () => void;
  recentlyPlayed?: Track[];
}

export const HomeView: React.FC<HomeViewProps> = ({
  tracks,
  playlists,
  albums,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onSelectPlaylist,
  onSelectArtist,
  onSelectAlbum,
  onToggleLike,
  selectedCategory = 'All',
  onSelectTab,
  onOpenAddTrackModal,
  onOpenNewPlaylistModal,
  recentlyPlayed = [],
}) => {
  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Category Filtering Logic
  const filteredTracks = tracks.filter((t) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Music') return true;
    if (selectedCategory === 'Podcasts') return t.genre === 'Podcast' || t.genre === 'Ambient';
    if (selectedCategory === 'Chill') return t.genre === 'Lo-Fi' || t.genre === 'Chillout' || t.genre === 'Synthwave';
    if (selectedCategory === 'Synthwave') return t.genre === 'Synthwave' || t.genre === 'Cyberpunk';
    return true;
  });

  const filteredPlaylists = playlists.filter((p) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Chill') return p.title.toLowerCase().includes('lo-fi') || p.title.toLowerCase().includes('chill');
    if (selectedCategory === 'Synthwave') return p.title.toLowerCase().includes('synth') || p.title.toLowerCase().includes('cyber');
    return true;
  });

  const likedTracks = tracks.filter((t) => t.isLiked);

  // Use the real user-scoped listening history. Fall back to fresh releases
  // only for brand-new users who have not played anything yet.
  const validRecentTracks = recentlyPlayed
    .filter((track) => track && tracks.some((candidate) => candidate.id === track.id))
    .slice(0, 12);
  const recentSource = validRecentTracks.length > 0 ? validRecentTracks : filteredTracks;
  const recentReleaseGroups = groupTracksByRelease(recentSource).slice(0, 5);

  // The greeting area now includes actual recently played songs instead of
  // being limited to Liked Songs and playlist shortcuts.
  const recentQuickItems = validRecentTracks.slice(0, 5).map((track) => ({
    id: `recent-${track.id}`,
    title: track.title,
    coverUrl: track.coverUrl,
    type: 'track' as const,
    trackId: track.id,
    action: () => onPlayTrack(track),
  }));

  const playlistQuickItems = filteredPlaylists.map((playlist) => ({
    id: playlist.id,
    title: playlist.title,
    coverUrl: playlist.coverUrl,
    type: 'playlist' as const,
    playlistId: playlist.id,
    action: () => onSelectPlaylist(playlist),
  }));

  const quickItems = [
    {
      id: 'liked-songs',
      title: `Liked Songs${likedTracks.length ? ` · ${likedTracks.length}` : ''}`,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      type: 'library' as const,
      action: () => onSelectTab?.('library'),
    },
    ...recentQuickItems,
    ...playlistQuickItems,
  ].slice(0, 6);

  return (
    <div className="space-y-8 pb-12 select-none">
      {/* Top Gradient Banner Header */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8 bg-gradient-to-b from-[#A855F7]/30 via-[#181818]/70 to-[#121212] border border-white/[0.05]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D946EF] animate-ping" />
              VERTEX Music Audio Engine
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
              {getGreeting()}
            </h1>
          </div>
          {selectedCategory !== 'All' && (
            <span className="px-3 py-1 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#C084FC] text-xs font-bold">
              Category: {selectedCategory}
            </span>
          )}
        </div>

        {/* 2x3 VERTEX Music Quick Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {quickItems.map((item, idx) => (
            <div
              key={item.id}
              data-playlist-id={'playlistId' in item ? item.playlistId : undefined}
              data-track-id={'trackId' in item ? item.trackId : undefined}
              data-context-type={item.type === 'track' ? 'track' : item.type === 'playlist' ? 'playlist' : undefined}
              onClick={item.action}
              style={{ '--stagger-index': idx } as React.CSSProperties}
              className="stagger-item card-interactive group relative flex items-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/5 pr-4 shadow-md transition-all duration-300 hover:bg-white/10"
            >
              <div className="w-16 h-16 flex-shrink-0 relative overflow-hidden">
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="media-fade w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <span className="text-sm font-bold text-white truncate pl-3 flex-1 tracking-tight">
                {item.title}
              </span>

              {/* Hover Floating VERTEX Music Purple/Pink Play Button */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 flex-shrink-0 ml-2">
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* "Made For You" - Playlist Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Made For You</h2>
            <p className="text-xs text-zinc-400">Personalized algorithmic mixes updated daily</p>
          </div>
          <button
            onClick={() => onSelectTab && onSelectTab('browse')}
            className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            Show all
          </button>
        </div>

        {filteredPlaylists.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#181818] border border-white/5 text-center flex flex-col items-center justify-center space-y-3">
            <p className="text-sm font-bold text-white">No Playlists Created Yet</p>
            <p className="text-xs text-zinc-400 max-w-sm">
              Create your first custom playlist and group your favorite songs together.
            </p>
            {onOpenNewPlaylistModal && (
              <button
                onClick={onOpenNewPlaylistModal}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white text-xs font-extrabold shadow-md hover:opacity-90 transition-all"
              >
                + Create Playlist
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredPlaylists.map((playlist, idx) => (
              <div
                key={playlist.id}
                data-playlist-id={playlist.id}
                data-context-type="playlist"
                onClick={() => onSelectPlaylist(playlist)}
                style={{ '--stagger-index': idx } as React.CSSProperties}
                className="stagger-item card-interactive group relative bg-[#181818] hover:bg-[#282828] p-4 rounded-lg transition-all duration-300 cursor-pointer shadow-md flex flex-col justify-between"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow-md">
                  <img
                    src={playlist.coverUrl}
                    alt={playlist.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute right-2 bottom-2 w-11 h-11 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-3 group-hover:translate-y-0 transition-all duration-200">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white truncate tracking-tight">
                    {playlist.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {playlist.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* "Recently Played" Track Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Recently Played</h2>
          <button
            onClick={() => onSelectTab && onSelectTab('browse')}
            className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            Show all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {recentReleaseGroups.map((group, idx) => {
            const track = group.representative;
            const isThisTrackPlaying = group.tracks.some((t) => t.id === currentTrackId) && isPlaying;

            return (
              <div
                key={group.key}
                data-track-id={track.id}
                data-context-type="track"
                onClick={() => {
                  if (onSelectAlbum) onSelectAlbum(track);
                }}
                style={{ '--stagger-index': idx } as React.CSSProperties}
                className="stagger-item card-interactive group relative bg-[#181818] hover:bg-[#282828] p-4 rounded-lg transition-all duration-300 cursor-pointer shadow-md flex flex-col justify-between"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow-md">
                  <img
                    src={group.coverUrl}
                    alt={group.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Floating Purple/Pink Play Button */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayTrack(track);
                    }}
                    className={`absolute right-2 bottom-2 w-11 h-11 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl transition-all duration-200 transform ${
                      isThisTrackPlaying
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0'
                    }`}
                  >
                    {isThisTrackPlaying ? (
                      <Pause className="w-5 h-5 fill-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    )}
                  </div>
                  {isThisTrackPlaying && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#A855F7] text-white text-[9px] font-extrabold">
                      PLAYING
                    </div>
                  )}
                </div>

                <div>
                  <h3
                    className={`text-sm font-bold truncate tracking-tight ${
                      isThisTrackPlaying ? 'text-[#D946EF]' : 'text-white'
                    }`}
                  >
                    {group.title}
                  </h3>
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectArtist) onSelectArtist(track.artist);
                    }}
                    className="text-xs text-zinc-400 truncate mt-1 hover:underline hover:text-[#D946EF]"
                  >
                    {track.artist}
                    {group.isMultiTrack ? ` • ${group.releaseType}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VERTEX Music Popular Tracks Chart List Table */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-4">
          Global Top Songs
        </h2>

        {filteredTracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#181818] border border-white/5 text-center flex flex-col items-center justify-center space-y-3">
            <p className="text-base font-bold text-white">Your Music Library is Empty</p>
            <p className="text-xs text-zinc-400 max-w-md">
              All stock tracks have been removed. Add your own custom songs or use the built-in Web Synthesizer to create your music database!
            </p>
            {onOpenAddTrackModal && (
              <button
                onClick={onOpenAddTrackModal}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white text-xs font-extrabold shadow-lg hover:opacity-90 active:scale-95 transition-all mt-2"
              >
                + Add Your First Song
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#181818]/60 rounded-xl overflow-hidden border border-white/[0.04]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-bold text-zinc-400 border-b border-white/10 uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5 sm:col-span-5">Title</div>
              <div className="hidden sm:block sm:col-span-4">Album</div>
              <div className="col-span-6 sm:col-span-2 flex items-center justify-end pr-2">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/[0.03]">
              {filteredTracks.map((track, idx) => {
                const isSelected = currentTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    data-track-id={track.id}
                    data-context-type="track"
                    onClick={() => {
                      if (onSelectAlbum) onSelectAlbum(track);
                    }}
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
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectArtist) onSelectArtist(track.artist);
                          }}
                          className="text-xs text-zinc-400 truncate hover:underline hover:text-[#D946EF]"
                        >
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Album Name */}
                    <div className="hidden sm:block sm:col-span-4 text-xs text-zinc-400 truncate">
                      {track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}
                    </div>

                    {/* Like & Duration */}
                    <div className="col-span-6 sm:col-span-2 flex items-center justify-end space-x-3 pr-2">
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
        )}
      </div>
    </div>
  );
};
