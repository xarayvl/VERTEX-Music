import React, { useState } from 'react';
import { Disc, Play, Pause, Heart } from 'lucide-react';
import { Track, Playlist, Artist } from '../../types';
import { BROWSE_CATEGORIES } from '../../data/browseCategories';
import { useI18n } from '../../i18n/I18nContext';

interface BrowseViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  currentTrackId?: string;
  isPlaying?: boolean;
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
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  onSelectPlaylist,
  onSelectAlbum,
  onToggleLike,
  onSelectArtist,
}) => {
  const { t } = useI18n();
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
    <div className="space-y-7 pb-12 select-none sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="break-words text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('Explore & Browse')}</h1>
        <p className="text-xs text-zinc-400 mt-1">{t('Discover new music by genre and artist')}</p>
      </div>

      {/* VERTEX Music Colorful Genre Cards Grid */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-4">{t('Browse All')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
          {BROWSE_CATEGORIES.map((cat, idx) => (
            <div
              key={idx}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
              }
              className={`group relative h-32 cursor-pointer overflow-hidden rounded-xl border p-3 shadow-lg transition-all duration-300 sm:p-4 ${
                selectedCategory === cat.name
                  ? 'border-[#D946EF] ring-2 ring-[#D946EF] sm:scale-105'
                  : 'border-white/5 hover:scale-[1.02]'
              } bg-gradient-to-br ${cat.gradient}`}
            >
              <h3 className="max-w-[72%] break-words text-base font-black leading-tight tracking-tight text-white sm:text-xl">
                {t(cat.name)}
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-lg font-extrabold tracking-tight text-white sm:text-xl">
            {t(selectedCategory)} {t('Tracks')}
          </h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className="shrink-0 text-xs font-bold text-[#D946EF] hover:underline"
          >
            {t('Clear Filter')}
          </button>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#181818]/70 border border-white/5 text-center text-zinc-400">
            <Disc className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-bold text-white">{t('No tracks in this genre yet')}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('Try another category or check back later.')}</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTracks.map((track) => {
            const isThisTrackPlaying = currentTrackId === track.id && isPlaying;
            return (
            <div
              key={track.id}
              data-track-id={track.id}
              data-context-type="track"
              onClick={() => {
                if (onSelectAlbum) onSelectAlbum(track);
                else onPlayTrack(track);
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      track.isLiked ? 'fill-[#D946EF] text-[#D946EF]' : ''
                    }`}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayTrack(track);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow transition-transform hover:scale-105"
                  title={t(isThisTrackPlaying ? 'Pause' : 'Play')}
                >
                  {isThisTrackPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  )}
                </button>
              </div>
            </div>
            );
          })}
        </div>
        )}
      </div>
      )}

      {/* Artists Section */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">{t('Artists')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {artists.map((artist) => {
            const artistTrack = tracks.find((track) => track.userId === artist.id);
            return (
              <div
                key={artist.id}
                data-artist-id={artist.id}
                data-context-type="artist"
                onClick={() => { if (onSelectArtist) onSelectArtist(artist); else if (artistTrack) onPlayTrack(artistTrack); }}
                className="group flex cursor-pointer flex-col items-center rounded-xl bg-[#181818] p-3 text-center shadow transition-all hover:bg-[#282828] sm:p-4"
              >
                <div className="mb-3 aspect-square w-full max-w-24 overflow-hidden rounded-full border-2 border-white/10 shadow-lg transition-colors group-hover:border-[#D946EF]">
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
                <p className="text-xs text-zinc-400 mt-1">{t('Artist')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
