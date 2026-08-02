import React from 'react';
import { X, Radio, Laptop, Headphones, Speaker, Check, Volume2 } from 'lucide-react';

interface DeviceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  onSelectDevice: (deviceName: string) => void;
}

export const DeviceSelectorModal: React.FC<DeviceSelectorModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onSelectDevice,
}) => {
  if (!isOpen) return null;

  const devices = [
    {
      id: 'browser',
      name: 'Web Player (This Browser)',
      type: 'Computer',
      icon: Laptop,
      description: 'High-Fidelity Web Audio Engine',
    },
    {
      id: 'headphones',
      name: 'Wireless Studio Headphones',
      type: 'Headphones',
      icon: Headphones,
      description: 'Spatial Lossless Audio',
    },
    {
      id: 'studio',
      name: 'Living Room Studio Speakers',
      type: 'Speaker System',
      icon: Speaker,
      description: 'Wireless Bluetooth / Wi-Fi Output',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 flex items-center justify-center text-[#C084FC]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">Connect to a Device</h3>
            <p className="text-xs text-zinc-400">Select where you want your audio to play</p>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          {devices.map((device) => {
            const Icon = device.icon;
            const isSelected = activeDevice === device.name;

            return (
              <div
                key={device.id}
                onClick={() => {
                  onSelectDevice(device.name);
                  onClose();
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#A855F7]/15 border-[#A855F7]/40 text-white shadow-md'
                    : 'bg-[#242424]/60 border-white/5 hover:bg-[#282828] text-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white' : 'bg-white/10 text-zinc-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold truncate flex items-center gap-1.5">
                      <span>{device.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#A855F7]/20 text-[#C084FC] border border-[#A855F7]/30">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">{device.description}</p>
                  </div>
                </div>

                {isSelected && <Check className="w-5 h-5 text-[#D946EF] flex-shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center space-x-1.5">
            <Volume2 className="w-4 h-4 text-[#D946EF]" />
            <span>Lossless 24-bit / 96kHz</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
