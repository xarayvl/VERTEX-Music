import React, { useRef, useState } from 'react';
import { Play, Pause, Heart, Clock, ArrowLeft, ListMusic, History } from 'lucide-react';
import { Track, Playlist, Album, TabType } from '../../types';
import { groupTracksByRelease } from '../../utils/artistUtils';
import { LIKED_SONGS_COVER_URL } from '../../utils/profilePlaceholders';

const DEFAULT_GREETING_ACCENT = '#A855F7';

function colorWithAlpha(color: string, alpha: number): string {
  const match = color.trim().match(/^#([\da-f]{6})$/i);
  if (!match) return `rgba(168, 85, 247, ${alpha})`;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function extractDominantCoverColor(source: string): Promise<string> {
  return new Promise((resolve) => {
    if (!source) return resolve(DEFAULT_GREETING_ACCENT);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(DEFAULT_GREETING_ACCENT);
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const buckets = new Map<string, { count: number; red: number; green: number; blue: number; score: number }>();

        for (let index = 0; index < pixels.length; index += 16) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];
          if (alpha < 180) continue;
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const brightness = (max + min) / 2;
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (brightness < 24 || brightness > 238 || saturation < 0.12) continue;
          const key = `${Math.round(red / 32)}-${Math.round(green / 32)}-${Math.round(blue / 32)}`;
          const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0, score: 0 };
          bucket.count += 1;
          bucket.red += red;
          bucket.green += green;
          bucket.blue += blue;
          bucket.score += 1 + saturation * 1.8;
          buckets.set(key, bucket);
        }

        const winner = [...buckets.values()].sort((left, right) => right.score - left.score)[0];
        if (!winner) return resolve(DEFAULT_GREETING_ACCENT);
        const red = Math.round(winner.red / winner.count);
        const green = Math.round(winner.green / winner.count);
        const blue = Math.round(winner.blue / winner.count);
        resolve(`#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`);
      } catch {
        resolve(DEFAULT_GREETING_ACCENT);
      }
    };
    image.onerror = () => resolve(DEFAULT_GREETING_ACCENT);
    image.src = source;
  });
}

interface HomeViewProps {
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  selectedCategory?: string;
  onSelectTab?: (tab: TabType) => void;
  onOpenAddTrackModal?: () => void;
  onOpenNewPlaylistModal?: () => void;
  recentlyPlayed?: Track[];
}

