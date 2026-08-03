import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  ChevronDown,
  Disc,
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
  onOpenEQ?: () => void;
}

export const SongScreenModal: React.FC<SongScreenModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  onOpenEQ,
}) => {
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
          className="absolute inset-0 opacity-35 scale-110 transition-[background] duration-1000"
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
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#171717] px-3 py-1">
            <Radio className="w-3 h-3 text-[#D946EF]" />
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-200">
              Playing from {currentTrack.releaseType || 'Single'} · {currentTrack.album || currentTrack.title}
            </p>
          </div>
          <p className="text-[10px] font-bold text-[#C084FC] tracking-wide">VERTEX Web Player</p>
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
              className="absolute -inset-3 rounded-3xl opacity-30 transition-all duration-700 group-hover:opacity-55"
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
              <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-3 py-1 text-[10px] font-bold text-white">
                <Disc className={`w-3.5 h-3.5 text-[#D946EF] ${isPlaying ? 'animate-spin' : ''}`} />
                <span>{isPlaying ? 'Playing' : 'Paused'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: clean EQ visualizer — playback progress stays in the persistent player bar. */}
        <div className="workspace-card section-reveal flex min-h-[320px] flex-col justify-between rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl sm:p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">Live audio EQ</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Spectrum</h2>
            <p className="mt-1 text-xs text-zinc-400">The main player below already handles seeking and playback controls.</p>
          </div>
          <div className="mt-8 flex h-48 items-end justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black/[0.25] px-4 pb-4">
            <AudioVisualizer
              isPlaying={isPlaying}
              accentColor={palette.accent}
              secondaryColor={palette.secondary}
              height={176}
            />
          </div>
        </div>
      </div>

    </div>
  );
};
