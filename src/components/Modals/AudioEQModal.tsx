import React from 'react';
import { Check, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { AudioEQ } from '../../types';

interface AudioEQModalProps {
  isOpen: boolean;
  onClose: () => void;
  eq: AudioEQ;
  onUpdateEQ: (eq: AudioEQ) => void;
}

const bands: Array<{ label: string; frequency: string; key: 'bass' | 'mid' | 'treble' }> = [
  { label: 'Bass', frequency: '60 Hz', key: 'bass' },
  { label: 'Mid', frequency: '1 kHz', key: 'mid' },
  { label: 'Treble', frequency: '12 kHz', key: 'treble' },
];

export const AudioEQModal: React.FC<AudioEQModalProps> = ({
  isOpen,
  onClose,
  eq,
  onUpdateEQ,
}) => {
  if (!isOpen) return null;

  const presets: AudioEQ['preset'][] = [
    'None',
    'Acoustic',
    'Bass',
    'Electronic',
    'Pop',
    'Vocal',
    'Flat',
  ];

  const handleSelectPreset = (preset: AudioEQ['preset']) => {
    let bass = 0;
    let mid = 0;
    let treble = 0;

    if (preset === 'Bass') {
      bass = 6;
      mid = 2;
      treble = 1;
    } else if (preset === 'Electronic') {
      bass = 5;
      mid = -1;
      treble = 4;
    } else if (preset === 'Pop') {
      bass = -1;
      mid = 4;
      treble = 3;
    } else if (preset === 'Vocal') {
      bass = -3;
      mid = 6;
      treble = 2;
    } else if (preset === 'Acoustic') {
      bass = 2;
      mid = 3;
      treble = 4;
    }

    onUpdateEQ({ bass, mid, treble, preset });
  };

  const updateBand = (key: 'bass' | 'mid' | 'treble', value: number) => {
    onUpdateEQ({ ...eq, [key]: value, preset: 'None' });
  };

  return (
    <section className="workspace-screen min-h-full w-full bg-[#121212] text-white select-none">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <header className="workspace-header flex items-start justify-between gap-5 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)]">
              <SlidersHorizontal className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">
                <Sparkles className="h-3.5 w-3.5" /> Audio engine
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Equalizer</h1>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">Tune your sound without leaving the main player.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="control-press rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="Close equalizer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Presets</p>
                <p className="mt-1 text-sm text-zinc-500">Fast profiles for different listening styles.</p>
              </div>
              <button
                onClick={() => handleSelectPreset('Flat')}
                className="control-press flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {presets.map((preset, index) => {
                const isActive = eq.preset === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => handleSelectPreset(preset)}
                    style={{ '--stagger-index': index } as React.CSSProperties}
                    className={`stagger-item control-press flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-xs font-extrabold transition-all ${
                      isActive
                        ? 'border-[#C084FC]/70 bg-gradient-to-r from-[#A855F7]/30 to-[#D946EF]/20 text-white shadow-[0_10px_30px_rgba(168,85,247,0.16)]'
                        : 'border-white/[0.08] bg-white/[0.035] text-zinc-300 hover:border-white/[0.15] hover:bg-white/[0.07]'
                    }`}
                  >
                    <span>{preset}</span>
                    {isActive && <Check className="h-4 w-4 text-[#E879F9]" />}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f1728] to-[#181818] p-5 sm:p-7">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Custom curve</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">Frequency controls</h2>
              </div>
              <span className="rounded-full border border-[#D946EF]/25 bg-[#D946EF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F0ABFC]">
                Live processing
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {bands.map((band, index) => {
                const value = eq[band.key];
                const percentage = Math.min(100, Math.max(0, ((value + 10) / 20) * 100));
                return (
                  <div
                    key={band.key}
                    style={{ '--stagger-index': index } as React.CSSProperties}
                    className="stagger-item rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-black text-white">{band.label}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{band.frequency}</p>
                      </div>
                      <span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-xs font-bold text-[#E879F9]">
                        {value > 0 ? '+' : ''}{value} dB
                      </span>
                    </div>

                    <div className="relative flex h-52 items-end justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101010] px-7 py-5">
                      <div className="absolute inset-x-4 top-1/2 h-px bg-white/10" />
                      <div className="absolute inset-0 opacity-20 eq-grid" />
                      <div className="relative h-full w-10 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10">
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-[#A855F7] to-[#F0ABFC] transition-[height] duration-200 ease-out"
                          style={{ height: `${percentage}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="10"
                        value={value}
                        onChange={(event) => updateBand(band.key, Number(event.target.value))}
                        className="absolute inset-0 h-full w-full cursor-ns-resize opacity-0"
                        aria-label={`${band.label} level`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="control-press mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] py-3.5 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110"
            >
              <Check className="h-4 w-4" /> Apply settings
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
