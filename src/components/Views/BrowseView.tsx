import React, { useState } from 'react';
import { Disc, Play, Heart } from 'lucide-react';
import { Track, Playlist, Artist } from '../../types';
import { BROWSE_CATEGORIES } from '../../data/browseCategories';

interface BrowseViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  onPlayTrack: (track: Track) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectAlbum?: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onSelectArtist?: (artist: Artist) => void;
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  tracks = [],
  playlists = [],
  artists = [],
  onPlayTrack,
  onSelectPlaylist,
  onSelectAlbum,
  onToggleLike,
  onSelectArtist,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryGenres: Record<string, string[]> = {
    'Synthwave & Retro': ['synthwave', 'retro'],
    'Ambient & Atmospheric': ['ambient', 'atmospheric'],
    'Cyberpunk & EDM': ['cyberpunk', 'edm', 'electronic'],
    'Lofi & Chill Beats': ['lofi', 'lo-fi', 'chill', 'chillout'],
    'Acoustic & Unplugged': ['acoustic', 'unplugged'],
  };

  const filteredTracks = selectedCategory === 'Popular on VERTEX'
    ? [...tracks].sort((left, right) => Number(right.plays || 0) - Number(left.plays || 0))
    : selectedCategory
      ? tracks.filter((track) => {
          const genre = (track.genre || '').toLowerCase();
          return (categoryGenres[selectedCategory] || []).some((candidate) => genre.includes(candidate));
        })
      : tracks;

  return (
    <div className="space-y-8 pb-12 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Explore & Browse</h1>
        <p className="text-xs text-zinc-400 mt-1">Discover new music by genre and artist</p>
      </div>

      {/* VERTEX Music Colorful Genre Cards Grid */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-4">Browse All</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {BROWSE_CATEGORIES.map((cat, idx) => (
            <div
              key={idx}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
              }
              className={`group relative overflow-hidden rounded-xl p-4 h-32 cursor-pointer transition-all duration-300 shadow-lg border ${
                selectedCategory === cat.name
                  ? 'border-[#D946EF] ring-2 ring-[#D946EF] scale-105'
                  : 'border-white/5 hover:scale-[1.02]'
              } bg-gradient-to-br ${cat.gradient}`}
            >
              <h3 className="text-xl font-black text-white tracking-tight max-w-[70%] leading-tight">
                {cat.name}
              </h3>

              {/* Angled Album Artwork or Disc Badge */}
              <div className="absolute -bottom-3 -right-3 w-20 h-20 rounded-lg bg-black/30 border border-white/20 backdrop-blur-md flex items-center justify-center transform rotate-25 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300">
                <Disc className="w-10 h-10 text-white/90" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Genre-Filtered Track Results (only shown once a real genre is picked above) */}
      {selectedCategory && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {selectedCategory} Tracks
          </h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-xs font-bold text-[#D946EF] hover:underline"
          >
            Clear Filter
          </button>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400">
            <Disc className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-bold text-white">No tracks in this genre yet</p>
            <p className="text-xs text-zinc-500 mt-1">Try another category or check back later.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTracks.map((track) => (
            <div
              key={track.id}
              data-track-id={track.id}
              data-context-type="track"
              onClick={() => {
                onPlayTrack(track);
                if (onSelectAlbum) onSelectAlbum(track);
              }}
              className="group cursor-pointer rounded-lg p-3 bg-[#181818] hover:bg-[#282828] transition-all flex items-center justify-between shadow"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded object-cover flex-shrink-0 shadow"
                />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D946EF] transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLike(track.id);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-white"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      track.isLiked ? 'fill-[#D946EF] text-[#D946EF]' : ''
                    }`}
                  />
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center hover:scale-105 transition-transform shadow">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
      )}

      {/* Artists Section */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {artists.map((artist) => {
            const artistTrack = tracks.find((track) => track.userId === artist.id);
            return (
              <div
                key={artist.id}
                data-artist-id={artist.id}
                data-context-type="artist"
                onClick={() => { if (onSelectArtist) onSelectArtist(artist); else if (artistTrack) onPlayTrack(artistTrack); }}
                className="bg-[#181818] hover:bg-[#282828] p-4 rounded-xl text-center flex flex-col items-center group cursor-pointer transition-all shadow"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-[#D946EF] transition-colors shadow-lg">
                  <img
                    src={artist.avatarUrl}
                    alt={artist.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-sm font-bold text-white truncate w-full group-hover:text-[#D946EF]">
                  {artist.name}
                </h4>
                <p className="text-xs text-zinc-400 mt-1">Artist</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
