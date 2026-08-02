import React from 'react';
import { Home, Compass, Search, Library, Bot } from 'lucide-react';
import { TabType } from '../../types';

interface BottomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasMiniPlayer?: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  hasMiniPlayer = true,
}) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'browse' as TabType, label: 'Browse', icon: Compass },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'library' as TabType, label: 'Library', icon: Library },
    { id: 'chat' as TabType, label: 'AI DJ', icon: Bot },
  ];

  return (
    <nav
      className={`fixed left-1/2 -translate-x-1/2 z-40 transition-all duration-300 w-[92%] max-w-md ${
        hasMiniPlayer ? 'bottom-3' : 'bottom-4'
      }`}
    >
      <div className="backdrop-blur-2xl bg-zinc-950/80 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-full px-4 py-2 flex items-center justify-around relative">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all duration-200 group ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {/* Active glow background */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#A855F7]/20 via-[#D946EF]/20 to-[#A855F7]/20 rounded-full border border-[#D946EF]/30 animate-pulse -z-10" />
              )}

              <Icon
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-[#D946EF] stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              <span
                className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                  isActive ? 'text-[#C084FC] font-semibold' : 'text-zinc-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
