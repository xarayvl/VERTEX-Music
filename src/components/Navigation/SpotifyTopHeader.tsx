import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Crown, User, ExternalLink, LogOut, Check, ChevronDown, Sparkles, Upload } from 'lucide-react';
import { TabType, UserProfile } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';
import VertexLogo from '../Brand/VertexLogo';

interface SpotifyTopHeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onOpenDeviceSelector: () => void;
  activeDeviceName?: string;
  selectedCategory?: string;
  onSelectCategory?: (cat: string) => void;
  onGoBack?: () => void;
  onGoForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  userProfile?: UserProfile | null;
  onOpenProfileModal?: () => void;
  onOpenAddTrackModal?: () => void;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
}

export const SpotifyTopHeader: React.FC<SpotifyTopHeaderProps> = ({
  activeTab,
  onSelectTab,
  searchQuery = '',
  onSearchChange,
  onOpenDeviceSelector,
  activeDeviceName = 'Web Player',
  selectedCategory = 'All',
  onSelectCategory,
  onGoBack,
  onGoForward,
  canGoBack = true,
  canGoForward = false,
  userProfile,
  onOpenProfileModal,
  onOpenAddTrackModal,
  onLogout,
  onOpenAuthModal,
}) => {
  const categories = ['All', 'Music', 'Podcasts', 'Chill', 'Synthwave'];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      data-context-type="header"
      className="spotify-top-header sticky top-0 z-30 flex w-full items-center gap-2 border-b border-white/[0.06] bg-[#121212]/92 px-3 py-2.5 backdrop-blur-xl transition-colors select-none sm:px-6 sm:py-3"
    >
      {/* Left Navigation Buttons & Search Input */}
      <div className="flex min-w-0 items-center space-x-2.5">
        {/* Compact brand mark — mobile only, replaces desktop back/forward + search */}
        <div className="flex sm:hidden items-center space-x-2 min-w-0">
          <VertexLogo className="h-9 w-9 flex-shrink-0" />
          <button
            onClick={() => onSelectTab('search')}
            title="Search"
            className="-ml-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/[0.06] bg-white/[0.035] text-zinc-300 transition-all hover:text-white active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Back / Forward Buttons — desktop / tablet only */}
        <div className="hidden sm:flex items-center space-x-1.5 flex-shrink-0">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
            title="Go Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
            title="Go Forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Global Search Input Box — desktop / tablet only, mobile uses the Search tab instead.
            Uses flex-1 + min/max width (instead of a fixed width per breakpoint) so it shrinks
            fluidly with the window instead of jumping between sizes and overflowing into the
            buttons on the right at in-between widths. */}
        <div className="spotify-global-search hidden sm:block relative flex-1 min-w-[72px] max-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              if (onSearchChange) onSearchChange(e.target.value);
              if (activeTab !== 'search' && e.target.value.trim().length > 0) {
                onSelectTab('search');
              }
            }}
            placeholder="What do you want to play?"
            className="w-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] pl-10 pr-4 py-2 rounded-full text-xs font-medium text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#A855F7]/50 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Center/Middle Quick Category Filter Chips - Scrollable flex row cleanly isolated */}
      <div className="spotify-header-categories hidden lg:flex min-w-0 items-center space-x-2 overflow-x-auto ml-1 mr-2 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory && onSelectCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
              selectedCategory === cat
                ? 'bg-white text-black font-bold shadow'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Right User Actions & Audio Controls - Fixed & Non-shrinking */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0 ml-auto z-10">
        {/* Add Song Button — icon-only until there's room for the label (lg+),
            so it never crowds into the search box / profile pill at in-between
            window widths the way a fixed "+ Add Song" label used to. */}
        {onOpenAddTrackModal && (
          <button
            onClick={onOpenAddTrackModal}
            title="Upload"
            aria-label="Upload audio"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-[14px] border border-white/[0.06] bg-white/[0.035] text-xs font-extrabold text-white/80 transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(217,70,239,0.85)] sm:h-9 sm:w-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:px-1.5"
          >
            <Upload className="h-4 w-4 text-[#D946EF]" />
            <span className="spotify-upload-label hidden lg:inline">Upload</span>
          </button>
        )}

        {/* Spotify User Profile Dropdown Pill or Auth Buttons */}
        {userProfile ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex h-10 items-center space-x-2 rounded-[15px] border border-white/10 bg-black/70 p-1 pl-1 pr-2 transition-all shadow hover:border-white/20 hover:bg-black/90 active:scale-95 sm:h-auto sm:rounded-full sm:pr-2.5"
              title="Account & Profile Menu"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden border border-[#D946EF]/60 relative flex-shrink-0">
                <img
                  src={
                    userProfile.avatarUrl || DEFAULT_AVATAR_URL
                  }
                  alt={userProfile.displayName || 'User Avatar'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="spotify-profile-name hidden md:inline text-xs font-bold text-white max-w-[100px] truncate">
                {userProfile.displayName}
              </span>
              <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-400 transition-transform sm:block ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Spotify Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#282828] border border-white/10 rounded-lg shadow-2xl p-1 z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2.5 border-b border-white/10 mb-1">
                  <p className="text-xs font-extrabold text-white truncate">{userProfile.displayName}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{userProfile.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#D946EF]/20 text-[#D946EF] text-[10px] font-extrabold uppercase">
                      {userProfile.isArtist ? 'Artist account' : 'Listener account'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSelectTab('profile');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <User className="w-4 h-4 text-zinc-400" />
                    <span>Profile Overview</span>
                  </div>
                </button>

                <div className="my-1 border-t border-white/10" />

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onOpenAuthModal) onOpenAuthModal();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 rounded-md transition-colors"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>Switch Account / Sign In</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onOpenAuthModal}
              className="flex h-10 items-center rounded-[14px] border border-white/[0.06] bg-white/[0.035] px-3 text-xs font-bold text-zinc-200 transition-all hover:bg-white/10 hover:text-white sm:h-auto sm:rounded-full sm:border-0 sm:bg-transparent sm:px-4 sm:py-1.5"
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Log In</span>
            </button>
            <button
              onClick={onOpenAuthModal}
              className="hidden rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-4 py-1.5 text-xs font-extrabold text-white shadow-md transition-all hover:opacity-90 active:scale-95 sm:block"
            >
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
