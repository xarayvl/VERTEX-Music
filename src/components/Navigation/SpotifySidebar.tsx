import React, { useState } from 'react';
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  Music,
  User,
  ListMusic,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Check,
  Bot,
} from 'lucide-react';
import { TabType, Track, Playlist, Artist } from '../../types';

interface SpotifySidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  playlists: Playlist[];
  artists: Artist[];
  tracks: Track[];
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenNewPlaylistModal: () => void;
  onPlayTrack: (track: Track) => void;
  currentTrackId?: string;
  onOpenProfileModal?: () => void;
  style?: React.CSSProperties;
  recentlyPlayed?: Track[];
  onSelectAlbum?: (track: Track) => void;
}

export const SpotifySidebar: React.FC<SpotifySidebarProps> = ({
  activeTab,
  onSelectTab,
  playlists,
  artists,
  tracks,
  onSelectPlaylist,
  onOpenNewPlaylistModal,
  onPlayTrack,
  currentTrackId,
  onOpenProfileModal,
  style,
  recentlyPlayed = [],
  onSelectAlbum,
}) => {
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'artists'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const likedTracks = tracks.filter((t) => t.isLiked);

  const filteredPlaylists = playlists.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArtists = artists.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      data-context-type="sidebar"
      style={style}
      className="w-full flex-shrink-0 flex flex-col gap-2 select-none h-full text-zinc-300"
    >
      {/* Navigation Block (Home & Search) */}
      <div className="bg-[#121212] rounded-xl p-4 flex flex-col gap-4 border border-white/[0.04]">
        {/* VERTEX Music Branding */}
        <div className="flex items-center space-x-3 px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.4)]">
            <Music className="w-5 h-5 fill-white text-white stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-extrabold text-lg tracking-tight">
              VERTEX Music
            </span>
          </div>
        </div>

        {/* Main Nav Items */}
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center space-x-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 group ${
              activeTab === 'home'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className={`w-6 h-6 transition-transform group-hover:scale-110 ${activeTab === 'home' ? 'text-white' : 'text-zinc-400'}`} />
            <span>Home</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center space-x-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 group ${
              activeTab === 'search'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className={`w-6 h-6 transition-transform group-hover:scale-110 ${activeTab === 'search' ? 'text-white' : 'text-zinc-400'}`} />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('browse')}
            className={`flex items-center space-x-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 group ${
              activeTab === 'browse'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className={`w-6 h-6 transition-transform group-hover:scale-110 ${activeTab === 'browse' ? 'text-[#D946EF]' : 'text-zinc-400'}`} />
            <span>Explore Genres</span>
          </button>

          <button
            onClick={() => onSelectTab('chat')}
            className={`flex items-center space-x-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 group ${
              activeTab === 'chat'
                ? 'text-white bg-[#A855F7]/20 border border-[#A855F7]/40'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className={`w-6 h-6 transition-transform group-hover:scale-110 ${activeTab === 'chat' ? 'text-[#D946EF]' : 'text-[#D946EF]'}`} />
            <span className="flex items-center gap-1.5">
              <span>AI DJ Chat</span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white">New</span>
            </span>
          </button>

          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center space-x-4 px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 group ${
              activeTab === 'profile'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-6 h-6 transition-transform group-hover:scale-110 text-zinc-400 group-hover:text-white" />
            <span>Profile & Account</span>
          </button>
        </nav>
      </div>

      {/* Library Block */}
      <div className="bg-[#121212] rounded-xl p-3 flex-1 flex flex-col min-h-0 overflow-hidden border border-white/[0.04]">
        {/* Library Header */}
        <div className="flex items-center justify-between px-2 py-2">
          <button
            onClick={() => onSelectTab('library')}
            className="flex items-center space-x-3 text-zinc-400 hover:text-white font-bold text-sm transition-colors group"
          >
            <Library className="w-6 h-6 group-hover:text-white transition-colors" />
            <span className="tracking-tight">Your Library</span>
          </button>

          <div className="flex items-center space-x-1">
            <button
              onClick={onOpenNewPlaylistModal}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95"
              title="Create Playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSelectTab('library')}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95"
              title="Expand Library"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 px-2 py-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setLibraryFilter(libraryFilter === 'playlists' ? 'all' : 'playlists')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              libraryFilter === 'playlists'
                ? 'bg-white text-black font-bold'
                : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setLibraryFilter(libraryFilter === 'artists' ? 'all' : 'artists')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              libraryFilter === 'artists'
                ? 'bg-white text-black font-bold'
                : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Artists
          </button>
        </div>

        {/* Search inside Library */}
        <div className="px-2 py-1.5 flex items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in Your Library"
              className="w-full bg-transparent pl-8 pr-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:bg-white/5 rounded-md transition-all"
            />
          </div>
        </div>

        {/* Scrollable Library Contents */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar mt-1">
          {/* Liked Songs Tile */}
          <div
            onClick={() => onSelectTab('library')}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-colors"
          >
            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                Liked Songs
              </h4>
              <p className="text-xs text-zinc-400 truncate flex items-center gap-1">
                <span>Playlist</span> • <span>{likedTracks.length} songs</span>
              </p>
            </div>
          </div>

          {/* Recently Played List */}
          {recentlyPlayed && recentlyPlayed.length > 0 && (
            <div className="pt-2 pb-1 border-t border-white/5 mt-1">
              <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider px-2 mb-1">
                Recently Played
              </p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {recentlyPlayed.map((track) => (
                  <div
                    key={`sidebar-recent-${track.id}`}
                    data-track-id={track.id}
                    data-context-type="track"
                    onClick={() => {
                      if (onSelectAlbum) {
                        onSelectAlbum(track);
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-all"
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-md object-cover flex-shrink-0 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                        {track.title}
                      </h5>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
            filteredPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                data-playlist-id={playlist.id}
                data-context-type="playlist"
                onClick={() => onSelectPlaylist(playlist)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-colors"
              >
                <img
                  src={playlist.coverUrl}
                  alt={playlist.title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0 shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                    {playlist.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">
                    Playlist • {playlist.trackCount} tracks
                  </p>
                </div>
              </div>
            ))}

          {/* Saved Artists */}
          {(libraryFilter === 'all' || libraryFilter === 'artists') &&
            filteredArtists.map((artist) => {
              const artistTrack = tracks.find((t) => t.artist === artist.name) || tracks[0];
              return (
                <div
                  key={artist.id}
                  data-artist-id={artist.id}
                  data-artist-name={artist.name}
                  data-context-type="artist"
                  onClick={() => onPlayTrack(artistTrack)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-colors"
                >
                  <img
                    src={artist.avatarUrl}
                    alt={artist.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 shadow-md border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                      {artist.name}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">Artist</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </aside>
  );
};
