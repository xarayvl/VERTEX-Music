import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  VolumeX,
  Volume1,
  Laptop2,
  SlidersHorizontal,
  PanelRight,
} from 'lucide-react';
import { Track } from '../../types';

interface SpotifyPlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  currentTimeSeconds: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (fraction: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleLike: (trackId: string) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onOpenEQ: () => void;
  onOpenDeviceSelector: () => void;
  onOpenSongScreen?: () => void;
  onSelectArtist?: (artist: string) => void;
  activeDeviceName?: string;
  onToggleRightSidebar?: () => void;
  isRightSidebarOpen?: boolean;
}

export const SpotifyPlayerBar: React.FC<SpotifyPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  progress,
  currentTimeSeconds,
  volume,
  isShuffle,
  repeatMode,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleLike,
  onToggleShuffle,
  onToggleRepeat,
  onOpenEQ,
  onOpenDeviceSelector,
  onOpenSongScreen,
  onSelectArtist,
  activeDeviceName = 'Web Player',
  onToggleRightSidebar,
  isRightSidebarOpen = false,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(volume);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(prevVol || 0.7);
    } else {
      setPrevVol(volume);
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  return (
    <footer
      data-context-type="player"
      data-track-id={currentTrack?.id || undefined}
      className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-white/10 z-50 px-4 hidden md:flex items-center justify-between select-none"
    >
      {/* Left: Track Information (Clickable to open Spotify-like Song Screen) */}
      <div className="flex items-center space-x-3.5 w-1/4 min-w-[200px]">
        <div
          onClick={onOpenSongScreen}
          className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 shadow-lg bg-zinc-800 cursor-pointer group"
          title="Click to expand Song Screen"
        >
          {currentTrack ? (
            <>
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                Expand
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-xs">
              No Track
            </div>
          )}
        </div>

        <div
          onClick={onOpenSongScreen}
          className="min-w-0 flex-1 cursor-pointer flex flex-col justify-center"
          title="Click to expand Song Screen"
        >
          <h4 className="text-sm font-bold text-white truncate tracking-tight hover:text-[#C084FC] transition-colors leading-tight">
            {currentTrack?.title || 'No Track Playing'}
          </h4>
          <p
            data-artist-id={currentTrack?.userId || undefined}
            data-context-type="artist"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectArtist && currentTrack) {
                onSelectArtist(currentTrack.userId || '');
              }
            }}
            className="text-xs text-zinc-400 truncate hover:text-[#C084FC] hover:underline transition-colors leading-tight mt-0.5 cursor-pointer"
          >
            {currentTrack?.artist || 'Select or add a song'}
          </p>
        </div>

        {currentTrack && (
          <button
            onClick={() => onToggleLike(currentTrack.id)}
            className="p-2 text-zinc-400 hover:text-white transition-colors flex-shrink-0 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 ml-1"
            title={currentTrack.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart
              className={`w-5 h-5 transition-all ${
                currentTrack.isLiked
                  ? 'fill-[#D946EF] text-[#D946EF] scale-105'
                  : 'stroke-[2] text-zinc-400 hover:text-white'
              }`}
            />
          </button>
        )}
      </div>

      {/* Center: Playback Controls & Progress Scrubber */}
      <div className="flex flex-col items-center justify-center w-2/4 max-w-2xl px-4">
        {/* Playback Buttons */}
        <div className="flex items-center space-x-5 mb-1.5">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-full transition-colors relative group ${
              isShuffle ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
            {isShuffle && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D946EF]" />
            )}
          </button>

          {/* Previous Track */}
          <button
            onClick={onPrev}
            className="text-zinc-400 hover:text-white transition-colors active:scale-90"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play/Pause Main Button */}
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={onNext}
            className="text-zinc-400 hover:text-white transition-colors active:scale-90"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            className={`p-1.5 rounded-full transition-colors relative group ${
              repeatMode !== 'off' ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'
            }`}
            title="Repeat"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
            {repeatMode !== 'off' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D946EF]" />
            )}
          </button>
        </div>

        {/* Progress Bar Timeline */}
        <div className="flex items-center space-x-2.5 w-full text-[11px] font-mono text-zinc-400">
          <span className="w-8 text-right select-none">{formatTime(currentTimeSeconds)}</span>

          <div className="relative flex-1 flex items-center group cursor-pointer py-2">
            {/* Background Track */}
            <div className="w-full h-1 group-hover:h-1.5 bg-[#4d4d4d] rounded-full overflow-hidden relative transition-all">
              {/* Active Progress Track Fill (Aktif İz) */}
              <div
                className="h-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] group-hover:from-[#C084FC] group-hover:to-[#E879F9] rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, (progress || 0) * 100))}%` }}
              />
            </div>

            {/* Thumb Knob Indicator on Hover */}
            <div
              className="absolute w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2"
              style={{ left: `${Math.min(100, Math.max(0, (progress || 0) * 100))}%` }}
            />

            {/* Transparent Range Input for native drag & seek interaction */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress || 0}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Track progress scrubber"
            />
          </div>

          <span className="w-8 select-none">{formatTime(currentTrack?.duration || 0)}</span>
        </div>
      </div>

      {/* Right: Auxiliary Controls & Volume Slider */}
      <div className="flex items-center justify-end space-x-3 w-1/4 min-w-[180px] text-zinc-400">
        {/* Equalizer Trigger */}
        <button
          onClick={onOpenEQ}
          className="p-1.5 rounded-full hover:text-white transition-colors"
          title="Audio Equalizer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Device indicator icon */}
        <button
          onClick={onOpenDeviceSelector}
          className="p-1.5 rounded-full hover:text-white transition-colors text-[#D946EF]"
          title={`Active Device: ${activeDeviceName}`}
        >
          <Laptop2 className="w-4 h-4" />
        </button>

        {/* Now Playing View Sidebar Toggle */}
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className={`p-1.5 rounded-full transition-colors ${isRightSidebarOpen ? 'text-[#D946EF] bg-white/5' : 'hover:text-white'}`}
            title="Now Playing View"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        {/* Volume Slider Bar */}
        <div className="flex items-center space-x-1.5 w-24">
          <button onClick={handleMuteToggle} className="hover:text-white transition-colors">
            {volume === 0 || isMuted ? (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <div className="relative flex-1 flex items-center group cursor-pointer py-2">
            <div className="w-full h-1 group-hover:h-1.5 bg-[#4d4d4d] rounded-full overflow-hidden relative transition-all">
              <div
                className="h-full bg-[#A855F7] group-hover:bg-[#D946EF] rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, (isMuted ? 0 : volume) * 100))}%` }}
              />
            </div>
            <div
              className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2"
              style={{ left: `${Math.min(100, Math.max(0, (isMuted ? 0 : volume) * 100))}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                onVolumeChange(parseFloat(e.target.value));
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Volume control"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
