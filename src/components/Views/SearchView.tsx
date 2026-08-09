import React, { useState } from 'react';
import { Search, X, Play, Pause, Heart, ShieldCheck, User as UserIcon, Disc, ArrowRight } from 'lucide-react';
import { Track, Playlist, Artist, UserProfile } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

interface SearchViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  userProfile?: UserProfile | null;
  currentTrackId?: string;
  isPlaying?: boolean;
  onPlayTrack: (track: Track) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist?: (artist: Artist | UserProfile | string) => void;
  onSelectAlbum?: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

interface SearchArtistItem extends Partial<Artist>, Partial<UserProfile> {
  id: string;
  name: string;
  username?: string;
  displayName?: string;
  avatarUrl: string;
  bio?: string;
  genre?: string;
  totalStreamsLabel?: string;
  verified?: boolean;
  isUser?: boolean;
}

export const SearchView: React.FC<SearchViewProps> = ({
  tracks: initialTracks = [],
  playlists: initialPlaylists = [],
  artists: initialArtists = [],
  userProfile,
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  onSelectPlaylist,
  onSelectArtist,
  onSelectAlbum,
  onToggleLike,
  searchQuery: externalQuery,
  onSearchChange,
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'playlists'>('all');
  const query = externalQuery !== undefined ? externalQuery : internalQuery;

  const handleQueryChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    setInternalQuery(val);
  };

  const trendingSearches = Array.from(
    new Set([
      ...initialTracks.flatMap((track) => [track.title, track.artist, track.genre]),
      ...initialArtists.map((artist) => artist.name),
      ...initialPlaylists.map((playlist) => playlist.title),
    ].map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).slice(0, 8);

  // The complete searchable catalogue is already part of the periodically
  // refreshed application snapshot. Filtering it locally avoids one backend
  // request per keystroke and keeps search responsive during API throttling.
  const qLower = query.trim().toLowerCase();

  const localMatchedTracks = initialTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(qLower) ||
      t.artist.toLowerCase().includes(qLower) ||
      t.album.toLowerCase().includes(qLower) ||
      t.genre.toLowerCase().includes(qLower)
  );

  const matchedTracks: Track[] = localMatchedTracks;

  // Local user profile check for Artists/Users search
  const localMatchedUsers: SearchArtistItem[] = [];
  const currentUserIsArtist = Boolean(userProfile && (userProfile.isArtist || initialTracks.some((track) => track.userId === userProfile.id)));
  if (userProfile && currentUserIsArtist) {
    if (
      userProfile.displayName?.toLowerCase().includes(qLower) ||
      userProfile.username?.toLowerCase().includes(qLower) ||
      userProfile.artistName?.toLowerCase().includes(qLower)
    ) {
      localMatchedUsers.push({
        id: userProfile.id,
        name: userProfile.artistName || userProfile.displayName || userProfile.username,
        username: userProfile.username,
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl,
        bannerUrl: userProfile.bannerUrl,
        bio: userProfile.artistBio || userProfile.bio,
        genre: userProfile.favoriteGenres?.[0] || '',
        totalStreamsLabel: userProfile.totalStreamsLabel || '0 total streams',
        verified: userProfile.artistVerified === true,
        stats: userProfile.stats,
        instagramUrl: userProfile.instagramUrl,
        twitterUrl: userProfile.twitterUrl,
        websiteUrl: userProfile.websiteUrl,
        isUser: true,
      });
    }
  }

  const localMatchedArtists: SearchArtistItem[] = initialArtists
    .filter(
      (a) =>
        a.name.toLowerCase().includes(qLower) ||
        (a.genre && a.genre.toLowerCase().includes(qLower))
    )
    .map((a) => ({ ...a, isUser: a.isUser ?? false }));

  const matchedArtists: SearchArtistItem[] = Array.from(
    new Map(
      [...localMatchedUsers, ...localMatchedArtists]
        .filter((a) => Boolean(a.id))
        .map((a) => [a.id, a])
    ).values()
  );

  const localMatchedPlaylists = initialPlaylists.filter(
    (p) =>
      p.title.toLowerCase().includes(qLower) ||
      (p.description && p.description.toLowerCase().includes(qLower))
  );

  const matchedPlaylists: Playlist[] = localMatchedPlaylists;

  // Top Result determination
  const topResult =
    matchedTracks.length > 0
      ? { type: 'track' as const, item: matchedTracks[0] }
      : matchedArtists.length > 0
      ? { type: 'artist' as const, item: matchedArtists[0] }
      : matchedPlaylists.length > 0
      ? { type: 'playlist' as const, item: matchedPlaylists[0] }
      : null;
  const isTopResultPlaying = Boolean(
    topResult?.type === 'track' && topResult.item?.id === currentTrackId && isPlaying
  );

  const handleArtistClick = (art: SearchArtistItem) => {
    if (!onSelectArtist) return;
    // Ownership must be decided by id only. Comparing username/displayName/
    // artistName as a fallback is unsafe: two different artists can share a
    // display name (or both simply have no username set, making
    // `undefined === undefined` true), which would wrongly redirect a click
    // on SOMEONE ELSE's artist card to your own profile — showing Edit
    // controls on an artist that isn't yours, or hiding a real artist you
    // were trying to view behind your own profile. `art.id` is already the
    // real user id for your own entry (see localMatchedUsers above and the
    // server's /api/search response), so a strict id check is sufficient.
    if (userProfile && art.id === userProfile.id) {
      onSelectArtist(userProfile as any);
      return;
    }
    // Pass artist or item object
    onSelectArtist(art as any);
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden pb-12 select-none">
      {/* Header & Search Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Search</h1>
        </div>

        <div className="relative w-full max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search tracks, artists, or playlists..."
            className="w-full pl-12 pr-10 py-3 rounded-full bg-[#242424] border border-white/5 text-sm text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#A855F7] shadow-inner transition-all"
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      {query && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'songs', label: `Songs (${matchedTracks.length})` },
            { id: 'artists', label: `Artists & Users (${matchedArtists.length})` },
            { id: 'playlists', label: `Playlists (${matchedPlaylists.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as typeof filterType)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow-lg sm:scale-105'
                  : 'bg-white/10 text-zinc-300 hover:text-white hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Browse categories when search is empty */}
      {!query && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Explore the current catalog
            </h3>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQueryChange(tag)}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#18181a] hover:bg-[#28282d] text-zinc-200 border border-white/5 transition-all shadow hover:border-[#D946EF]/50"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Browse Music Categories
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              {[
                { title: 'Synthwave & Cyber', color: 'from-purple-600 to-indigo-700', query: 'Synthwave' },
                { title: 'Lo-Fi Chill Beats', color: 'from-fuchsia-600 to-pink-700', query: 'Lo-Fi' },
                { title: 'Ambient & Atmospheric', color: 'from-indigo-600 to-purple-800', query: 'Ambient' },
                { title: 'Chiptune Retro', color: 'from-pink-600 to-rose-700', query: 'Chiptune' },
              ].map((cat, i) => (
                <div
                  key={i}
                  onClick={() => handleQueryChange(cat.query)}
                  className={`bg-gradient-to-br ${cat.color} p-4 rounded-2xl h-28 flex flex-col justify-between cursor-pointer hover:scale-[1.03] transition-transform shadow-xl relative overflow-hidden group`}
                >
                  <h4 className="text-base font-extrabold text-white tracking-tight">{cat.title}</h4>
                  <span className="text-xs text-white/90 font-bold uppercase tracking-wider flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>Explore</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Categorized Results View */}
      {query && (
        <div className="space-y-8">
          {/* Top Result Card & Songs Section */}
          {(filterType === 'all' || filterType === 'songs') && (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
              {/* TOP RESULT CARD (5 columns) */}
              {topResult && filterType === 'all' && (
                <div
                  data-track-id={topResult.type === 'track' ? topResult.item.id : undefined}
                  data-artist-id={topResult.type === 'artist' ? topResult.item.id : undefined}
                  data-playlist-id={topResult.type === 'playlist' ? topResult.item.id : undefined}
                  data-context-type={topResult.type}
                  className={`group relative self-start rounded-2xl border border-white/10 bg-[#18181a] p-5 shadow-xl transition-all hover:border-[#D946EF]/40 md:col-span-5 ${topResult.type === 'track' ? 'pb-20' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                        Top Result
                      </h3>
                      <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-[#D946EF]/20 text-[#D946EF] border border-[#D946EF]/30">
                        {topResult.type}
                      </span>
                    </div>

                    {topResult.type === 'track' && (
                      <div onClick={() => {
                        if (onSelectAlbum) onSelectAlbum(topResult.item);
                      }}>
                        <img
                          src={topResult.item.coverUrl}
                          alt={topResult.item.title}
                          referrerPolicy="no-referrer"
                          className="w-28 h-28 rounded-xl object-cover shadow-2xl mb-4 border border-white/10"
                        />
                        <h2 className="text-2xl font-extrabold text-white tracking-tight group-hover:text-[#D946EF] transition-colors truncate w-full max-w-full block">
                          {topResult.item.title}
                        </h2>
                        <p className="text-xs font-medium text-zinc-400 mt-1">
                          Song • <span 
                            data-artist-id={topResult.item.userId}
                            data-context-type="artist"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectArtist) onSelectArtist(topResult.item.userId || '');
                            }}
                            className="text-white font-bold hover:underline hover:text-[#D946EF] cursor-pointer"
                          >
                            {topResult.item.artist}
                          </span>
                        </p>
                      </div>
                    )}

                    {topResult.type === 'artist' && (
                      <div data-artist-id={topResult.item.id} data-context-type="artist" onClick={() => handleArtistClick(topResult.item)}>
                        <img
                          src={topResult.item.avatarUrl}
                          alt={topResult.item.name}
                          referrerPolicy="no-referrer"
                          className="w-28 h-28 rounded-full object-cover shadow-2xl mb-4 border-2 border-[#D946EF]/50"
                        />
                        <div className="flex items-center space-x-1.5">
                        <h2 className="text-2xl font-extrabold text-white tracking-tight group-hover:text-[#D946EF] transition-colors truncate w-full max-w-full block">
                            {topResult.item.name}
                          </h2>
                          {topResult.item.verified && (
                            <ShieldCheck className="w-5 h-5 text-[#D946EF] fill-[#D946EF]/20" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-zinc-400 mt-1">
                          {topResult.item.username ? `@${topResult.item.username} • ` : ''}
                          <span className="text-white font-bold">
                            {topResult.item.isUser ? 'User Profile' : 'Artist'}
                          </span>
                        </p>
                      </div>
                    )}

                    {topResult.type === 'playlist' && (
                      <div onClick={() => onSelectPlaylist(topResult.item)}>
                        <img
                          src={topResult.item.coverUrl}
                          alt={topResult.item.title}
                          referrerPolicy="no-referrer"
                          className="w-28 h-28 rounded-xl object-cover shadow-2xl mb-4 border border-white/10"
                        />
                        <h2 className="text-2xl font-extrabold text-white tracking-tight group-hover:text-[#D946EF] transition-colors truncate w-full max-w-full block">
                          {topResult.item.title}
                        </h2>
                        <p className="text-xs font-medium text-zinc-400 mt-1 line-clamp-1">
                          Playlist • <span className="text-white font-bold">{topResult.item.description || 'Custom Playlist'}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Play / View Button */}
                  {topResult.type === 'track' && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(topResult.item);
                      }}
                      className={`mobile-card-action absolute right-5 bottom-5 w-12 h-12 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center shadow-2xl transform transition-all duration-200 cursor-pointer ${
                        isTopResultPlaying
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
                      }`}
                    >
                      {isTopResultPlaying ? (
                        <Pause className="w-6 h-6 fill-white" />
                      ) : (
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      )}
                    </div>
                  )}

                  {topResult.type === 'artist' && (
                    <button
                      onClick={() => handleArtistClick(topResult.item)}
                      className="mt-5 w-fit px-4 py-2 bg-white/10 hover:bg-[#D946EF] hover:text-white text-zinc-200 rounded-full text-xs font-extrabold transition-all"
                    >
                      View Profile
                    </button>
                  )}

                  {topResult.type === 'playlist' && (
                    <button
                      onClick={() => onSelectPlaylist(topResult.item)}
                      className="mt-5 w-fit px-4 py-2 bg-white/10 hover:bg-[#D946EF] hover:text-white text-zinc-200 rounded-full text-xs font-extrabold transition-all"
                    >
                      Open Playlist
                    </button>
                  )}
                </div>
              )}

              {/* SONGS SECTION */}
              <div className={filterType === 'all' && topResult ? 'md:col-span-7' : 'col-span-12'}>
                <h3 className="text-lg font-extrabold text-white tracking-tight mb-3 flex items-center space-x-2">
                  <Disc className="w-4 h-4 text-[#D946EF]" />
                  <span>Songs</span>
                </h3>

                {matchedTracks.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4">No matching songs found.</p>
                ) : (
                  <div className="space-y-1">
                    {matchedTracks.slice(0, filterType === 'all' ? 5 : 15).map((track) => {
                      const isThisTrackPlaying = currentTrackId === track.id && isPlaying;
                      return (
                      <div
                        key={track.id}
                        data-track-id={track.id}
                        data-context-type="track"
                        onClick={() => {
                          if (onSelectAlbum) onSelectAlbum(track);
                        }}
                        className="p-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="relative flex-shrink-0">
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-white/10"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayTrack(track);
                              }}
                              className={`absolute inset-0 bg-black/60 items-center justify-center rounded-lg ${
                                isThisTrackPlaying ? 'flex' : 'hidden group-hover:flex'
                              }`}
                              title={isThisTrackPlaying ? 'Pause' : 'Play'}
                            >
                              {isThisTrackPlaying ? (
                                <Pause className="w-4 h-4 fill-white" />
                              ) : (
                                <Play className="w-4 h-4 fill-white ml-0.5" />
                              )}
                            </button>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
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
                              {track.artist} {track.album ? `• ${track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLike(track.id);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                track.isLiked ? 'fill-[#D946EF] text-[#D946EF]' : ''
                              }`}
                            />
                          </button>
                          <span className="hidden text-xs font-mono text-zinc-400 sm:inline">
                            {Math.floor(track.duration / 60)}:
                            {track.duration % 60 < 10 ? '0' : ''}
                            {track.duration % 60}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ARTISTS & USERS SECTION */}
          {(filterType === 'all' || filterType === 'artists') && (
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight mb-4 flex items-center space-x-2">
                <UserIcon className="w-4 h-4 text-[#A855F7]" />
                <span>Artists & User Profiles</span>
              </h3>

              {matchedArtists.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-2">No matching artists or user profiles found.</p>
              ) : (
                <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {matchedArtists.map((art) => (
                    <div
                      key={art.id || art.name}
                      data-artist-id={art.id}
                      data-context-type="artist"
                      onClick={() => handleArtistClick(art)}
                      className="group flex self-start cursor-pointer flex-col items-center rounded-2xl border border-white/5 bg-[#18181a] p-3 text-center shadow-md transition-all hover:border-[#D946EF]/40 hover:bg-[#222226] hover:shadow-xl sm:p-4"
                    >
                      <div className="relative mb-3">
                        <img
                          src={art.avatarUrl}
                          alt={art.name}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-white/10 group-hover:scale-105 group-hover:border-[#D946EF] transition-all"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              DEFAULT_AVATAR_URL;
                          }}
                        />
                        {art.verified && (
                          <div className="absolute bottom-0 right-0 bg-[#18181a] p-0.5 rounded-full">
                            <ShieldCheck className="w-4 h-4 text-[#D946EF] fill-[#D946EF]" />
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-white truncate w-full group-hover:text-[#D946EF] transition-colors">
                        {art.name}
                      </h4>

                      <p className="mt-0.5 w-full truncate text-xs text-zinc-400">
                        {art.username ? `@${art.username}` : art.genre || 'Artist'}
                      </p>

                      <span className="mt-2 max-w-full truncate rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-zinc-300 transition-colors group-hover:bg-[#D946EF]/20 group-hover:text-[#D946EF] sm:px-2.5 sm:text-[9px]">
                        {art.isUser ? 'User Profile' : art.verified ? 'Verified Artist' : 'Catalog Artist'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PLAYLISTS SECTION */}
          {(filterType === 'all' || filterType === 'playlists') && (
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight mb-4 flex items-center space-x-2">
                <Disc className="w-4 h-4 text-[#D946EF]" />
                <span>Playlists</span>
              </h3>

              {matchedPlaylists.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-2">No matching playlists found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {matchedPlaylists.map((pl) => (
                    <div
                      key={pl.id}
                      data-playlist-id={pl.id}
                      data-context-type="playlist"
                      onClick={() => onSelectPlaylist(pl)}
                      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-white/5 bg-[#18181a] p-3 shadow-md transition-all hover:border-[#D946EF]/40 hover:bg-[#222226] hover:shadow-xl sm:p-4"
                    >
                      <img
                        src={pl.coverUrl}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-square rounded-xl object-cover mb-3 shadow-md border border-white/10 group-hover:scale-105 transition-transform"
                      />
                      <div>
                        <h4 className="text-sm font-extrabold text-white truncate group-hover:text-[#D946EF] transition-colors">
                          {pl.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-1">
                          {pl.description || 'Curated Playlist'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
