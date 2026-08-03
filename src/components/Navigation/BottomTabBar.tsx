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
      className="mobile-bottom-nav fixed inset-x-2 z-40 mx-auto max-w-md transition-all duration-300"
      aria-label="Main navigation"
      data-has-player={hasMiniPlayer ? 'true' : 'false'}
    >
      <div className="relative flex items-center justify-around rounded-[24px] border border-white/[0.12] bg-zinc-950/88 p-1.5 shadow-[0_14px_44px_rgba(0,0,0,0.82)] backdrop-blur-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] transition-all duration-200 ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active glow background */}
              {isActive && (
                <div className="absolute inset-0 rounded-[17px] border border-[#D946EF]/30 bg-gradient-to-b from-[#D946EF]/20 to-[#A855F7]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] -z-10" />
              )}

              <Icon
                className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-[#D946EF] stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              <span
                className={`mt-0.5 max-w-full truncate text-[9px] font-semibold tracking-tight ${
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
