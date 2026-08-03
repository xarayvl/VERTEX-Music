import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  ListPlus,
  Heart,
  FolderPlus,
  Share2,
  Trash2,
  SlidersHorizontal,
  Upload,
  Plus,
  Home,
  Search,
  Library,
  Bot,
  User,
  ExternalLink,
  ChevronRight,
  Copy,
  Radio,
  Sparkles,
  Music2,
  Volume2,
  Laptop,
  Compass,
  RotateCcw,
  Info,
  Edit3,
  Disc,
} from 'lucide-react';
import { Track, Playlist, Artist, TabType } from '../types';

export interface ContextMenuTarget {
  x: number;
  y: number;
  category: 'track' | 'playlist' | 'artist' | 'player' | 'sidebar' | 'header' | 'button' | 'general';
  elementName?: string;
  track?: Track;
  playlist?: Playlist;
  artist?: Artist;
  tab?: TabType;
}

interface ContextMenuProps {
  target: ContextMenuTarget | null;
  onClose: () => void;
  playlists: Playlist[];
  isPlaying: boolean;
  currentTrack: Track | null;
  currentUserId?: string;
  // Actions
  onPlayTrack: (track: Track) => void;
  onEditTrack?: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onOpenEQ: () => void;
  onOpenAddTrack: () => void;
  onOpenNewPlaylist: () => void;
  onNavigate: (tab: TabType) => void;
  onOpenProfile: () => void;
  onOpenChat: () => void;
  onOpenDeviceSelector: () => void;
  onSelectAlbum?: (track: Track) => void;
  showToast: (msg: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  target,
  onClose,
  playlists,
  isPlaying,
  currentTrack,
  currentUserId,
  onPlayTrack,
  onEditTrack,
  onAddToQueue,
  onToggleLike,
  onAddToPlaylist,
  onPlayPlaylist,
  onSelectPlaylist,
  onDeletePlaylist,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onOpenEQ,
  onOpenAddTrack,
  onOpenNewPlaylist,
  onNavigate,
  onOpenProfile,
  onOpenChat,
  onOpenDeviceSelector,
  onSelectAlbum,
  showToast,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!target) return;

    setShowPlaylistSubmenu(false);

    const updatePosition = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const padding = 12;
      const menuWidth = menu.offsetWidth;
      const menuHeight = Math.min(menu.scrollHeight, window.innerHeight - padding * 2);
      const maxX = Math.max(padding, window.innerWidth - menuWidth - padding);
      const maxY = Math.max(padding, window.innerHeight - menuHeight - padding);