export const HomeView: React.FC<HomeViewProps> = ({
  tracks = [],
  playlists = [],
  albums = [],
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
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
  const [activeHomeSection, setActiveHomeSection] = useState<'overview' | 'playlists' | 'recent'>('overview');
  const [greetingAccent, setGreetingAccent] = useState(DEFAULT_GREETING_ACCENT);
  const [isGreetingAccentActive, setIsGreetingAccentActive] = useState(false);
  const coverColorCache = useRef(new Map<string, string>());
  const hoverRequestId = useRef(0);

  // Keep the last sampled cover color mounted while its overlay fades out.
  // Replacing the gradient with the default purple at the same moment that
  // opacity started changing caused a bright one-frame flash on mouse leave.
  const applyGreetingAccent = (color: string) => {
    setGreetingAccent(color);
    setIsGreetingAccentActive(color !== DEFAULT_GREETING_ACCENT);
  };

  const handleQuickItemEnter = (coverUrl: string, knownAccent?: string) => {
    const requestId = ++hoverRequestId.current;
    if (knownAccent) {
      applyGreetingAccent(knownAccent);
      return;
    }
    const cachedColor = coverColorCache.current.get(coverUrl);
    if (cachedColor) {
      applyGreetingAccent(cachedColor);
      return;
    }
    void extractDominantCoverColor(coverUrl).then((color) => {
      coverColorCache.current.set(coverUrl, color);
      if (hoverRequestId.current === requestId) applyGreetingAccent(color);
    });
  };

  const handleQuickItemLeave = () => {
    hoverRequestId.current += 1;
    setIsGreetingAccentActive(false);
  };

  const playOrToggle = (track: Track) => {
    if (track.id === currentTrackId) onTogglePlay();
    else onPlayTrack(track);
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const filteredTracks = tracks.filter((track) => {
    const genre = (track.genre || '').toLowerCase();
    if (selectedCategory === 'All' || selectedCategory === 'Music') return true;
    if (selectedCategory === 'Podcasts') return genre === 'podcast';
    if (selectedCategory === 'Chill') return ['lo-fi', 'lofi', 'chillout', 'chill'].includes(genre);
    if (selectedCategory === 'Synthwave') return ['synthwave', 'cyberpunk'].includes(genre);
    return true;
  });

  const rankedTracks = [...filteredTracks].sort((left, right) => {
    const playDifference = Number(right.plays || 0) - Number(left.plays || 0);
    if (playDifference !== 0) return playDifference;
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });

  const filteredPlaylists = playlists.filter((p) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Chill') return p.title.toLowerCase().includes('lo-fi') || p.title.toLowerCase().includes('chill');
    if (selectedCategory === 'Synthwave') return p.title.toLowerCase().includes('synth') || p.title.toLowerCase().includes('cyber');
    return true;
  });

  const likedTracks = tracks.filter((t) => t.isLiked);

  // Use only the real user-scoped listening history.
  const validRecentTracks = recentlyPlayed
    .filter((track) => track && tracks.some((candidate) => candidate.id === track.id));
  const allRecentReleaseGroups = groupTracksByRelease(validRecentTracks);
  const recentReleaseGroups = allRecentReleaseGroups.slice(0, 5);

  // The greeting area now includes actual recently played songs instead of
  // being limited to Liked Songs and playlist shortcuts.
  const recentQuickItems = validRecentTracks.slice(0, 5).map((track) => ({
    id: `recent-${track.id}`,
    title: track.title,
    coverUrl: track.coverUrl,
    type: 'track' as const,
    trackId: track.id,
    hoverColor: track.accentColor,
    action: () => playOrToggle(track),
  }));

  const playlistQuickItems = filteredPlaylists.map((playlist) => ({
    id: playlist.id,
    title: playlist.title,
    coverUrl: playlist.coverUrl,
    type: 'playlist' as const,
    playlistId: playlist.id,
    hoverColor: undefined as string | undefined,
    action: () => onSelectPlaylist(playlist),
  }));

  const quickItems = [
    {
      id: 'liked-songs',
      title: `Liked Songs${likedTracks.length ? ` · ${likedTracks.length}` : ''}`,
      coverUrl: LIKED_SONGS_COVER_URL,
      type: 'library' as const,
      hoverColor: DEFAULT_GREETING_ACCENT,
      action: () => onSelectTab?.('library'),
    },
    ...recentQuickItems,
    ...playlistQuickItems,
  ].slice(0, 6);

  if (activeHomeSection !== 'overview') {
    const isPlaylistScreen = activeHomeSection === 'playlists';

    return (
      <div className="workspace-screen min-h-full space-y-6 overflow-x-hidden pb-12 select-none">
        <button
          onClick={() => setActiveHomeSection('overview')}
          className="control-press flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </button>

        <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#2b1738] via-[#19131f] to-[#121212] p-6 shadow-2xl sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#D946EF]/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white shadow-[0_12px_34px_rgba(168,85,247,0.28)]">
              {isPlaylistScreen ? <ListMusic className="h-7 w-7" /> : <History className="h-7 w-7" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D8B4FE]">Home collection</p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                {isPlaylistScreen ? 'All Playlists' : 'Recently Played'}
              </h1>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                {isPlaylistScreen
                  ? `${filteredPlaylists.length} playlist${filteredPlaylists.length === 1 ? '' : 's'} available`
                  : `${allRecentReleaseGroups.length} recent release${allRecentReleaseGroups.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        </header>

        {isPlaylistScreen ? (
          filteredPlaylists.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-[#181818] p-8 text-center">
              <p className="text-sm font-bold text-white">No playlists available</p>
              <p className="mt-2 text-xs text-zinc-400">Create a playlist and it will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredPlaylists.map((playlist, idx) => (
                <div
                  key={playlist.id}
                  data-playlist-id={playlist.id}
                  data-context-type="playlist"
                  onClick={() => onSelectPlaylist(playlist)}
                  style={{ '--stagger-index': idx } as React.CSSProperties}
                  className="stagger-item card-interactive group relative flex cursor-pointer flex-col justify-between rounded-xl bg-[#181818] p-4 shadow-md transition-all duration-300 hover:bg-[#282828]"
                >
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg shadow-md">
                    <img src={playlist.coverUrl} alt={playlist.title} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="mobile-card-action absolute bottom-2 right-2 flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white opacity-0 shadow-2xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                      <Play className="ml-0.5 h-5 w-5 fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">{playlist.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">{playlist.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : allRecentReleaseGroups.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#181818] p-8 text-center">
            <p className="text-sm font-bold text-white">Nothing played yet</p>
            <p className="mt-2 text-xs text-zinc-400">Your listening history will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {allRecentReleaseGroups.map((group, idx) => {
              const track = group.representative;
              const isThisTrackPlaying = group.tracks.some((candidate) => candidate.id === currentTrackId) && isPlaying;
              return (
                <div
                  key={group.key}
                  data-track-id={track.id}
                  data-context-type="track"
                  onClick={() => onSelectAlbum?.(track)}
                  style={{ '--stagger-index': idx } as React.CSSProperties}
                  className="stagger-item card-interactive group relative flex cursor-pointer flex-col justify-between rounded-xl bg-[#181818] p-4 shadow-md transition-all duration-300 hover:bg-[#282828]"
                >
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg shadow-md">
                    <img src={group.coverUrl} alt={group.title} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        playOrToggle(track);
                      }}
                      className={`mobile-card-action absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow-2xl transition-all duration-200 ${
                        isThisTrackPlaying ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                      }`}
                      aria-label={isThisTrackPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                    >
                      {isThisTrackPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="ml-0.5 h-5 w-5 fill-white" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h3 className={`truncate text-sm font-bold ${isThisTrackPlaying ? 'text-[#D946EF]' : 'text-white'}`}>{group.title}</h3>
                    <button
                      data-artist-id={track.userId}
                      data-context-type="artist"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectArtist?.(track.userId || '');
                      }}
                      className="mt-1 block w-full truncate text-left text-xs text-zinc-400 hover:text-[#D946EF] hover:underline"
                    >
                      {track.artist}{group.isMultiTrack ? ` • ${group.releaseType}` : ''}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 select-none">
      {/* Top Gradient Banner Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-b from-[#A855F7]/30 via-[#181818]/70 to-[#121212] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 will-change-opacity transition-opacity duration-700 ease-out"
          style={{
            background: `linear-gradient(to bottom, ${colorWithAlpha(greetingAccent, 0.44)}, rgba(24, 24, 24, 0.72), #121212)`,
            opacity: isGreetingAccentActive ? 1 : 0,
          }}
        />
        <div className="relative mb-6 flex items-center justify-between">
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
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {quickItems.map((item, idx) => (
            <div
              key={item.id}
              data-playlist-id={'playlistId' in item ? item.playlistId : undefined}
              data-track-id={'trackId' in item ? item.trackId : undefined}
              data-context-type={item.type === 'track' ? 'track' : item.type === 'playlist' ? 'playlist' : undefined}
              onClick={item.action}
              onMouseEnter={() => handleQuickItemEnter(item.coverUrl, item.hoverColor)}
              onMouseLeave={handleQuickItemLeave}
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
              <div className={`mobile-card-action w-10 h-10 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-xl transform transition-all duration-200 flex-shrink-0 ml-2 ${
                item.type === 'track' && 'trackId' in item && item.trackId === currentTrackId && isPlaying
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
              }`}>
                {item.type === 'track' && 'trackId' in item && item.trackId === currentTrackId && isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real playlist catalog */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Playlists</h2>
            <p className="text-xs text-zinc-400">Playlists currently available in the catalog</p>
          </div>
          <button
            onClick={() => setActiveHomeSection('playlists')}
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
                  <div className="mobile-card-action absolute right-2 bottom-2 w-11 h-11 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-3 group-hover:translate-y-0 transition-all duration-200">
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
            onClick={() => setActiveHomeSection('recent')}
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
                      playOrToggle(track);
                    }}
                    className={`mobile-card-action absolute right-2 bottom-2 w-11 h-11 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl transition-all duration-200 transform ${
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
                    data-artist-id={track.userId}
                    data-context-type="artist"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectArtist) onSelectArtist(track.userId || '');
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
          Most Played on VERTEX
        </h2>

        {filteredTracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#181818] border border-white/5 text-center flex flex-col items-center justify-center space-y-3">
            <p className="text-base font-bold text-white">Your Music Library is Empty</p>
            <p className="text-xs text-zinc-400 max-w-md">
              No playable tracks have been uploaded yet. Upload a real audio file to start your library.
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
              {rankedTracks.map((track, idx) => {
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
                    <div className="col-span-1 flex items-center justify-center gap-2">
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
                          playOrToggle(track);
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
