import React from 'react';
import { Play, Pause, SkipForward, Heart } from 'lucide-react';
import { Track } from '../../types';
import { AudioVisualizer } from './AudioVisualizer';

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenSongScreen?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  progress,
  onTogglePlay,
  onNext,
  onToggleLike,
  onOpenSongScreen,
}) => {
  if (!currentTrack) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md transition-all duration-300">
      <div
        onClick={onOpenSongScreen}
        className="group relative overflow-hidden backdrop-blur-2xl bg-zinc-900/85 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.7)] rounded-2xl p-2.5 flex items-center justify-between hover:bg-zinc-900/95 transition-all active:scale-[0.99] cursor-pointer"
      >
        {/* Progress bar top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>

        {/* Ambient Halo behind album art */}
        <div
          className="absolute -left-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: currentTrack.accentColor }}
        />

        {/* Track Artwork & Metadata */}
        <div className="flex items-center space-x-3 z-10 min-w-0 flex-1 pr-2">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/15">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <AudioVisualizer isPlaying={isPlaying} variant="minimal" height={16} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              <h4 className="text-sm font-semibold text-white truncate tracking-tight">
                {currentTrack.title}
              </h4>
            </div>
            <p className="text-xs text-zinc-400 truncate tracking-tight">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Player Controls */}
        <div className="flex items-center space-x-2 z-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleLike(currentTrack.id)}
            className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors"
            title="Like track"
          >
            <Heart
              className={`w-4 h-4 ${
                currentTrack.isLiked ? 'fill-rose-500 text-rose-500' : 'stroke-[1.8]'
              }`}
            />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 text-zinc-300 hover:text-white transition-colors"
            title="Next Track"
          >
            <SkipForward className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
