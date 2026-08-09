import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Heart,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from 'lucide-react';
import { Track } from '../../types';
import { AudioVisualizer } from '../Player/AudioVisualizer';
import { extractCoverPalette, CoverPalette } from '../../utils/coverColors';

interface SongScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  currentTimeSeconds: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onSeek: (fraction: number) => void;
  onToggleLike: (trackId: string) => void;
  onOpenEQ?: () => void;
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (track: Track) => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const SongScreenModal: React.FC<SongScreenModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  isShuffle,
  repeatMode,
  currentTimeSeconds,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onToggleRepeat,
  onSeek,
  onToggleLike,
  onOpenEQ,
  onSelectArtist,
  onSelectAlbum,
}) => {
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
  }, [currentTrack?.coverUrl]);

  if (!isOpen || !currentTrack) return null;

  const releaseName = currentTrack.releaseTitle || currentTrack.album || currentTrack.title;
  const progress = currentTrack.duration > 0
    ? Math.min(1, Math.max(0, currentTimeSeconds / currentTrack.duration))
    : 0;

  return (
    <section className="workspace-screen no-button-lift h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden bg-[#121212] text-white select-none">
      <div className="song-screen-shell mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col overflow-hidden px-3 py-2 md:max-w-[90rem] md:px-6 md:py-3 lg:px-8">
        <header className="song-screen-header workspace-header flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-2.5 md:gap-4 md:pb-3">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] shadow-[0_12px_34px_rgba(168,85,247,0.28)] md:h-12 md:w-12 md:rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.secondary})` }}
            >
              <Radio className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#D8B4FE] md:mb-1 md:gap-2 md:text-[10px] md:tracking-[0.24em]">
                <Sparkles className="h-3.5 w-3.5" /> Now playing
              </div>
              <h1 data-track-id={currentTrack.id} data-context-type="track" className="truncate text-lg font-black tracking-tight md:text-3xl">{releaseName}</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="control-press flex h-11 w-11 items-center justify-center rounded-[15px] border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white md:h-auto md:w-auto md:rounded-full md:p-2.5"
            aria-label="Minimize now playing"
            title="Minimize Now Playing"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </header>

        <div className="song-screen-grid mt-2.5 grid w-full min-h-0 min-w-0 max-w-full flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 md:my-auto md:grid-rows-none md:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] md:content-center md:items-stretch md:gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(26rem,0.92fr)] xl:gap-6">
          <div className="song-screen-art-slot flex h-full min-h-0 min-w-0 items-center justify-center [container-type:size] md:justify-end">
            <article
              data-track-id={currentTrack.id}
              data-context-type="track"
              onClick={() => onSelectAlbum?.(currentTrack)}
              className="song-screen-art workspace-card relative aspect-square w-[min(100%,58dvh)] min-h-0 min-w-0 max-h-full max-w-full cursor-pointer overflow-hidden rounded-[1.35rem] shadow-[0_28px_70px_rgba(0,0,0,0.55)] md:h-[min(100cqw,100cqh)] md:w-[min(100cqw,100cqh)] md:rounded-[1.75rem]"
            >
              <img
                key={currentTrack.coverUrl}
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="media-fade h-full w-full object-cover"
              />
            </article>
          </div>

          <article className="song-screen-controls workspace-card flex min-h-0 min-w-0 max-w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#211827] to-[#181818] p-3 shadow-2xl md:self-stretch md:rounded-3xl md:p-5">
            <div className="flex items-center justify-between gap-3 md:items-start md:gap-4">
              <div className="min-w-0">
                <p className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-[#D8B4FE] md:block">Listening session</p>
                <h2 data-track-id={currentTrack.id} data-context-type="track" className="truncate text-xl font-black tracking-tight text-white md:mt-2 md:text-4xl">{currentTrack.title}</h2>
                <button
                  data-artist-id={currentTrack.userId}
                  data-context-type="artist"
                  onClick={() => onSelectArtist?.(currentTrack.userId)}
                  className="mt-0.5 truncate text-xs font-bold text-zinc-400 transition-colors hover:text-[#E879F9] md:mt-2 md:text-sm"
                >
                  {currentTrack.artist}
                </button>
              </div>
              <button
                onClick={() => onToggleLike(currentTrack.id)}
                className={`control-press flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors md:hidden ${
                  currentTrack.isLiked
                    ? 'border-[#D946EF]/40 bg-[#D946EF]/15 text-[#E879F9]'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
                title={currentTrack.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              >
                <Heart className={`h-5 w-5 ${currentTrack.isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="mt-3 flex-shrink-0 rounded-2xl border border-white/[0.08] bg-black/20 p-3 md:hidden">
              <div className="flex items-center justify-between gap-1">
                <button
                  onClick={onToggleShuffle}
                  className={`control-press relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    isShuffle ? 'bg-[#D946EF]/15 text-[#F0ABFC]' : 'text-zinc-500 hover:bg-white/[0.07] hover:text-white'
                  }`}
                  title={isShuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
                  aria-label={isShuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
                  aria-pressed={isShuffle}
                >
                  <Shuffle className="h-4 w-4" />
                  {isShuffle && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#D946EF]" />}
                </button>
                <button
                  onClick={onPrev}
                  className="control-press flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.07] hover:text-white md:h-auto md:w-auto md:p-3"
                  title="Previous track"
                >
                  <SkipBack className="h-5 w-5 fill-current" />
                </button>
                <button
                  onClick={onTogglePlay}
                  className="now-playing-gradient-button control-press flex h-14 w-14 items-center justify-center rounded-full text-black shadow-[0_14px_34px_rgba(0,0,0,0.35)] hover:brightness-110 md:h-16 md:w-16"
                  style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.secondary})` }}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6 fill-current md:h-7 md:w-7" />
                  ) : (
                    <Play className="ml-1 h-6 w-6 fill-current md:h-7 md:w-7" />
                  )}
                </button>
                <button
                  onClick={onNext}
                  className="control-press flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.07] hover:text-white md:h-auto md:w-auto md:p-3"
                  title="Next track"
                >
                  <SkipForward className="h-5 w-5 fill-current" />
                </button>
                <button
                  onClick={onToggleRepeat}
                  className={`control-press relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    repeatMode !== 'off' ? 'bg-[#D946EF]/15 text-[#F0ABFC]' : 'text-zinc-500 hover:bg-white/[0.07] hover:text-white'
                  }`}
                  title={repeatMode === 'off' ? 'Turn repeat on' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                  aria-label={repeatMode === 'off' ? 'Repeat off. Turn repeat on' : repeatMode === 'all' ? 'Repeat all. Switch to repeat one' : 'Repeat one. Turn repeat off'}
                >
                  {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                  {repeatMode !== 'off' && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#D946EF]" />}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-zinc-500 md:gap-3">
                <span className="w-9 text-right">{formatTime(currentTimeSeconds)}</span>
                <div className="group relative flex flex-1 items-center py-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-100"
                      style={{
                        width: `${progress * 100}%`,
                        background: `linear-gradient(90deg, ${palette.accent}, ${palette.secondary})`,
                      }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                    style={{ left: `${progress * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={progress}
                    onChange={(event) => onSeek(Number(event.target.value))}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Track progress"
                  />
                </div>
                <span className="w-9">{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            <div className="mt-3 hidden flex-none flex-col rounded-3xl border border-white/[0.08] bg-[#101010]/60 p-4 md:flex md:min-h-0 md:flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                    <Waves className="h-4 w-4 text-[#D946EF]" /> Live spectrum
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Audio activity for the current track</p>
                </div>
                {onOpenEQ && (
                  <button
                    onClick={onOpenEQ}
                    className="control-press flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:bg-white/10 hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Equalizer
                  </button>
                )}
              </div>
              <div className="mt-3 flex h-[clamp(190px,24dvh,240px)] flex-none items-end justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30 px-4 md:h-auto md:min-h-[10rem] md:flex-1">
                <AudioVisualizer
                  isPlaying={isPlaying}
                  accentColor={palette.accent}
                  secondaryColor={palette.secondary}
                  height={190}
                  fillContainer
                  maxHeightRatio={0.82}
                />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
