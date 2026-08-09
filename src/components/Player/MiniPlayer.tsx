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
    <div className="mobile-mini-player fixed inset-x-2 z-30 mx-auto max-w-md transition-all duration-300">
      <div
        data-track-id={currentTrack.id}
        data-context-type="track"
        onClick={onOpenSongScreen}
        className="group relative flex min-h-[64px] items-center justify-between overflow-hidden rounded-[20px] border border-white/[0.12] bg-zinc-900/90 p-2 shadow-[0_16px_36px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-all hover:bg-zinc-900/95 active:scale-[0.99] cursor-pointer"
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
          style={{ backgroundColor: currentTrack.accentColor || '#A855F7' }}
        />

        {/* Track Artwork & Metadata */}
        <div className="z-10 flex min-w-0 flex-1 items-center space-x-2.5 pr-1.5">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-[14px] border border-white/15 shadow-md">
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
        <div className="z-10 flex flex-shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleLike(currentTrack.id)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-rose-400"
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all hover:scale-105 active:scale-95"
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            title="Next Track"
          >
            <SkipForward className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