      setAdjustedPos({
        x: Math.min(Math.max(padding, target.x), maxX),
        y: Math.min(Math.max(padding, target.y), maxY),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [target]);

  // Click outside to close & Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!target) return null;

  const activeTrack = target.track || (target.category === 'player' ? currentTrack : null);
  const activePlaylist = target.playlist;
  const activeArtist = target.artist;

  const handleCopyLink = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} link to clipboard!`);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedPos.y}px`, left: `${adjustedPos.x}px` }}
      className="fixed z-50 w-60 max-h-[calc(100dvh-24px)] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#161618] border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl py-2 px-1 text-zinc-200 text-xs font-medium animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Header Info Banner */}
      <div className="px-3 py-1.5 mb-1.5 border-b border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center space-x-1.5 truncate pr-2">
          <Sparkles className="w-3.5 h-3.5 text-[#D946EF] flex-shrink-0" />
          <span className="truncate font-semibold text-white">
            {target.elementName ||
              (activeTrack
                ? `Song: ${activeTrack.title}`
                : activePlaylist
                ? `Playlist: ${activePlaylist.title}`
                : activeArtist
                ? `Artist: ${activeArtist.name}`
                : 'VERTEX Context Menu')}
          </span>
        </div>
      </div>

      {/* TRACK CONTEXT ACTIONS */}
      {activeTrack && (
        <div className="space-y-0.5">
          {/* Ownership Guard: Only display Edit Track if currently logged-in user uploaded this track */}
          {currentUserId && activeTrack.userId && currentUserId === activeTrack.userId && onEditTrack && (
            <button
              onClick={() => {
                onEditTrack(activeTrack);
                onClose();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-[#A855F7]/20 text-[#C084FC] hover:text-white transition-colors font-semibold"
            >
              <Edit3 className="w-4 h-4 text-[#D946EF]" />
              <span>Edit Track</span>
            </button>
          )}

          <button
            onClick={() => {
              onPlayTrack(activeTrack);
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-[#A855F7]/30 hover:to-[#D946EF]/20 hover:text-white transition-colors"
          >
            <Play className="w-4 h-4 text-[#C084FC]" />
            <span className="font-semibold text-white">Play Song</span>
          </button>

          <button
            onClick={() => {
              onAddToQueue(activeTrack);
              showToast(`Added "${activeTrack.title}" to queue`);
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <ListPlus className="w-4 h-4 text-zinc-400" />
            <span>Add to Queue</span>
          </button>

          <button
            onClick={() => {
              onToggleLike(activeTrack.id);
              showToast(
                activeTrack.isLiked
                  ? `Removed "${activeTrack.title}" from Liked Songs`
                  : `Added "${activeTrack.title}" to Liked Songs`
              );
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${
                activeTrack.isLiked ? 'text-[#D946EF] fill-[#D946EF]' : 'text-zinc-400'
              }`}
            />
            <span>{activeTrack.isLiked ? 'Remove from Liked' : 'Save to Liked Songs'}</span>
          </button>

          {/* Submenu: Add to Playlist */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowPlaylistSubmenu(true)}
              onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span>Add to Playlist</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {showPlaylistSubmenu && (
              <div
                onMouseLeave={() => setShowPlaylistSubmenu(false)}
                className="mt-1 max-h-48 overflow-y-auto custom-scrollbar bg-[#202023] border border-white/10 rounded-xl py-1 px-1 text-xs space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <button
                  onClick={() => {
                    onOpenNewPlaylist();
                    onClose();
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#D946EF]/20 text-[#D946EF] font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Playlist</span>
                </button>
                <div className="h-[1px] bg-white/10 my-1" />
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onAddToPlaylist(pl.id, activeTrack.id);
                      showToast(`Added to "${pl.title}"`);
                      onClose();
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-left truncate"
                  >
                    <Music2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <span className="truncate">{pl.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (onSelectAlbum) {
                onSelectAlbum(activeTrack);
              }
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Disc className="w-4 h-4 text-zinc-400" />
            <span>Go to Album</span>
          </button>

          <button
            onClick={() => handleCopyLink(`${window.location.origin}/track/${activeTrack.id}`, 'Song')}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4 text-zinc-400" />
            <span>Copy Song Link</span>
          </button>

          <div className="h-[1px] bg-white/10 my-1" />
        </div>
      )}

      {/* PLAYLIST CONTEXT ACTIONS */}
      {activePlaylist && (
        <div className="space-y-0.5">
          <button
            onClick={() => {
              onPlayPlaylist(activePlaylist);
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-[#A855F7]/30 hover:to-[#D946EF]/20 hover:text-white transition-colors"
          >
            <Play className="w-4 h-4 text-[#C084FC]" />
            <span className="font-semibold text-white">Play Playlist</span>
          </button>

          <button
            onClick={() => {
              onSelectPlaylist(activePlaylist);
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-zinc-400" />
            <span>Open Playlist View</span>
          </button>

          <button
            onClick={() => handleCopyLink(`${window.location.origin}/playlist/${activePlaylist.id}`, 'Playlist')}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4 text-zinc-400" />
            <span>Copy Playlist Link</span>
          </button>

          {currentUserId && activePlaylist.userId === currentUserId && (
            <button
              onClick={() => {
                onDeletePlaylist(activePlaylist.id);
                onClose();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Playlist</span>
            </button>
          )}

          <div className="h-[1px] bg-white/10 my-1" />
        </div>
      )}

      {/* ARTIST CONTEXT ACTIONS */}
      {activeArtist && (
        <div className="space-y-0.5">
          <button
            onClick={() => handleCopyLink(`${window.location.origin}/artist/${activeArtist.id}`, 'Artist')}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4 text-zinc-400" />
            <span>Copy Artist Link</span>
          </button>
          <div className="h-[1px] bg-white/10 my-1" />
        </div>
      )}

      {/* PLAYER BAR / CONTROLS ACTIONS */}
      {target.category === 'player' && (
        <div className="space-y-0.5">
          <button
            onClick={() => {
              onTogglePlay();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-[#D946EF]" /> : <Play className="w-4 h-4 text-[#A855F7]" />}
            <span>{isPlaying ? 'Pause Audio' : 'Play Audio'}</span>
          </button>

          <button
            onClick={() => {
              onNextTrack();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Radio className="w-4 h-4 text-zinc-400" />
            <span>Skip to Next Song</span>
          </button>

          <button
            onClick={() => {
              onOpenEQ();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
            <span>Open Equalizer (EQ)</span>
          </button>

          <button
            onClick={() => {
              onOpenDeviceSelector();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            <Laptop className="w-4 h-4 text-zinc-400" />
            <span>Select Output Device</span>
          </button>

          <div className="h-[1px] bg-white/10 my-1" />
        </div>
      )}

      {/* GENERAL UI & QUICK NAVIGATION ACTIONS */}
      <div className="space-y-0.5">
        <button
          onClick={() => {
            onOpenAddTrack();
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-[#A855F7]/20 text-white transition-colors font-semibold"
        >
          <Upload className="w-4 h-4 text-[#D946EF]" />
          <span>Upload Audio Track (MP3)</span>
        </button>

        <button
          onClick={() => {
            onOpenNewPlaylist();
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4 text-zinc-400" />
          <span>Create New Playlist</span>
        </button>

        <button
          onClick={() => {
            onOpenChat();
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <Bot className="w-4 h-4 text-[#C084FC]" />
          <span>Ask VERTEX AI DJ</span>
        </button>

        <div className="h-[1px] bg-white/10 my-1" />

        {/* Quick Tabs Navigation */}
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
          Quick Jump
        </div>

        <button
          onClick={() => {
            onNavigate('home');
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <Home className="w-3.5 h-3.5 text-zinc-400" />
          <span>Go to Home</span>
        </button>

        <button
          onClick={() => {
            onNavigate('search');
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <span>Go to Search</span>
        </button>

        <button
          onClick={() => {
            onNavigate('library');
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <Library className="w-3.5 h-3.5 text-zinc-400" />
          <span>Go to Library</span>
        </button>

        <button
          onClick={() => {
            onOpenProfile();
            onClose();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span>Profile & Account</span>
        </button>
      </div>

      {/* Footer Branding */}
      <div className="mt-1 px-3 py-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500">
        <span>VERTEX Audio Engine</span>
        <Info className="w-3 h-3" />
      </div>
    </div>
  );
};
