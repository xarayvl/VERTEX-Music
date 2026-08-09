import React, { useEffect, useRef, useState } from 'react';
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  User,
  ListMusic,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Check,
  Bot,
} from 'lucide-react';
import { TabType, Track, Playlist, Artist } from '../../types';
import VertexLogo from '../Brand/VertexLogo';

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
  onSelectArtist?: (artist: Artist | string) => void;
  isCompact?: boolean;
  onOpenLikedSongs: () => void;
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
  onSelectArtist,
  isCompact = false,
  onOpenLikedSongs,
}) => {
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'liked' | 'playlists' | 'artists'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const previousPlaylistCountRef = useRef(playlists.length);

  useEffect(() => {
    if (playlists.length > previousPlaylistCountRef.current) {
      setLibraryFilter('playlists');
      setSearchQuery('');
    }
    previousPlaylistCountRef.current = playlists.length;
  }, [playlists.length]);

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
      <div className={`bg-[#121212] rounded-xl flex flex-col border border-white/[0.04] transition-[padding,gap] ${isCompact ? 'p-2 gap-2' : 'p-3 gap-3'}`}>
        {/* VERTEX Music Branding */}
        <div className={`flex min-w-0 items-center py-1 ${isCompact ? 'justify-center px-0' : 'gap-2 px-1'}`} title="VERTEX Music">
          <VertexLogo alt={isCompact ? 'VERTEX Music' : ''} className="h-8 w-8 flex-shrink-0" />
          <div className={isCompact ? 'hidden' : 'flex min-w-0 flex-col'}>
            <span className="truncate whitespace-nowrap text-lg font-extrabold tracking-tight text-white">
              VERTEX Music
            </span>
          </div>
        </div>

        {/* Main Nav Items */}
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => onSelectTab('home')}
            title="Home"
            className={`group flex min-w-0 items-center overflow-hidden rounded-lg text-sm font-bold transition-all duration-200 ${isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${
              activeTab === 'home'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className={`h-6 w-6 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'home' ? 'text-white' : 'text-zinc-400'}`} />
            <span className={isCompact ? 'hidden' : 'min-w-0 truncate whitespace-nowrap'}>Home</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            title="Search"
            className={`group flex min-w-0 items-center overflow-hidden rounded-lg text-sm font-bold transition-all duration-200 ${isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${
              activeTab === 'search'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className={`h-6 w-6 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'search' ? 'text-white' : 'text-zinc-400'}`} />
            <span className={isCompact ? 'hidden' : 'min-w-0 truncate whitespace-nowrap'}>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('browse')}
            title="Explore Genres"
            className={`group flex min-w-0 items-center overflow-hidden rounded-lg text-sm font-bold transition-all duration-200 ${isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${
              activeTab === 'browse'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className={`h-6 w-6 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'browse' ? 'text-[#D946EF]' : 'text-zinc-400'}`} />
            <span className={isCompact ? 'hidden' : 'min-w-0 truncate whitespace-nowrap'}>Explore Genres</span>
          </button>

          <button
            onClick={() => onSelectTab('chat')}
            title="AI DJ Chat"
            className={`group flex min-w-0 items-center overflow-hidden rounded-lg text-sm font-bold transition-all duration-200 ${isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${
              activeTab === 'chat'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className={`h-6 w-6 shrink-0 ${activeTab === 'chat' ? 'text-[#D946EF]' : 'text-zinc-400'}`} />
            <span className={isCompact ? 'hidden' : 'flex min-w-0 items-center gap-1.5'}>
              <span className="truncate whitespace-nowrap">AI DJ Chat</span>
            </span>
          </button>

          <button
            onClick={() => onSelectTab('profile')}
            title="Profile & Account"
            className={`group flex min-w-0 items-center overflow-hidden rounded-lg text-sm font-bold transition-all duration-200 ${isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${
              activeTab === 'profile'
                ? 'text-white bg-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="h-6 w-6 shrink-0 text-zinc-400 transition-transform group-hover:scale-110 group-hover:text-white" />
            <span className={isCompact ? 'hidden' : 'min-w-0 truncate whitespace-nowrap'}>Profile & Account</span>
          </button>
        </nav>
      </div>

      {/* Library Block */}
      <div className={`bg-[#121212] rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden border border-white/[0.04] transition-[padding] ${isCompact ? 'p-2' : 'p-3'}`}>
        {/* Library Header */}
        <div className={`flex items-center px-2 py-2 ${isCompact ? 'justify-center' : 'justify-between'}`}>
          <button
            onClick={() => onSelectTab('library')}
            title="Your Library"
            className={`flex items-center text-zinc-400 hover:text-white font-bold text-sm transition-colors group ${isCompact ? 'justify-center' : 'space-x-3'}`}
          >
            <Library className="w-6 h-6 group-hover:text-white transition-colors" />
            <span className={isCompact ? 'hidden' : 'truncate whitespace-nowrap tracking-tight'}>Your Library</span>
          </button>

          <div className={isCompact ? 'hidden' : 'flex items-center space-x-1'}>
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
        <div className={`${isCompact ? 'hidden' : 'flex'} items-center space-x-2 px-2 py-2 overflow-x-auto scrollbar-none`}>
          <button
            onClick={() => setLibraryFilter(libraryFilter === 'liked' ? 'all' : 'liked')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              libraryFilter === 'liked'
                ? 'bg-white text-black font-bold'
                : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Liked Songs
          </button>
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
        <div className={`${isCompact ? 'hidden' : 'flex'} px-2 py-1.5 items-center justify-between`}>
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
          {(libraryFilter === 'all' || libraryFilter === 'liked') && <div
            onClick={onOpenLikedSongs}
            title="Liked Songs"
            className={`flex items-center p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-colors ${isCompact ? 'justify-center' : 'space-x-3'}`}
          >
            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <div className={isCompact ? 'hidden' : 'min-w-0 flex-1'}>
              <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                Liked Songs
              </h4>
              <p className="text-xs text-zinc-400 truncate flex items-center gap-1">
                <span>Playlist</span> • <span>{likedTracks.length} songs</span>
              </p>
            </div>
          </div>}

          {/* Playlists */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
            filteredPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                data-playlist-id={playlist.id}
                data-context-type="playlist"
                onClick={() => onSelectPlaylist(playlist)}
                title={playlist.title}
                className={`flex items-center p-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer group transition-colors ${isCompact ? 'justify-center' : 'space-x-3'}`}
              >
                <img
                  src={playlist.coverUrl}
                  alt={playlist.title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0 shadow-md"
                />
                <div className={isCompact ? 'hidden' : 'min-w-0 flex-1'}>
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                    {playlist.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">
                    Playlist • {playlist.trackCount} tracks
                  </p>
                </div>
              </div>
            ))}

          {/* Followed artists always come after playlists in Your Library. */}
          {(libraryFilter === 'all' || libraryFilter === 'artists') &&
            filteredArtists.map((artist) => (
              <div
                key={artist.id}
                data-artist-id={artist.id}
                data-context-type="artist"
                onClick={() => onSelectArtist?.(artist)}
                title={artist.name}
                className={`flex items-center rounded-lg p-2 transition-colors hover:bg-[#1f1f1f] cursor-pointer group ${isCompact ? 'justify-center' : 'space-x-3'}`}
              >
                <img src={artist.avatarUrl} alt={artist.name} referrerPolicy="no-referrer" className="h-12 w-12 flex-shrink-0 rounded-full border border-white/10 object-cover shadow-md" />
                <div className={isCompact ? 'hidden' : 'min-w-0 flex-1'}>
                  <h4 className="truncate text-sm font-bold text-white transition-colors group-hover:text-[#D946EF]">{artist.name}</h4>
                  <p className="truncate text-xs text-zinc-400">Artist</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
};
