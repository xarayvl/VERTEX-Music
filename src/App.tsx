import React, { useState, useEffect, useRef } from 'react';
import { TabType, Track, Playlist, Artist, AudioEQ, ChatMessage, UserProfile } from './types';
import { audioEngine } from './audio/audioEngine';

import { SpotifySidebar } from './components/Navigation/SpotifySidebar';
import { SpotifyTopHeader } from './components/Navigation/SpotifyTopHeader';
import { SpotifyPlayerBar } from './components/Player/SpotifyPlayerBar';
import { MiniPlayer } from './components/Player/MiniPlayer';
import { BottomTabBar } from './components/Navigation/BottomTabBar';

import { HomeView } from './components/Views/HomeView';
import { BrowseView } from './components/Views/BrowseView';
import { SearchView } from './components/Views/SearchView';
import { LibraryView } from './components/Views/LibraryView';
import { ChatView } from './components/Views/ChatView';
import { PlaylistView } from './components/Views/PlaylistView';
import { ProfileView } from './components/Views/ProfileView';
import { ArtistView } from './components/Views/ArtistView';
import { AlbumView } from './components/Views/AlbumView';

import { AudioEQModal } from './components/Modals/AudioEQModal';
import { NewPlaylistModal } from './components/Modals/NewPlaylistModal';
import { EditPlaylistModal } from './components/Modals/EditPlaylistModal';
import { DeviceSelectorModal } from './components/Modals/DeviceSelectorModal';
import { ProfileAndPremiumModal } from './components/Modals/ProfileAndPremiumModal';
import { AddTrackModal } from './components/Modals/AddTrackModal';
import { EditTrackModal } from './components/Modals/EditTrackModal';
import { AuthModal } from './components/Modals/AuthModal';
import { SongScreenModal } from './components/Modals/SongScreenModal';
import { ContextMenu, ContextMenuTarget } from './components/ContextMenu';
import { Toast } from './components/Toast';
import { NowPlayingSidebar } from './components/Player/NowPlayingSidebar';
import { DEFAULT_AVATAR_URL } from './utils/profilePlaceholders';

const normalizePublicArtist = (raw: any): Artist => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || raw?.artistName || raw?.displayName || raw?.username || 'Unknown artist'),
  username: raw?.username ? String(raw.username) : undefined,
  displayName: raw?.displayName ? String(raw.displayName) : undefined,
  avatarUrl: String(raw?.avatarUrl || DEFAULT_AVATAR_URL),
  bannerUrl: raw?.bannerUrl ? String(raw.bannerUrl) : '',
  bio: raw?.artistBio ? String(raw.artistBio) : raw?.bio ? String(raw.bio) : '',
  genre: raw?.genre ? String(raw.genre) : Array.isArray(raw?.favoriteGenres) ? String(raw.favoriteGenres[0] || '') : '',
  monthlyListeners: String(raw?.monthlyListeners || '0 monthly listeners'),
  verified: raw?.verified === true || raw?.artistVerified === true,
  isUser: raw?.isUser === true || typeof raw?.email === 'string',
  isSynthetic: raw?.isSynthetic === true,
  stats: raw?.stats
    ? {
        hoursListened: Number(raw.stats.hoursListened) || 0,
        secondsListened: Number(raw.stats.secondsListened) || 0,
        tracksPlayed: Number(raw.stats.tracksPlayed) || 0,
        topGenre: String(raw.stats.topGenre || 'N/A'),
        playlistsCreated: Number(raw.stats.playlistsCreated) || 0,
        followersCount: Number(raw.stats.followersCount) || 0,
        followingCount: Number(raw.stats.followingCount) || 0,
      }
    : undefined,
  instagramUrl: raw?.instagramUrl || undefined,
  twitterUrl: raw?.twitterUrl || undefined,
  websiteUrl: raw?.websiteUrl || undefined,
  artistPickTrackId: raw?.artistPickTrackId || undefined,
  artistPickComment: raw?.artistPickComment || undefined,
});

