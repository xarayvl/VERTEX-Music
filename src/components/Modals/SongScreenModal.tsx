import React, { useEffect, useState } from 'react';
import {
  Heart,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Disc,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Radio,
} from 'lucide-react';
import { Track } from '../../types';
import { AudioVisualizer } from '../Player/AudioVisualizer';
import { extractCoverPalette, CoverPalette } from '../../utils/coverColors';

interface SongScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  progress?: number;
  currentTimeSeconds?: number;
  volume?: number;
  isShuffle?: boolean;
  repeatMode?: 'off' | 'all' | 'one';
  onTogglePlay?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (fraction: number) => void;
  onVolumeChange?: (vol: number) => void;
  onToggleLike: (trackId: string) => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onSelectArtist?: (artistName: string) => void;
  onOpenEQ?: () => void;
  userProfile?: any;
}

const formatTime = (secs: number) => {
  if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const SongScreenModal: React.FC<SongScreenModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  progress = 0,
  currentTimeSeconds = 0,
  volume = 0.7,
  isShuffle = false,
  repeatMode = 'off',
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleLike,
  onToggleShuffle,
  onToggleRepeat,
  onSelectArtist,
  onOpenEQ,
}) => {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'lyrics'>('visualizer');

  // Live palette pulled from the actual cover art pixels, so the background
  // atmosphere and EQ bars always match this specific track's artwork —
  // rather than the accentColor/secondaryColor track fields, which are
  // never populated by the upload flow and so are always undefined for
  // real user-uploaded music.
  const [palette, setPalette] = useState<CoverPalette>({
    accent: currentTrack?.accentColor || '#A855F7',
    secondary: currentTrack?.secondaryColor || '#D946EF',
    ambient: '#2a1a3d',
  });

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    extractCoverPalette(currentTrack.coverUrl).then((result) => {
      if (!cancelled) setPalette(result);
    });
    return () => {
      cancelled = true;
    };
    // Re-run whenever the track (and therefore its cover) changes.
  }, [currentTrack?.coverUrl]);

  if (!isOpen || !currentTrack) return null;

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col justify-between bg-[#0b0b12] text-white p-6 sm:p-8 rounded-2xl border border-white/10 select-none overflow-y-auto relative shadow-2xl animate-in fade-in duration-200">
      {/* Dynamic Background Atmosphere — fills the entire screen and
          crossfades to the new cover's palette whenever the track changes */}
      <div
        key={currentTrack.coverUrl}
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none animate-in fade-in duration-1000"
      >
        <div
          className="absolute inset-0 opacity-40 blur-3xl scale-125 transition-[background] duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${palette.accent} 0%, ${palette.secondary} 45%, ${palette.ambient} 75%, #000000 100%)`,
          }}
        />
        {/* Base wash so the gradient still fully covers the corners at wide/short viewport ratios */}
        <div
          className="absolute inset-0 opacity-90 transition-[background] duration-1000"
          style={{ background: `linear-gradient(180deg, ${palette.ambient}55 0%, #0b0b12 85%)` }}
        />
      </div>

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-20">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all hover:scale-105 active:scale-95"
          title="Minimize View"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
            <Radio className="w-3 h-3 text-[#D946EF]" />
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-200">
              Playing from {currentTrack.releaseType || 'Single'} · {currentTrack.album || currentTrack.title}
            </p>
          </div>
          <p className="text-[10px] font-bold text-[#C084FC] tracking-wide">VERTEX Hi-Res Lossless Audio</p>
        </div>

        {onOpenEQ ? (
          <button
            onClick={onOpenEQ}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all hover:scale-105 active:scale-95"
            title="Audio Equalizer"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Main Screen Content Grid */}
      <div className="w-full max-w-4xl mx-auto my-auto py-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center z-20">
        {/* Left: Album Artwork with Rotating Vinyl animation */}
        <div className="flex justify-center items-center">
          <div className="relative group w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
            {/* Soft Glow */}
            <div
              className="absolute -inset-4 rounded-3xl opacity-50 blur-2xl transition-all duration-700 group-hover:opacity-80"
              style={{
                background: `linear-gradient(135deg, ${palette.accent}, ${palette.secondary})`,
              }}
            />

            {/* Album Cover Card */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 bg-zinc-900">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />

              {/* Vinyl Spin Badge indicator */}
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1.5">
                <Disc className={`w-3.5 h-3.5 text-[#D946EF] ${isPlaying ? 'animate-spin' : ''}`} />
                <span>{isPlaying ? 'Playing' : 'Paused'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Track Information & Tab View (Lyrics / Audio Waveform) */}
        <div className="flex flex-col justify-center space-y-6 min-w-0">
          {/* Header Track Details */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white break-words line-clamp-2 leading-tight">
                  {currentTrack.title}
                </h1>
                <button
                  onClick={() => onSelectArtist && onSelectArtist(currentTrack.artist)}
                  className="mt-2 text-sm sm:text-base font-bold text-[#C084FC] hover:text-white transition-colors hover:underline text-left truncate block max-w-full"
                >
                  {currentTrack.artist}
                </button>
              </div>

              <button
                onClick={() => onToggleLike(currentTrack.id)}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors shrink-0 mt-1"
                title="Like Track"
              >
                <Heart
                  className={`w-6 h-6 sm:w-7 sm:h-7 ${
                    currentTrack.isLiked
                      ? 'fill-[#D946EF] text-[#D946EF]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Visualizer vs Lyrics Drawer */}
          <div className="bg-[#18181b]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-2xl min-h-[220px] flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#D946EF]" /> Live Spectrum & Lyrics
              </span>
              <div className="flex space-x-1.5 shrink-0">
                <button
                  onClick={() => setActiveTab('visualizer')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    activeTab === 'visualizer'
                      ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow'
                      : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}
                >
                  Audio EQ
                </button>
                <button
                  onClick={() => setActiveTab('lyrics')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    activeTab === 'lyrics'
                      ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow'
                      : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}
                >
                  Synced Lyrics
                </button>
              </div>
            </div>

            <div className="py-4">
              {activeTab === 'visualizer' ? (
                <div className="h-32 flex items-center justify-center">
                  <AudioVisualizer isPlaying={isPlaying} accentColor={palette.accent} secondaryColor={palette.secondary} />
                </div>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-2.5 pr-2 scrollbar-thin">
                  {currentTrack.syncedLyrics && currentTrack.syncedLyrics.length > 0 ? (
                    currentTrack.syncedLyrics.map((line, idx) => (
                      <p
                        key={idx}
                        className={`text-xs sm:text-sm font-semibold ${
                          idx === 1 ? 'text-[#D946EF] font-extrabold' : 'text-zinc-400'
                        }`}
                      >
                        {line.text}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No synced lyrics available for this track.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Transport Bar: Progress + Playback Controls + Volume */}
      <div className="w-full max-w-4xl mx-auto z-20 space-y-3 pt-2">
        {/* Progress / Seek */}
        <div className="flex items-center space-x-2.5 w-full text-[11px] font-mono text-zinc-400">
          <span className="w-9 text-right select-none">{formatTime(currentTimeSeconds)}</span>
          <div className="relative flex-1 flex items-center group cursor-pointer py-2">
            <div className="w-full h-1 group-hover:h-1.5 bg-white/10 rounded-full overflow-hidden relative transition-all">
              <div
                className="h-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
            <div
              className="absolute w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2"
              style={{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(e) => onSeek && onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Track progress scrubber"
            />
          </div>
          <span className="w-9 select-none">{formatTime(currentTrack.duration)}</span>
        </div>

        {/* Playback + Volume Row */}
        <div className="flex items-center justify-between gap-4 pb-2">
          <div className="w-24 hidden sm:block" />

          <div className="flex items-center justify-center space-x-6 flex-1">
            <button
              onClick={onToggleShuffle}
              className={`p-1.5 rounded-full transition-colors relative ${
                isShuffle ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4.5 h-4.5" />
              {isShuffle && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D946EF]" />
              )}
            </button>

            <button
              onClick={onPrev}
              className="text-zinc-300 hover:text-white transition-colors active:scale-90"
              title="Previous Track"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_20px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-black text-black" />
              ) : (
                <Play className="w-6 h-6 fill-black text-black ml-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="text-zinc-300 hover:text-white transition-colors active:scale-90"
              title="Next Track"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`p-1.5 rounded-full transition-colors relative ${
                repeatMode !== 'off' ? 'text-[#D946EF]' : 'text-zinc-400 hover:text-white'
              }`}
              title="Repeat"
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4.5 h-4.5" /> : <Repeat className="w-4.5 h-4.5" />}
              {repeatMode !== 'off' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D946EF]" />
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="w-24 hidden sm:flex items-center space-x-1.5 text-zinc-400">
            <button
              onClick={() => onVolumeChange && onVolumeChange(volume > 0 ? 0 : 0.7)}
              className="hover:text-white transition-colors"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="relative flex-1 flex items-center group cursor-pointer py-2">
              <div className="w-full h-1 group-hover:h-1.5 bg-white/10 rounded-full overflow-hidden relative transition-all">
                <div
                  className="h-full bg-[#A855F7] group-hover:bg-[#D946EF] rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, volume * 100))}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Volume control"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
