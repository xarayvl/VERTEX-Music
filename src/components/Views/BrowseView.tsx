import React, { useState } from 'react';
import { Disc, Play, Heart, Wand2 } from 'lucide-react';
import { Track, Playlist, Artist } from '../../types';
import { BROWSE_CATEGORIES } from '../../data/mockData';

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
  tracks,
  playlists,
  artists,
  onPlayTrack,
  onSelectPlaylist,
  onSelectAlbum,
  onToggleLike,
  onSelectArtist,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [moodPrompt, setMoodPrompt] = useState<string>('');
  const [aiGeneratedStation, setAiGeneratedStation] = useState<string | null>(null);
  const [matchingTrack, setMatchingTrack] = useState<Track | null>(null);

  const filteredTracks = selectedCategory
    ? tracks.filter((t) =>
        t.genre.toLowerCase().includes(selectedCategory.toLowerCase().split(' ')[0])
      )
    : tracks;

  const handleGenerateAiStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moodPrompt.trim()) return;

    // Find closest track match or default to first track
    const promptLower = moodPrompt.toLowerCase();
    const match =
      tracks.find(
        (t) =>
          t.title.toLowerCase().includes(promptLower) ||
          t.artist.toLowerCase().includes(promptLower) ||
          t.genre.toLowerCase().includes(promptLower) ||
          t.album.toLowerCase().includes(promptLower)
      ) || tracks[Math.floor(Math.random() * tracks.length)];

    setMatchingTrack(match);
    setAiGeneratedStation(
      `AI Station Generated: "${moodPrompt}" (${Math.floor(Math.random() * 8) + 12} tracks queued)`
    );
  };

  return (
    <div className="space-y-8 pb-12 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Explore & Browse</h1>
        <p className="text-xs text-zinc-400 mt-1">Discover new music by genre, mood, or AI station</p>
      </div>

      {/* AI Smart Station Generator */}
      <div className="bg-[#181818] rounded-2xl p-5 border border-white/[0.06] shadow-xl">
        <div className="flex items-center space-x-2 mb-2">
          <Wand2 className="w-5 h-5 text-[#D946EF]" />
          <h3 className="text-base font-extrabold text-white tracking-tight">
            AI Radio Station Synthesizer
          </h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Type any atmosphere or aesthetic to instantly generate an AI stream.
        </p>

        <form onSubmit={handleGenerateAiStation} className="flex gap-2">
          <input
            type="text"
            value={moodPrompt}
            onChange={(e) => setMoodPrompt(e.target.value)}
            placeholder="e.g. Rainy cafe in Paris, Cyberpunk neon drive..."
            className="flex-1 bg-[#242424] border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Synthesize
          </button>
        </form>

        {aiGeneratedStation && (
          <div className="mt-4 p-3 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/30 flex items-center justify-between text-xs text-[#C084FC]">
            <span className="font-semibold">{aiGeneratedStation}</span>
            <button
              onClick={() => matchingTrack && onPlayTrack(matchingTrack)}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-extrabold hover:scale-105 active:scale-95 transition-all shadow flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Play Station</span>
            </button>
          </div>
        )}
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

      {/* Filtered Track Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {selectedCategory ? `${selectedCategory} Recommendations` : 'Featured Editor Picks'}
          </h2>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-bold text-[#D946EF] hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>

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
      </div>

      {/* Artists Section */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight mb-4">Trending Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {artists.map((artist) => {
            const artistTrack = tracks.find((t) => t.artist === artist.name) || tracks[0];
            return (
              <div
                key={artist.id}
                data-artist-id={artist.id}
                data-artist-name={artist.name}
                data-context-type="artist"
                onClick={() => (onSelectArtist ? onSelectArtist(artist) : onPlayTrack(artistTrack))}
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