export default function App() {
  // Navigation State with History Stack
  const [navHistory, setNavHistory] = useState<TabType[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const activeTab = navHistory[historyIndex] || 'home';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // User Profile State with local storage persistence
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('vertex_music_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.displayName) return parsed;
      }
    } catch (e) {
      console.error('Error loading saved profile:', e);
    }
    return null;
  });

  // Media Data State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  // Followed Artists State (User-Scoped)
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);

  // Playback State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.7);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);

  // Device & Audio Engine State
  const [activeDeviceName, setActiveDeviceName] = useState<string>('Web Player (This Browser)');

  // Interactive Background Mouse Glow Position State
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 500, y: 300 });

  // Modals & Overlay States
  const [isEQOpen, setIsEQOpen] = useState<boolean>(false);
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState<boolean>(false);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState<boolean>(false);
  const [isEditPlaylistOpen, setIsEditPlaylistOpen] = useState<boolean>(false);
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState<boolean>(false);
  const [isSongScreenOpen, setIsSongScreenOpen] = useState<boolean>(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | UserProfile | null>(null);
  const [isArtistLoading, setIsArtistLoading] = useState(false);
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null);
  const artistRequestIdRef = useRef(0);
  const [selectedAlbumTrack, setSelectedAlbumTrack] = useState<Track | null>(null);

  // 'Recently Played' tracking state (User-Scoped)
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);

  // Right Sidebar ('Now Playing View') Toggle State
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vertex_right_sidebar_open');
      return saved === 'true';
    } catch {
      return true; // default to open
    }
  });

  const handleToggleRightSidebar = () => {
    setIsRightSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vertex_right_sidebar_open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Prune "Recently Played" whenever the authoritative tracks list changes
  // (e.g. after a track delete, or an admin "wipe all tracks" action).
  // recentlyPlayed is cached in localStorage as full Track snapshots, so
  // without this it would keep showing tracks that no longer exist on the
  // server / were deleted by their owner.
  useEffect(() => {
    if (!userProfile?.id) return;
    setRecentlyPlayed((prev) => {
      if (prev.length === 0) return prev;
      const existingIds = new Set(tracks.map((t) => t.id));
      const pruned = prev.filter((t) => existingIds.has(t.id));
      if (pruned.length !== prev.length) {
        try {
          localStorage.setItem(`vertex_recently_played_${userProfile.id}`, JSON.stringify(pruned));
        } catch {
          // ignore
        }
        return pruned;
      }
      return prev;
    });
  }, [tracks, userProfile?.id]);

  // Sync recentlyPlayed whenever track plays
  useEffect(() => {
    if (isPlaying && currentTrack) {
      setRecentlyPlayed((prev) => {
        const filtered = prev.filter((t) => t.id !== currentTrack.id);
        const updated = [currentTrack, ...filtered].slice(0, 15);
        if (userProfile?.id) {
          try {
            localStorage.setItem(`vertex_recently_played_${userProfile.id}`, JSON.stringify(updated));
          } catch {
            // ignore
          }
        }
        return updated;
      });
    }
  }, [isPlaying, currentTrack?.id, userProfile?.id]);

  // Resizable Sidebar Panel Width State (Persisted in localStorage with min/max constraints)
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vertex_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.min(520, Math.max(180, parsed));
        }
      }
    } catch {
      // ignore storage access errors
    }
    return 280;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  // Resizable Right Sidebar Panel Width State
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vertex_right_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.min(450, Math.max(280, parsed));
        }
      }
    } catch {
      // ignore storage access errors
    }
    return 320;
  });
  const [isResizingRightSidebar, setIsResizingRightSidebar] = useState<boolean>(false);

  useEffect(() => {
    const updateWidthFromClientX = (clientX: number) => {
      const leftOffset = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = Math.min(520, Math.max(180, clientX - leftOffset));
      setSidebarWidth(newWidth);
      try {
        localStorage.setItem('vertex_sidebar_width', newWidth.toString());
      } catch {
        // ignore
      }
    };

    const updateRightWidthFromClientX = (clientX: number) => {
      const rightEdge = document.documentElement.clientWidth;
      const newWidth = Math.min(450, Math.max(280, rightEdge - clientX));
      setRightSidebarWidth(newWidth);
      try {
        localStorage.setItem('vertex_right_sidebar_width', newWidth.toString());
      } catch {
        // ignore
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        updateWidthFromClientX(e.clientX);
      }
      if (isResizingRightSidebar) {
        updateRightWidthFromClientX(e.clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isResizingSidebar && e.touches[0]) {
        updateWidthFromClientX(e.touches[0].clientX);
      }
      if (isResizingRightSidebar && e.touches[0]) {
        updateRightWidthFromClientX(e.touches[0].clientX);
      }
    };

    const stopResizing = () => {
      setIsResizingSidebar(false);
      setIsResizingRightSidebar(false);
    };

    if (isResizingSidebar || isResizingRightSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizingSidebar, isResizingRightSidebar]);

  const handleStartResizing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingSidebar(true);
  };

  const handleStartResizingRight = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingRightSidebar(true);
  };

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Edit Track State
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Global Context Menu Target State
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const targetElement = e.target as HTMLElement | null;
    if (!targetElement) return;

    // 1. Check for Track Context
    const trackElem = targetElement.closest('[data-track-id]') as HTMLElement | null;
    if (trackElem) {
      const trackId = trackElem.getAttribute('data-track-id');
      const foundTrack = tracks.find((t) => t.id === trackId);
      if (foundTrack) {
        setContextMenuTarget({
          x: e.clientX,
          y: e.clientY,
          category: 'track',
          elementName: `Song: ${foundTrack.title}`,
          track: foundTrack,
        });
        return;
      }
    }

    // 2. Check for Playlist Context
    const playlistElem = targetElement.closest('[data-playlist-id]') as HTMLElement | null;
    if (playlistElem) {
      const playlistId = playlistElem.getAttribute('data-playlist-id');
      const foundPlaylist = playlists.find((p) => p.id === playlistId);
      if (foundPlaylist) {
        setContextMenuTarget({
          x: e.clientX,
          y: e.clientY,
          category: 'playlist',
          elementName: `Playlist: ${foundPlaylist.title}`,
          playlist: foundPlaylist,
        });
        return;
      }
    }

    // 3. Check for Artist Context
    const artistElem = targetElement.closest('[data-artist-id], [data-artist-name]') as HTMLElement | null;
    if (artistElem) {
      const artistId = artistElem.getAttribute('data-artist-id');
      const artistName = artistElem.getAttribute('data-artist-name');
      const foundArtist = artists.find((a) => a.id === artistId || a.name === artistName);
      if (foundArtist) {
        setContextMenuTarget({
          x: e.clientX,
          y: e.clientY,
          category: 'artist',
          elementName: `Artist: ${foundArtist.name}`,
          artist: foundArtist,
        });
        return;
      }
    }

    // 4. Check for Player Bar Context
    const playerElem = targetElement.closest('[data-context-type="player"], footer') as HTMLElement | null;
    if (playerElem) {
      setContextMenuTarget({
        x: e.clientX,
        y: e.clientY,
        category: 'player',
        elementName: currentTrack ? `Player: ${currentTrack.title}` : 'Playback Controls',
        track: currentTrack || undefined,
      });
      return;
    }

    // 5. Check for Sidebar Context
    const sidebarElem = targetElement.closest('[data-context-type="sidebar"], aside') as HTMLElement | null;
    if (sidebarElem) {
      setContextMenuTarget({
        x: e.clientX,
        y: e.clientY,
        category: 'sidebar',
        elementName: 'Sidebar Navigation',
      });
      return;
    }

    // 6. Check for Header Context
    const headerElem = targetElement.closest('[data-context-type="header"], header') as HTMLElement | null;
    if (headerElem) {
      setContextMenuTarget({
        x: e.clientX,
        y: e.clientY,
        category: 'header',
        elementName: 'Header & Search',
      });
      return;
    }

    // 7. Check for Interactive Control (Button / Input / Link)
    const buttonElem = targetElement.closest('button, input, a, [data-context-type="button"]') as HTMLElement | null;
    if (buttonElem) {
      const btnText =
        buttonElem.innerText ||
        buttonElem.getAttribute('aria-label') ||
        buttonElem.getAttribute('title') ||
        buttonElem.getAttribute('placeholder') ||
        'UI Button';
      setContextMenuTarget({
        x: e.clientX,
        y: e.clientY,
        category: 'button',
        elementName: `Control: ${btnText.trim().slice(0, 24)}`,
      });
      return;
    }

    // 8. General UI Canvas Fallback
    setContextMenuTarget({
      x: e.clientX,
      y: e.clientY,
      category: 'general',
      elementName: 'VERTEX Music UI Element',
    });
  };

  useEffect(() => {
    if (!userProfile) {
      setIsAuthModalOpen(true);
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      try {
        localStorage.setItem('vertex_music_user_profile', JSON.stringify(userProfile));
      } catch (e) {
        console.error('Error saving profile:', e);
      }
    } else {
      localStorage.removeItem('vertex_music_user_profile');
    }
  }, [userProfile]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('vertex_session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Load user-scoped state when logged-in user changes
  useEffect(() => {
    if (!userProfile?.id) {
      setFollowedArtistIds([]);
      setRecentlyPlayed([]);
      setSelectedArtist(null);
      setIsArtistLoading(false);
      setArtistLoadError(null);
      return;
    }
    setSelectedArtist(null);
    setIsArtistLoading(false);
    setArtistLoadError(null);
    try {
      const savedFollowed = localStorage.getItem(`vertex_followed_artists_${userProfile.id}`);
      if (savedFollowed) {
        const parsed = JSON.parse(savedFollowed);
        if (Array.isArray(parsed)) setFollowedArtistIds(parsed);
        else setFollowedArtistIds([]);
      } else {
        setFollowedArtistIds([]);
      }

      const savedRecent = localStorage.getItem(`vertex_recently_played_${userProfile.id}`);
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent);
        if (Array.isArray(parsed)) setRecentlyPlayed(parsed);
        else setRecentlyPlayed([]);
      } else {
        setRecentlyPlayed([]);
      }
    } catch {
      setFollowedArtistIds([]);
      setRecentlyPlayed([]);
    }
  }, [userProfile?.id]);

  // Hydrate any followed artist that isn't already in the local `artists`
  // cache. `followedArtistIds` is restored from localStorage per-account,
  // but the matching artist objects (banner, bio, stats) only ever lived in
  // this same browser's in-memory `artists` state — so after logging out
  // and into a different account, a followed *real user* artist has an id
  // with nothing to resolve it to, and silently disappears from the
  // sidebar/library "Artists" list. Fetch the missing ones by id so they
  // show up with their real data again.
  useEffect(() => {
    if (!followedArtistIds.length) return;
    const missingIds = followedArtistIds.filter((id) => !artists.some((a) => a.id === id));
    if (!missingIds.length) return;

    let cancelled = false;
    Promise.all(
      missingIds.map((id) =>
        fetch(`/api/users/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => (data?.success ? data.user : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const fetchedArtists: Artist[] = results.filter(Boolean).map(normalizePublicArtist);
      if (fetchedArtists.length) {
        setArtists((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const toAdd = fetchedArtists.filter((a) => !existingIds.has(a.id));
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [followedArtistIds, artists]);

  // Fetch application data (uploaded tracks, saved state, chat history) from Express server.
  // `includeChatAndUser` is turned off for background refreshes so a periodic poll doesn't
  // reset chat messages the person is actively looking at or clobber in-flight profile edits —
  // background polls only need to keep the shared tracks/playlists lists (i.e. other users'
  // uploads) up to date.
  const fetchServerData = React.useCallback(async (includeChatAndUser: boolean = true) => {
    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/data`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('vertex_session_token', data.token);
        }
        if (data.tracks && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const likedIds: string[] = data.likedTrackIds || [];
          setTracks(
            data.tracks.map((t: Track) => ({
              ...t,
              isLiked: likedIds.includes(t.id),
            }))
          );
        }
        if (data.playlists && Array.isArray(data.playlists)) {
          setPlaylists(data.playlists);
        }
        if (Array.isArray(data.artists)) {
          setArtists(data.artists.map(normalizePublicArtist));
        }
        if (!includeChatAndUser) return;
        if (data.chatHistory && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
          setChatMessages(data.chatHistory);
        } else if (userProfile?.id) {
          try {
            const saved = localStorage.getItem(`vertex_music_chat_history_${userProfile.id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) setChatMessages(parsed);
            } else {
              setChatMessages([
                {
                  id: `welcome-${Date.now()}`,
                  sender: 'ai',
                  text: `Hello ${userProfile.displayName || 'there'}! I'm **VERTEX Music AI**, your personal DJ and assistant. Ask me for recommendations, playlists, or music history!`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          } catch (e) {
            // ignore
          }
        }
        if (data.user) {
          setUserProfile((prev) => (prev ? { ...prev, ...data.user } : data.user));
        }
      }
    } catch (err) {
      console.error('Error syncing server data:', err);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    fetchServerData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  // Keep the shared tracks/playlists lists live: poll periodically and refetch whenever
  // the tab regains focus, so songs another user uploads show up here without needing
  // a full page reload or re-login.
  useEffect(() => {
    const POLL_INTERVAL_MS = 20000;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchServerData(false);
      }
    }, POLL_INTERVAL_MS);

    const handleFocus = () => fetchServerData(false);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchServerData]);

  const handleLogout = () => {
    audioEngine.pause();
    setIsPlaying(false);
    setCurrentTrack(null);
    setUserProfile(null);
    setFollowedArtistIds([]);
    setRecentlyPlayed([]);
    setTracks((prev) => prev.map((t) => ({ ...t, isLiked: false })));
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: "Hello! I'm **VERTEX Music AI**, your personal VERTEX Music DJ and music assistant. Log in to access your personal recommendations and chat session!",
        timestamp: new Date().toISOString(),
      },
    ]);
    try {
      localStorage.removeItem('vertex_session_token');
      localStorage.removeItem('vertex_music_user_profile');
      localStorage.removeItem('vertex_music_chat_history');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('vertex_music_') || key.startsWith('vertex_followed_artists') || key.startsWith('vertex_recently_played')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error clearing localStorage on logout:', e);
    }
    setIsAuthModalOpen(true);
  };

  // Fires when the server rejects a request because the session token is
  // missing/expired/unknown (e.g. the server process restarted and lost its
  // in-memory session table). Without this, the UI would keep showing the
  // person as "logged in" — because that's tracked separately via the cached
  // vertex_music_user_profile in localStorage — while every authenticated
  // action silently 401s. This clears the stale client-side session state,
  // tells the person what happened, and reopens the login modal so they can
  // get a fresh token in one step.
  const handleSessionExpired = React.useCallback(() => {
    handleLogout();
    showToast('Your session expired — please log in again.');
  }, []);

  // Kept in a ref so the fetch interceptor below (installed once on mount)
  // always calls the latest version of handleSessionExpired, and a flag ref
  // so a burst of in-flight requests that all 401 at once only triggers the
  // logout flow once. The flag resets on the next successful login.
  const handleSessionExpiredRef = React.useRef(handleSessionExpired);
  const sessionExpiryHandledRef = React.useRef(false);
  React.useEffect(() => {
    handleSessionExpiredRef.current = handleSessionExpired;
  }, [handleSessionExpired]);

  // Global fetch interceptor: watches every request the app makes and, if
  // the server responds 401 with a session-related error, triggers
  // handleSessionExpired exactly once.
  React.useEffect(() => {
    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    const customFetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && !sessionExpiryHandledRef.current) {
        const hadToken = !!localStorage.getItem('vertex_session_token');
        if (hadToken) {
          const clone = response.clone();
          clone
            .json()
            .then((data: any) => {
              if (data?.error && /session/i.test(String(data.error)) && !sessionExpiryHandledRef.current) {
                sessionExpiryHandledRef.current = true;
                handleSessionExpiredRef.current();
              }
            })
            .catch(() => {
              // Non-JSON 401 body — still treat it as an expired session
              // since every auth-gated route in this app returns JSON.
              if (!sessionExpiryHandledRef.current) {
                sessionExpiryHandledRef.current = true;
                handleSessionExpiredRef.current();
              }
            });
        }
      }
      return response;
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
      });
      return () => {
        try {
          Object.defineProperty(window, 'fetch', {
            value: originalFetch,
            writable: true,
            configurable: true,
          });
        } catch {
          // Ignore cleanup errors if property cannot be redefined
        }
      };
    } catch (e) {
      console.warn('Unable to redefine window.fetch for session expiry tracking:', e);
    }
  }, []);

  const handleLoginSuccess = (user: UserProfile, token?: string) => {
    sessionExpiryHandledRef.current = false;
    setUserProfile(user);
    if (token) {
      localStorage.setItem('vertex_session_token', token);
    }
    try {
      localStorage.setItem('vertex_music_user_profile', JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user profile:', e);
    }
    showToast(`Welcome back, ${user.displayName || user.username}!`);
  };

  const handleOpenProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  // Equalizer State
  const [eq, setEq] = useState<AudioEQ>({
    bass: 0,
    mid: 0,
    treble: 0,
    preset: 'None',
  });

  // Persistent Chat History State (Scoped to current user)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Hello! I'm **VERTEX Music AI**, your personal VERTEX Music DJ and music assistant. Ask me to recommend songs, curate playlist concepts, explain genres, or analyze musical moods!",
      timestamp: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    if (!userProfile?.id) return;
    try {
      localStorage.setItem(`vertex_music_chat_history_${userProfile.id}`, JSON.stringify(chatMessages));
      fetch(`/api/chat-history/${userProfile.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ chatHistory: chatMessages }),
      }).catch((e) => console.error('Error syncing chat history with server:', e));
    } catch (e) {
      console.error('Error saving chat history:', e);
    }
  }, [chatMessages, userProfile?.id]);

  // Sync Equalizer with audioEngine
  useEffect(() => {
    audioEngine.setEQ(eq);
  }, [eq]);

  // Keep a ref to latest state for audio callbacks to avoid stale closures
  const playbackRef = useRef({
    currentTrack,
    tracks,
    queue,
    repeatMode,
    isShuffle,
    handleNextTrack: () => {},
    handlePrevTrack: () => {},
  });

  // Handle Navigation Tab Switch
  const handleSelectTab = (tab: TabType) => {
    setIsSongScreenOpen(false);
    if (tab === activeTab) return;
    const newHistory = navHistory.slice(0, historyIndex + 1);
    newHistory.push(tab);
    setNavHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < navHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Track Mouse Movement for Interactive Ambient Spotlight
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Initialize Audio Engine callbacks
  useEffect(() => {
    audioEngine.setOnTimeUpdate((curTime, dur) => {
      setCurrentTimeSeconds(curTime);
      const track = playbackRef.current.currentTrack;
      if (dur > 0 && track && (!track.duration || track.duration <= 0 || Math.abs(track.duration - dur) > 2)) {
        setCurrentTrack((prev) => (prev ? { ...prev, duration: dur } : null));
      }
    });

    audioEngine.setOnEnded(() => {
      playbackRef.current.handleNextTrack();
    });
  }, []);

  // Handle Audio Playback & Timer
  useEffect(() => {
    let timer: number | null = null;

    if (isPlaying && currentTrack) {
      audioEngine.playTrack(currentTrack, currentTimeSeconds);

      if (!currentTrack.audioUrl) {
        timer = window.setInterval(() => {
          setCurrentTimeSeconds((prev) => {
            if (currentTrack && prev >= currentTrack.duration) {
              playbackRef.current.handleNextTrack();
              return 0;
            }
            return prev + 1;
          });
        }, 1000);
      }
    } else {
      audioEngine.pause();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, currentTrack?.id, currentTrack?.audioUrl]);

  // Track actual user listening time when playing
  useEffect(() => {
    let secondTimer: number | null = null;
    if (isPlaying && currentTrack) {
      secondTimer = window.setInterval(() => {
        setUserProfile((prev) => {
          if (!prev) return null;
          const currentStats = prev.stats || {
            hoursListened: 0,
            secondsListened: 0,
            tracksPlayed: 0,
            topGenre: 'N/A',
            playlistsCreated: 0,
            followersCount: 0,
            followingCount: 0,
          };
          const newSeconds = (currentStats.secondsListened || 0) + 1;
          const newHours = Number((newSeconds / 3600).toFixed(1));
          return {
            ...prev,
            stats: {
              ...currentStats,
              secondsListened: newSeconds,
              hoursListened: newHours,
            },
          };
        });
      }, 1000);
    }
    return () => {
      if (secondTimer) clearInterval(secondTimer);
    };
  }, [isPlaying, currentTrack?.id]);

  // Sync Volume
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  // Helper to record track play
  const recordTrackPlay = (track: Track) => {
    setUserProfile((prev) => {
      if (!prev) return null;
      const currentStats = prev.stats || {
        hoursListened: 0,
        secondsListened: 0,
        tracksPlayed: 0,
        topGenre: 'N/A',
        playlistsCreated: 0,
        followersCount: 0,
        followingCount: 0,
      };
      return {
        ...prev,
        stats: {
          ...currentStats,
          tracksPlayed: (currentStats.tracksPlayed || 0) + 1,
        },
      };
    });

    setTracks((prevTracks) =>
      prevTracks.map((t) => {
        if (t.id === track.id) {
          const currentPlays = parseInt(t.plays || '0', 10) || 0;
          return { ...t, plays: (currentPlays + 1).toString() };
        }
        return t;
      })
    );

    // Persist the play count (and this listener's tracksPlayed stat) to the
    // backend so it survives redeploys and is reflected in Upstash instead
    // of only living in React state / localStorage.
    fetch(`/api/tracks/${track.id}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    }).catch((err) => console.error('Failed to persist track play:', err));
  };

  // Periodically persist cumulative listening-time stats (seconds/hours
  // listened) to the backend while a track is actually playing, so this
  // data is saved to Upstash instead of only existing in local state.
  const lastPersistedSecondsRef = useRef(0);
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    let syncTimer: number | null = null;
    if (isPlaying && currentTrack) {
      syncTimer = window.setInterval(() => {
        const liveProfile = userProfileRef.current;
        const stats = liveProfile?.stats;
        if (!liveProfile || !stats) return;
        if ((stats.secondsListened || 0) === lastPersistedSecondsRef.current) return;
        lastPersistedSecondsRef.current = stats.secondsListened || 0;
        fetch(`/api/users/${liveProfile.id}/listening-stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            secondsListened: stats.secondsListened || 0,
            hoursListened: stats.hoursListened || 0,
          }),
        }).catch((err) => console.error('Failed to persist listening stats:', err));
      }, 15000);
    }
    return () => {
      if (syncTimer) clearInterval(syncTimer);
    };
  }, [isPlaying, currentTrack?.id, userProfile?.id]);

  // Actions
  const handleTogglePlay = () => {
    if (!currentTrack && tracks.length > 0) {
      setCurrentTrack(tracks[0]);
      setIsPlaying(true);
      recordTrackPlay(tracks[0]);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(track);
    }
  };

  // Dedicated shuffle-play handler for a track list (currently used by the
  // artist page's Shuffle button). Deliberately does NOT go through
  // handlePlayTrack, which toggles pause when you "play" the track that's
  // already current — that's exactly what made Shuffle silently stop
  // playback whenever it happened to land on the currently-playing track.
  // This always ends in isPlaying = true, picks a track different from the
  // current one when possible, sets the queue to this track list so
  // Next/Prev shuffle within it too, and turns shuffle mode on.
  const handleShufflePlayTracks = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    let pool = trackList;
    if (currentTrack && trackList.length > 1) {
      const withoutCurrent = trackList.filter((t) => t.id !== currentTrack.id);
      if (withoutCurrent.length > 0) pool = withoutCurrent;
    }
    const randomTrack = pool[Math.floor(Math.random() * pool.length)];
    setIsShuffle(true);
    setQueue(trackList);
    setCurrentTrack(randomTrack);
    setCurrentTimeSeconds(0);
    setIsPlaying(true);
    recordTrackPlay(randomTrack);
  };

  const handleNextTrack = () => {
    const activeList = queue.length > 0 ? queue : tracks;
    if (activeList.length === 0) return;
    if (repeatMode === 'one') {
      if (currentTrack) {
        // Explicitly restart playback from the beginning — the audio element
        // is already paused/ended at this point (onended already fired), so
        // just resetting React state doesn't make it play again on its own.
        audioEngine.playTrack(currentTrack, 0);
        recordTrackPlay(currentTrack);
      }
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      return;
    }

    let nextIdx = currentTrack ? activeList.findIndex((t) => t.id === currentTrack.id) + 1 : 0;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * activeList.length);
    }
    if (nextIdx >= activeList.length || nextIdx < 0) {
      nextIdx = 0;
    }
    if (activeList[nextIdx]) {
      setCurrentTrack(activeList[nextIdx]);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(activeList[nextIdx]);
    }
  };

  const handlePrevTrack = () => {
    const activeList = queue.length > 0 ? queue : tracks;
    if (activeList.length === 0) return;
    let prevIdx = currentTrack ? activeList.findIndex((t) => t.id === currentTrack.id) - 1 : 0;
    if (prevIdx < 0) prevIdx = activeList.length - 1;
    if (activeList[prevIdx]) {
      setCurrentTrack(activeList[prevIdx]);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(activeList[prevIdx]);
    }
  };

  // Keep playbackRef updated on every render
  useEffect(() => {
    playbackRef.current = {
      currentTrack,
      tracks,
      queue,
      repeatMode,
      isShuffle,
      handleNextTrack,
      handlePrevTrack,
    };
  });

  const handleSeek = (fraction: number) => {
    if (!currentTrack) return;
    const newSeconds = Math.floor(fraction * currentTrack.duration);
    setCurrentTimeSeconds(newSeconds);
    audioEngine.seek(newSeconds, currentTrack);
  };

  const handleToggleLike = (trackId: string) => {
    setTracks((prev) => {
      const updated = prev.map((t) => (t.id === trackId ? { ...t, isLiked: !t.isLiked } : t));
      if (userProfile?.id) {
        const likedIds = updated.filter((t) => t.isLiked).map((t) => t.id);
        fetch(`/api/user-state/${userProfile.id}/liked-tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ likedTrackIds: likedIds }),
        }).catch((e) => console.error('Error syncing liked tracks:', e));
      }
      return updated;
    });

    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isLiked: !prev.isLiked } : null));
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const playlistTracks = tracks.filter((t) => playlist.trackIds.includes(t.id));
    if (playlistTracks.length > 0) {
      setQueue(playlistTracks);
      handlePlayTrack(playlistTracks[0]);
    }
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylistId(playlist.id);
    handleSelectTab('playlist');
  };

  const handleUpdatePlaylist = (updatedPl: Playlist) => {
    setPlaylists((prev) => prev.map((p) => (p.id === updatedPl.id ? updatedPl : p)));
    if (userProfile?.id) {
      fetch(`/api/playlists/${updatedPl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedPl),
      }).catch((e) => console.error('Error updating playlist on server:', e));
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(null);
      handleGoBack();
    }
    if (userProfile?.id) {
      fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch((e) => console.error('Error deleting playlist on server:', e));
    }
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === playlistId && !p.trackIds.includes(trackId)) {
          const newTrackIds = [...p.trackIds, trackId];
          const updated = {
            ...p,
            trackIds: newTrackIds,
            trackCount: newTrackIds.length,
          };
          if (userProfile?.id) {
            fetch(`/api/playlists/${playlistId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ trackIds: newTrackIds }),
            }).catch((e) => console.error('Error adding track to playlist on server:', e));
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === playlistId) {
          const newTrackIds = p.trackIds.filter((id) => id !== trackId);
          const updated = {
            ...p,
            trackIds: newTrackIds,
            trackCount: newTrackIds.length,
          };
          if (userProfile?.id) {
            fetch(`/api/playlists/${playlistId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ trackIds: newTrackIds }),
            }).catch((e) => console.error('Error removing track from playlist on server:', e));
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleCreatePlaylist = async (newPl: Playlist) => {
    const plWithUser = {
      ...newPl,
      userId: userProfile?.id || '',
    };
    setPlaylists((prev) => [plWithUser, ...prev]);
    setSelectedPlaylistId(plWithUser.id);
    handleSelectTab('playlist');
    if (userProfile?.id) {
      try {
        await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(plWithUser),
        });
      } catch (e) {
        console.error('Error creating playlist on server:', e);
      }
    }
  };

  const upsertArtist = React.useCallback((artist: Artist) => {
    setArtists((prev) => {
      const exists = prev.some((item) => item.id === artist.id);
      return exists
        ? prev.map((item) => (item.id === artist.id ? { ...item, ...artist } : item))
        : [artist, ...prev];
    });
  }, []);

  const resolveArtistByIdFromServer = React.useCallback(
    async (id: string): Promise<Artist | null> => {
      if (!id || id === 'public' || id.startsWith('artist-')) return null;
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.success || !data.user) return null;
        const artist = normalizePublicArtist(data.user);
        upsertArtist(artist);
        return artist;
      } catch (error) {
        console.error('Error resolving artist profile by id:', error);
        return null;
      }
    },
    [upsertArtist]
  );

  const resolveArtistByNameFromServer = React.useCallback(
    async (name: string): Promise<Artist | null> => {
      const cleanName = name.trim();
      if (!cleanName) return null;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(cleanName)}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data?.artists) || data.artists.length === 0) return null;
        const normalizedName = cleanName.toLocaleLowerCase();
        const exact =
          data.artists.find(
            (candidate: any) =>
              candidate?.name?.toLocaleLowerCase() === normalizedName ||
              candidate?.username?.toLocaleLowerCase() === normalizedName ||
              candidate?.displayName?.toLocaleLowerCase() === normalizedName
          ) || data.artists[0];
        if (!exact) return null;
        const artist = normalizePublicArtist(exact);
        upsertArtist(artist);
        return artist;
      } catch (error) {
        console.error('Error resolving artist profile by name:', error);
        return null;
      }
    },
    [upsertArtist]
  );

  const handleSelectArtist = async (input: Artist | UserProfile | string) => {
    const requestId = ++artistRequestIdRef.current;
    setArtistLoadError(null);

    const requestedName =
      typeof input === 'string'
        ? input.trim()
        : 'email' in input
          ? input.artistName || input.displayName || input.username
          : input.name;

    const sameNameBelongsToAnotherAccount = Boolean(
      typeof input === 'string' &&
        tracks.some(
          (track) =>
            track.artist.toLocaleLowerCase() === input.toLocaleLowerCase() &&
            track.userId &&
            track.userId !== 'public' &&
            track.userId !== userProfile?.id
        )
    );
    const isOwnProfile = Boolean(
      userProfile &&
        (typeof input !== 'string'
          ? input.id === userProfile.id
          : !sameNameBelongsToAnotherAccount &&
            requestedName &&
            [userProfile.artistName, userProfile.displayName, userProfile.username]
              .filter(Boolean)
              .some((name) => name!.toLocaleLowerCase() === requestedName.toLocaleLowerCase()))
    );

    if (isOwnProfile && userProfile) {
      setSelectedArtist(userProfile);
      setIsArtistLoading(false);
      handleSelectTab('artist');
      return;
    }

    handleSelectTab('artist');

    const objectCandidate = typeof input === 'string' ? null : input;
    const cachedCandidate =
      typeof input === 'string'
        ? artists.find(
            (artist) =>
              artist.id === input ||
              artist.name.toLocaleLowerCase() === input.toLocaleLowerCase() ||
              artist.username?.toLocaleLowerCase() === input.toLocaleLowerCase()
          ) || null
        : null;
    const candidate = objectCandidate || cachedCandidate;

    if (candidate) {
      const normalizedCandidate = 'email' in candidate ? candidate : normalizePublicArtist(candidate);
      setSelectedArtist(normalizedCandidate);
    } else {
      setSelectedArtist(null);
    }
    setIsArtistLoading(true);

    let resolved: Artist | null = null;

    const candidateId = candidate?.id;
    if (candidateId && candidateId !== 'public') {
      resolved = await resolveArtistByIdFromServer(candidateId);
    }

    if (!resolved && typeof input === 'string') {
      const matchingTrack = tracks.find(
        (track) =>
          track.artist.toLocaleLowerCase() === input.toLocaleLowerCase() &&
          track.userId &&
          track.userId !== 'public'
      );
      if (matchingTrack?.userId) {
        resolved = await resolveArtistByIdFromServer(matchingTrack.userId);
      }
    }

    if (!resolved && requestedName) {
      resolved = await resolveArtistByNameFromServer(requestedName);
    }

    if (requestId !== artistRequestIdRef.current) return;

    if (resolved) {
      setSelectedArtist(resolved);
      setArtistLoadError(
        resolved.isSynthetic ? 'This catalog artist is not linked to a registered user profile.' : null
      );
    } else if (candidate) {
      const normalizedCandidate = 'email' in candidate ? candidate : normalizePublicArtist(candidate);
      setSelectedArtist(normalizedCandidate);
      if (!('email' in normalizedCandidate) && normalizedCandidate.isSynthetic) {
        setArtistLoadError('This catalog artist is not linked to a registered user profile.');
      }
    } else {
      setSelectedArtist(null);
      setArtistLoadError(`No registered artist profile was found for “${requestedName || 'this artist'}”.`);
    }

    setIsArtistLoading(false);
  };

  const handleSelectAlbum = (track: Track) => {
    setSelectedAlbumTrack(track);
    handleSelectTab('album');
  };

  // Same root cause as the ArtistView/sidebar issue, different screen: the
  // "Now Playing" sidebar also reads the artist's banner/avatar from the
  // local `artists` cache. If the currently playing track is by a real
  // artist whose data was never synced into this session (e.g. you're on a
  // different account than the one that uploaded/owns it), it silently
  // falls back to generic placeholder art. Resolve it from the server the
  // same way an artist-page visit does.
  useEffect(() => {
    if (!currentTrack?.artist) return;
    const name = currentTrack.artist;
    const alreadyKnown =
      artists.some((a) => a.name.toLowerCase() === name.toLowerCase()) ||
      (userProfile?.isArtist &&
        (userProfile.displayName?.toLowerCase() === name.toLowerCase() ||
          userProfile.artistName?.toLowerCase() === name.toLowerCase() ||
          userProfile.username?.toLowerCase() === name.toLowerCase()));
    if (alreadyKnown) return;
    if (currentTrack.userId && currentTrack.userId !== 'public') {
      resolveArtistByIdFromServer(currentTrack.userId);
    } else {
      resolveArtistByNameFromServer(name);
    }
  }, [
    currentTrack?.artist,
    currentTrack?.userId,
    artists,
    userProfile,
    resolveArtistByIdFromServer,
    resolveArtistByNameFromServer,
  ]);

  const handleDeleteTrack = async (trackId: string) => {
    // Keep a snapshot so we can roll back the optimistic update if the server rejects the delete.
    const previousTracks = tracks;
    const wasCurrentTrack = currentTrack?.id === trackId;

    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (wasCurrentTrack) {
      handleNextTrack();
    }

    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE', headers: getAuthHeaders() });
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        // no JSON body
      }

      if (!res.ok || payload?.success === false) {
        // Server refused the delete (e.g. not the owner, session expired) — roll back the UI.
        setTracks(previousTracks);
        showToast(payload?.error || 'Failed to delete track. Please try again.');
        return;
      }

      showToast('Track deleted from user folder');
    } catch (e) {
      console.error('Error deleting track:', e);
      // Network/unexpected error — also roll back so the UI doesn't lie about the track being gone.
      setTracks(previousTracks);
      showToast('Failed to delete track. Please check your connection and try again.');
    }
  };

  const handleWipeAllTracks = async () => {
    try {
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentTrack(null);
      setTracks([]);
      setQueue([]);
      setSelectedAlbumTrack(null);

      setPlaylists((prev) => prev.map((p) => ({ ...p, trackIds: [], trackCount: 0 })));

      const res = await fetch('/api/tracks/wipe', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        showToast('All uploaded songs wiped successfully.');
      } else {
        showToast('Wiped songs locally.');
      }
    } catch (e) {
      console.error('Error wiping tracks:', e);
      showToast('All uploaded songs wiped locally.');
    }
  };

  const handleToggleFollowArtist = (artistToToggle: Artist | UserProfile) => {
    const normalizedTarget = normalizePublicArtist(artistToToggle);
    if (normalizedTarget.isSynthetic || normalizedTarget.isUser !== true) {
      showToast('This catalog artist is not linked to a followable user profile.');
      return;
    }
    if (!userProfile || normalizedTarget.id === userProfile.id) return;

    const artistId = normalizedTarget.id;
    const isCurrentlyFollowing = followedArtistIds.includes(artistId);
    const delta = isCurrentlyFollowing ? -1 : 1;

    setFollowedArtistIds((prev) => {
      const next = isCurrentlyFollowing ? prev.filter((id) => id !== artistId) : [artistId, ...prev];
      try {
        localStorage.setItem(`vertex_followed_artists_${userProfile.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    const updatedProfile: UserProfile = {
      ...userProfile,
      stats: {
        ...userProfile.stats,
        followingCount: Math.max(0, (userProfile.stats?.followingCount || 0) + delta),
      },
    };
    setUserProfile(updatedProfile);
    fetch(`/api/users/${userProfile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updatedProfile),
    }).catch((error) => console.error('Error updating following count:', error));

    const optimisticTarget: Artist = {
      ...normalizedTarget,
      stats: {
        hoursListened: normalizedTarget.stats?.hoursListened || 0,
        secondsListened: normalizedTarget.stats?.secondsListened || 0,
        tracksPlayed: normalizedTarget.stats?.tracksPlayed || 0,
        topGenre: normalizedTarget.stats?.topGenre || 'N/A',
        playlistsCreated: normalizedTarget.stats?.playlistsCreated || 0,
        followingCount: normalizedTarget.stats?.followingCount || 0,
        followersCount: Math.max(0, (normalizedTarget.stats?.followersCount || 0) + delta),
      },
    };
    upsertArtist(optimisticTarget);
    setSelectedArtist((current) =>
      current && current.id === artistId ? { ...current, stats: optimisticTarget.stats! } : current
    );

    fetch(`/api/users/${artistId}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ action: isCurrentlyFollowing ? 'unfollow' : 'follow' }),
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (!ok || typeof data?.followersCount !== 'number') return;
        const confirmed: Artist = {
          ...optimisticTarget,
          stats: { ...optimisticTarget.stats!, followersCount: data.followersCount },
        };
        upsertArtist(confirmed);
        setSelectedArtist((current) =>
          current && current.id === artistId ? { ...current, stats: confirmed.stats! } : current
        );
      })
      .catch((error) => console.error('Error updating target followers count:', error));
  };

  const handleUpdateArtist = async (updatedData: {
    artistName: string;
    artistBio: string;
    avatarUrl: string;
    bannerUrl: string;
    genre: string;
    artistVerified: boolean;
    monthlyListeners: string;
    instagramUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    artistPickTrackId?: string;
    artistPickComment?: string;
  }) => {
    if (!userProfile || selectedArtist?.id !== userProfile.id) {
      showToast('Only the profile owner can edit this artist profile.');
      return;
    }

    const genre = updatedData.genre.trim();
    const updatedProfile: UserProfile = {
      ...userProfile,
      isArtist: true,
      artistName: updatedData.artistName.trim() || userProfile.artistName || userProfile.displayName,
      bio: updatedData.artistBio,
      artistBio: updatedData.artistBio,
      avatarUrl: updatedData.avatarUrl,
      bannerUrl: updatedData.bannerUrl,
      favoriteGenres: genre
        ? [genre, ...(userProfile.favoriteGenres || []).filter((item) => item !== genre)]
        : userProfile.favoriteGenres || [],
      artistVerified: updatedData.artistVerified === true,
      monthlyListeners: updatedData.monthlyListeners || '0 monthly listeners',
      instagramUrl: updatedData.instagramUrl,
      twitterUrl: updatedData.twitterUrl,
      websiteUrl: updatedData.websiteUrl,
      artistPickTrackId: updatedData.artistPickTrackId,
      artistPickComment: updatedData.artistPickComment,
    };

    setUserProfile(updatedProfile);
    setSelectedArtist(updatedProfile);
    upsertArtist(normalizePublicArtist(updatedProfile));

    try {
      const res = await fetch(`/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedProfile),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.user) {
        showToast(data?.error || 'Could not save artist profile changes — please try again.');
        return;
      }

      const persisted: UserProfile = { ...updatedProfile, ...data.user };
      setUserProfile(persisted);
      setSelectedArtist(persisted);
      upsertArtist(normalizePublicArtist(persisted));
      showToast('Artist profile saved successfully!');
    } catch (error) {
      console.error('Failed to sync artist profile update with server:', error);
      showToast('Could not save artist profile changes — please try again.');
    }
  };

  const handleUpdateUserProfile = async (updated: UserProfile) => {
    setUserProfile(updated);
    if (updated.isArtist) {
      upsertArtist(normalizePublicArtist(updated));
    }
    if (updated.id) {
      try {
        const res = await fetch(`/api/users/${updated.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(updated),
        });
        const data = await res.json().catch(() => null);
        // Swap in the server-persisted (R2/CDN) URLs so we're not left holding
        // huge base64 data: URLs in state / localStorage after an image upload.
        if (data?.success && data.user) {
          const persisted = { ...updated, ...data.user } as UserProfile;
          setUserProfile(persisted);
          if (persisted.isArtist) upsertArtist(normalizePublicArtist(persisted));
        }
      } catch (err) {
        console.error('Failed to update user profile on server:', err);
      }
    }
  };

  const progressFraction = currentTrack?.duration ? currentTimeSeconds / currentTrack.duration : 0;

  return (
    <div
      onContextMenu={handleContextMenu}
      className="h-screen w-screen bg-black text-zinc-100 font-sans flex flex-col overflow-hidden p-2 gap-2 select-none relative"
    >
      {/* Interactive Radial Spotlight following mouse cursor & current track accent color */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 z-0 opacity-25"
        style={{
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, ${currentTrack?.accentColor || '#A855F7'} 0%, transparent 80%)`,
        }}
      />

      {/* Main Workspace (Left Sidebar + Draggable Splitter Divider + Main View) */}
      <div className={`flex-1 flex min-h-0 gap-0.5 relative z-10 overflow-hidden ${isResizingSidebar || isResizingRightSidebar ? 'select-none cursor-col-resize' : ''}`}>
        {/* Left VERTEX Music Sidebar (Visible on desktop & tablets, resizable width) */}
        <div
          ref={sidebarRef}
          className="hidden md:flex h-full flex-shrink-0"
          style={{ width: `${sidebarWidth}px` }}
        >
          <SpotifySidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            playlists={playlists}
            artists={artists.filter((a) => followedArtistIds.includes(a.id))}
            tracks={tracks}
            onSelectPlaylist={handleSelectPlaylist}
            onOpenNewPlaylistModal={() => setIsNewPlaylistOpen(true)}
            onPlayTrack={handlePlayTrack}
            currentTrackId={currentTrack?.id}
            onOpenProfileModal={handleOpenProfileModal}
            recentlyPlayed={recentlyPlayed}
            onSelectAlbum={handleSelectAlbum}
          />
        </div>

        {/* Draggable Resizable Splitter Divider */}
        <div
          onMouseDown={handleStartResizing}
          onTouchStart={handleStartResizing}
          onDoubleClick={() => {
            setSidebarWidth(280);
            try {
              localStorage.setItem('vertex_sidebar_width', '280');
            } catch {
              // ignore
            }
          }}
          title="Drag to resize sidebar (Double-click to reset)"
          className={`hidden md:flex items-center justify-center w-3 hover:w-3 -mx-1 cursor-col-resize group transition-colors select-none relative z-30 flex-shrink-0 ${
            isResizingSidebar ? 'bg-[#A855F7]/30' : 'hover:bg-white/10 bg-transparent'
          }`}
        >
          {/* Visual vertical grip bar handle */}
          <div
            className={`w-1 h-12 rounded-full transition-all ${
              isResizingSidebar
                ? 'bg-[#D946EF] opacity-100 shadow-lg scale-110'
                : 'bg-zinc-600 group-hover:bg-[#A855F7] opacity-60 group-hover:opacity-100'
            }`}
          />
        </div>

        {/* Transparent full-screen overlay during drag to capture all mouse move events */}
        {isResizingSidebar && (
          <div
            className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent"
            onMouseMove={(e) => {
              const leftOffset = sidebarRef.current?.getBoundingClientRect().left ?? 0;
              const newWidth = Math.min(520, Math.max(180, e.clientX - leftOffset));
              setSidebarWidth(newWidth);
            }}
            onMouseUp={() => setIsResizingSidebar(false)}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                const leftOffset = sidebarRef.current?.getBoundingClientRect().left ?? 0;
                const newWidth = Math.min(520, Math.max(180, e.touches[0].clientX - leftOffset));
                setSidebarWidth(newWidth);
              }
            }}
            onTouchEnd={() => setIsResizingSidebar(false)}
          />
        )}

        {isResizingRightSidebar && (
          <div
            className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent"
            onMouseMove={(e) => {
              const rightEdge = document.documentElement.clientWidth;
              const newWidth = Math.min(450, Math.max(280, rightEdge - e.clientX));
              setRightSidebarWidth(newWidth);
            }}
            onMouseUp={() => setIsResizingRightSidebar(false)}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                const rightEdge = document.documentElement.clientWidth;
                const newWidth = Math.min(450, Math.max(280, rightEdge - e.touches[0].clientX));
                setRightSidebarWidth(newWidth);
              }
            }}
            onTouchEnd={() => setIsResizingRightSidebar(false)}
          />
        )}

        {/* Central VERTEX Music View Container */}
        <main className="flex-1 bg-[#121212] rounded-xl flex flex-col min-w-0 overflow-hidden border border-white/[0.04] shadow-2xl relative">
          {/* Top Header Navigation Bar */}
          <SpotifyTopHeader
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenEQ={() => setIsEQOpen(true)}
            onOpenDeviceSelector={() => setIsDeviceSelectorOpen(true)}
            activeDeviceName={activeDeviceName}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex < navHistory.length - 1}
            userProfile={userProfile}
            onOpenProfileModal={handleOpenProfileModal}
            onOpenAddTrackModal={() => setIsAddTrackOpen(true)}
            onLogout={handleLogout}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />

          {/* Scrollable View Content */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-44 md:pb-24 custom-scrollbar">
            {isSongScreenOpen ? (
              <SongScreenModal
                isOpen={isSongScreenOpen}
                onClose={() => setIsSongScreenOpen(false)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                progress={progressFraction}
                currentTimeSeconds={currentTimeSeconds}
                volume={volume}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                onTogglePlay={handleTogglePlay}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSeek={handleSeek}
                onVolumeChange={setVolume}
                onToggleLike={handleToggleLike}
                onToggleShuffle={() => setIsShuffle(!isShuffle)}
                onToggleRepeat={() =>
                  setRepeatMode(
                    repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
                  )
                }
                onSelectArtist={handleSelectArtist}
                onOpenEQ={() => setIsEQOpen(true)}
                userProfile={userProfile}
              />
            ) : (
              <>
                {activeTab === 'home' && (
              <HomeView
                tracks={tracks}
                playlists={playlists}
                albums={[]}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onToggleLike={handleToggleLike}
                selectedCategory={selectedCategory}
                onSelectTab={handleSelectTab}
                onOpenAddTrackModal={() => setIsAddTrackOpen(true)}
                onOpenNewPlaylistModal={() => setIsNewPlaylistOpen(true)}
              />
            )}

            {activeTab === 'browse' && (
              <BrowseView
                tracks={tracks}
                playlists={playlists}
                artists={artists}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onToggleLike={handleToggleLike}
                onSelectArtist={handleSelectArtist}
              />
            )}

            {activeTab === 'search' && (
              <SearchView
                tracks={tracks}
                playlists={playlists}
                artists={artists}
                userProfile={userProfile}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectArtist={handleSelectArtist}
                onToggleLike={handleToggleLike}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                tracks={tracks}
                playlists={playlists}
                artists={artists.filter((a) => followedArtistIds.includes(a.id))}
                onPlayTrack={handlePlayTrack}
                onPlayPlaylist={handlePlayPlaylist}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectAlbum={handleSelectAlbum}
                onSelectArtist={handleSelectArtist}
                onOpenNewPlaylistModal={() => setIsNewPlaylistOpen(true)}
                onOpenAddTrackModal={() => setIsAddTrackOpen(true)}
                onWipeAllTracks={handleWipeAllTracks}
                onToggleLike={handleToggleLike}
              />
            )}

            {activeTab === 'playlist' && (
              <PlaylistView
                playlist={playlists.find((p) => p.id === selectedPlaylistId) || playlists[0]}
                allTracks={tracks}
                currentTrackId={currentTrack.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onPlayPlaylist={handlePlayPlaylist}
                onToggleLike={handleToggleLike}
                onOpenEditModal={() => setIsEditPlaylistOpen(true)}
                onDeletePlaylist={handleDeletePlaylist}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              />
            )}

            {activeTab === 'chat' && (
              <ChatView
                tracks={tracks}
                playlists={playlists}
                messages={chatMessages}
                onUpdateMessages={setChatMessages}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onTrackAdded={(newTrack) => setTracks((prev) => [newTrack, ...prev.filter((t) => t.id !== newTrack.id)])}
                userId={userProfile?.id}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                userProfile={userProfile}
                onUpdateProfile={handleUpdateUserProfile}
                tracks={tracks}
                playlists={playlists}
                recentlyPlayed={recentlyPlayed}
                onPlayTrack={handlePlayTrack}
                onLogout={handleLogout}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onSelectArtist={handleSelectArtist}
                onDeleteTrack={handleDeleteTrack}
                onEditTrack={(tr) => setEditingTrack(tr)}
                onOpenAddTrackModal={() => setIsAddTrackOpen(true)}
              />
            )}

            {activeTab === 'artist' && (
              <ArtistView
                artist={selectedArtist}
                allTracks={tracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onShufflePlay={handleShufflePlayTracks}
                onToggleLike={handleToggleLike}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onSelectPlaylist={handleSelectPlaylist}
                onGoBack={handleGoBack}
                userProfile={userProfile}
                onUpdateArtist={handleUpdateArtist}
                isFollowing={followedArtistIds.includes(selectedArtist?.id || '')}
                onToggleFollow={handleToggleFollowArtist}
                isLoading={isArtistLoading}
                loadError={artistLoadError}
              />
            )}

            {activeTab === 'album' && selectedAlbumTrack && (
              <AlbumView
                albumTrack={selectedAlbumTrack}
                allTracks={tracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onToggleLike={handleToggleLike}
                onSelectArtist={handleSelectArtist}
                onGoBack={handleGoBack}
                userProfile={userProfile}
                playlists={playlists}
                onAddToQueue={(tr) => setQueue((prev) => [...prev, tr])}
                onAddToPlaylist={handleAddTrackToPlaylist}
                onOpenNewPlaylist={() => setIsNewPlaylistOpen(true)}
                showToast={showToast}
              />
            )}
              </>
            )}
          </div>
        </main>

        {/* Draggable Resizable Splitter Divider for Right Sidebar */}
        {isRightSidebarOpen && (
          <div
            onMouseDown={handleStartResizingRight}
            onTouchStart={handleStartResizingRight}
            onDoubleClick={() => {
              setRightSidebarWidth(320);
              try {
                localStorage.setItem('vertex_right_sidebar_width', '320');
              } catch {
                // ignore
              }
            }}
            title="Drag to resize right sidebar (Double-click to reset)"
            className={`hidden md:flex items-center justify-center w-3 hover:w-3 -mx-1 cursor-col-resize group transition-colors select-none relative z-30 flex-shrink-0 ${
              isResizingRightSidebar ? 'bg-[#A855F7]/30' : 'hover:bg-white/10 bg-transparent'
            }`}
          >
            <div
              className={`w-1 h-12 rounded-full transition-all ${
                isResizingRightSidebar
                  ? 'bg-[#D946EF] opacity-100 shadow-lg scale-110'
                  : 'bg-zinc-600 group-hover:bg-[#A855F7] opacity-60 group-hover:opacity-100'
              }`}
            />
          </div>
        )}

        {/* Collapsible Right Sidebar ('Now Playing View') */}
        {isRightSidebarOpen && (
          <div 
            ref={rightSidebarRef}
            className="hidden lg:flex h-full flex-shrink-0"
            style={{ width: `${rightSidebarWidth}px` }}
          >
            <NowPlayingSidebar
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              artists={artists}
              playlists={playlists}
              userProfile={userProfile}
              allTracks={tracks}
              queue={queue}
              onClose={() => setIsRightSidebarOpen(false)}
              onToggleLike={handleToggleLike}
              onSelectArtist={handleSelectArtist}
              onAddToPlaylist={handleAddTrackToPlaylist}
              onOpenNewPlaylistModal={() => setIsNewPlaylistOpen(true)}
              showToast={showToast}
            />
          </div>
        )}
      </div>

      {/* Mobile Now-Playing Mini Player (Shown on small screens, above the tab dock) */}
      {!isSongScreenOpen && (
        <div className="md:hidden">
          <MiniPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progress={progressFraction}
            onTogglePlay={handleTogglePlay}
            onNext={handleNextTrack}
            onToggleLike={handleToggleLike}
            onOpenSongScreen={() => setIsSongScreenOpen(true)}
          />
        </div>
      )}

      {/* Mobile Bottom Tab Dock (Shown on small screens) */}
      {!isSongScreenOpen && (
        <div className="md:hidden relative z-40">
          <BottomTabBar
            activeTab={activeTab}
            onTabChange={handleSelectTab}
            hasMiniPlayer={!!currentTrack}
          />
        </div>
      )}

      {/* VERTEX Music Persistent Bottom Playback Bar (Desktop / tablet only) */}
      <SpotifyPlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        progress={progressFraction}
        currentTimeSeconds={currentTimeSeconds}
        volume={volume}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onTogglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
        onToggleLike={handleToggleLike}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        onToggleRepeat={() =>
          setRepeatMode(
            repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
          )
        }
        onOpenEQ={() => setIsEQOpen(true)}
        onOpenDeviceSelector={() => setIsDeviceSelectorOpen(true)}
        onOpenSongScreen={() => setIsSongScreenOpen((prev) => !prev)}
        activeDeviceName={activeDeviceName}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={handleToggleRightSidebar}
      />

      {/* Modals */}

      <AudioEQModal
        isOpen={isEQOpen}
        onClose={() => setIsEQOpen(false)}
        eq={eq}
        onUpdateEQ={setEq}
      />

      <NewPlaylistModal
        isOpen={isNewPlaylistOpen}
        onClose={() => setIsNewPlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
      />

      <EditPlaylistModal
        isOpen={isEditPlaylistOpen}
        playlist={playlists.find((p) => p.id === selectedPlaylistId) || null}
        onClose={() => setIsEditPlaylistOpen(false)}
        onSavePlaylist={handleUpdatePlaylist}
      />

      <DeviceSelectorModal
        isOpen={isDeviceSelectorOpen}
        onClose={() => setIsDeviceSelectorOpen(false)}
        activeDevice={activeDeviceName}
        onSelectDevice={setActiveDeviceName}
      />

      <ProfileAndPremiumModal
        isOpen={isProfileModalOpen}
        userProfile={userProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateProfile={handleUpdateUserProfile}
        recentTracks={tracks.slice(0, 5)}
        onPlayTrack={handlePlayTrack}
        onLogout={handleLogout}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <AddTrackModal
        isOpen={isAddTrackOpen}
        onClose={() => setIsAddTrackOpen(false)}
        userId={userProfile?.id}
        userProfileName={userProfile?.artistName || userProfile?.displayName}
        tracks={tracks}
        onTrackAdded={(newTrack) => {
          setTracks((prev) => [newTrack, ...prev]);
          handlePlayTrack(newTrack);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <EditTrackModal
        isOpen={!!editingTrack}
        onClose={() => setEditingTrack(null)}
        track={editingTrack}
        userId={userProfile?.id}
        tracks={tracks}
        onTrackUpdated={(updated) => {
          setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          if (currentTrack?.id === updated.id) {
            setCurrentTrack((prev) => (prev ? { ...prev, ...updated } : null));
          }
          showToast(`Updated "${updated.title}" metadata!`);
        }}
      />

      {/* Global Right-Click Context Menu */}
      <ContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
        playlists={playlists}
        isPlaying={isPlaying}
        currentTrack={currentTrack}
        currentUserId={userProfile?.id}
        onPlayTrack={handlePlayTrack}
        onEditTrack={(tr) => setEditingTrack(tr)}
        onSelectAlbum={handleSelectAlbum}
        onAddToQueue={(tr) => setQueue((prev) => [...prev, tr])}
        onToggleLike={handleToggleLike}
        onAddToPlaylist={handleAddTrackToPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        onSelectPlaylist={handleSelectPlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onOpenEQ={() => setIsEQOpen(true)}
        onOpenAddTrack={() => setIsAddTrackOpen(true)}
        onOpenNewPlaylist={() => setIsNewPlaylistOpen(true)}
        onNavigate={handleSelectTab}
        onOpenProfile={handleOpenProfileModal}
        onOpenChat={() => handleSelectTab('chat')}
        onOpenDeviceSelector={() => setIsDeviceSelectorOpen(true)}
        showToast={showToast}
      />

      {/* Visual Toast Notification Banner */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
