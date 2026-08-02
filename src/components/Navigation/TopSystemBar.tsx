import React, { useState, useEffect } from 'react';
import { Wifi, BatteryCharging, Radio, Code, Sparkles, SlidersHorizontal } from 'lucide-react';

interface TopSystemBarProps {
  onOpenDevSpecs: () => void;
  onOpenEQ: () => void;
  activeDeviceName?: string;
}

export const TopSystemBar: React.FC<TopSystemBarProps> = ({
  onOpenDevSpecs,
  onOpenEQ,
  activeDeviceName = 'VERTEX Spatial AirPlay',
}) => {
  const [time, setTime] = useState<string>('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full px-4 pt-3 pb-2 backdrop-blur-2xl bg-black/40 border-b border-white/[0.06] flex items-center justify-between text-xs text-zinc-300 select-none">
      {/* Time & iOS Status */}
      <div className="flex items-center space-x-2 font-medium tracking-tight">
        <span className="text-sm font-semibold text-white tracking-wide">{time}</span>
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#D946EF]/20 text-[#D946EF] border border-[#D946EF]/30">
          5G Ultra
        </span>
      </div>

      {/* Center iOS 27 AirPlay Pill */}
      <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors cursor-pointer">
        <Radio className="w-3.5 h-3.5 text-[#D946EF] animate-pulse" />
        <span className="text-[11px] font-medium tracking-wide text-zinc-200">{activeDeviceName}</span>
      </div>

      {/* Right Actions & Dev Spec Inspector */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenEQ}
          title="Audio EQ Presets"
          className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenDevSpecs}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 hover:text-white transition-all active:scale-95 text-[11px] font-medium"
          title="Inspect iOS 27 Design System Tokens & Developer Specs"
        >
          <Code className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Dev Specs</span>
        </button>

        <div className="flex items-center space-x-1 text-zinc-400 pl-1">
          <Wifi className="w-3.5 h-3.5" />
          <BatteryCharging className="w-4 h-4 text-[#D946EF]" />
        </div>
      </div>
    </header>
  );
};
