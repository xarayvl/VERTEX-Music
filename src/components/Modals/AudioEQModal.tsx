import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { AudioEQ } from '../../types';

interface AudioEQModalProps {
  isOpen: boolean;
  onClose: () => void;
  eq: AudioEQ;
  onUpdateEQ: (eq: AudioEQ) => void;
}

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
    'Bass Booster',
    'Electronic',
    'Pop',
    'Vocal',
    'Flat',
  ];

  const handleSelectPreset = (preset: AudioEQ['preset']) => {
    let bass = 0,
      mid = 0,
      treble = 0;
    if (preset === 'Bass Booster') {
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
    } else if (preset === 'None' || preset === 'Flat') {
      bass = 0;
      mid = 0;
      treble = 0;
    }
    onUpdateEQ({ bass, mid, treble, preset });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 flex items-center justify-center text-[#C084FC]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Audio Equalizer
              </h2>
              <p className="text-[11px] text-zinc-400">Custom acoustic frequency tuner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Selector */}
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
          Sound Presets
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
          {presets.map((p) => {
            const isActive = eq.preset === p;
            return (
              <button
                key={p}
                onClick={() => handleSelectPreset(p)}
                className={`py-2 px-3 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow-md'
                    : 'bg-[#282828] text-zinc-300 border border-white/5 hover:bg-[#323232] hover:text-white'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Frequency Band Sliders */}
        <div className="space-y-4 mb-6 bg-[#242424] p-4 rounded-xl border border-white/5">
          {[
            { label: 'Bass (60Hz)', val: eq.bass, key: 'bass' },
            { label: 'Mid (1kHz)', val: eq.mid, key: 'mid' },
            { label: 'Treble (12kHz)', val: eq.treble, key: 'treble' },
          ].map((band) => (
            <div key={band.key} className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                <span>{band.label}</span>
                <span className="font-mono text-[#D946EF] font-bold">
                  {band.val > 0 ? `+${band.val}` : band.val} dB
                </span>
              </div>
              <div className="relative flex-1 flex items-center group cursor-pointer py-1.5">
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden relative transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((band.val + 10) / 20) * 100))}%`,
                    }}
                  />
                </div>
                <div
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md pointer-events-none -translate-x-1/2 transition-opacity"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((band.val + 10) / 20) * 100))}%`,
                  }}
                />
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={band.val}
                  onChange={(e) =>
                    onUpdateEQ({
                      ...eq,
                      [band.key]: parseInt(e.target.value, 10),
                    })
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-xs tracking-wider uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          Apply Settings
        </button>
      </div>
    </div>
  );
};
