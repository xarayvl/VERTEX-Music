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
import { LibraryView, type LibraryFilter } from './components/Views/LibraryView';
import { ChatView } from './components/Views/ChatView';
import { PlaylistView } from './components/Views/PlaylistView';
import { ProfileView } from './components/Views/ProfileView';
import { ArtistView } from './components/Views/ArtistView';
import { AlbumView } from './components/Views/AlbumView';

import { AudioEQModal } from './components/Modals/AudioEQModal';
import { NewPlaylistModal, NewPlaylistDraft } from './components/Modals/NewPlaylistModal';
import { EditPlaylistModal } from './components/Modals/EditPlaylistModal';
import { DeviceSelectorModal } from './components/Modals/DeviceSelectorModal';
import { ProfileModal } from './components/Modals/ProfileModal';
import { AddTrackModal } from './components/Modals/AddTrackModal';
import { EditTrackModal } from './components/Modals/EditTrackModal';
import { AuthModal } from './components/Modals/AuthModal';
import { SongScreenModal } from './components/Modals/SongScreenModal';
import { ContextMenu, ContextMenuTarget } from './components/ContextMenu';
import { Toast } from './components/Toast';
import { SiteTooltip } from './components/SiteTooltip';
import { NowPlayingSidebar } from './components/Player/NowPlayingSidebar';
import { DEFAULT_AVATAR_URL } from './utils/profilePlaceholders';
import { getReleaseTracksInPlaybackOrder } from './utils/artistUtils';

const LEFT_SIDEBAR_MIN_WIDTH = 96;
const LEFT_SIDEBAR_MAX_WIDTH = 520;
const LEFT_SIDEBAR_COMPACT_THRESHOLD = 200;

const normalizePublicArtist = (raw: any): Artist => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || raw?.artistName || raw?.displayName || raw?.username || ''),
  username: raw?.username ? String(raw.username) : undefined,
  displayName: raw?.displayName ? String(raw.displayName) : undefined,
  avatarUrl: String(raw?.avatarUrl || DEFAULT_AVATAR_URL),
  bannerUrl: raw?.bannerUrl ? String(raw.bannerUrl) : '',
  bio: raw?.artistBio ? String(raw.artistBio) : raw?.bio ? String(raw.bio) : '',
  genre: raw?.genre ? String(raw.genre) : Array.isArray(raw?.favoriteGenres) ? String(raw.favoriteGenres[0] || '') : '',
  totalStreamsLabel: String(raw?.totalStreamsLabel || '0 total streams'),
  verified: raw?.verified === true || raw?.artistVerified === true,
  isUser: true,
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
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('playlists');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // The session token may persist, but the profile itself is always loaded from
  // the server so stale or forged localStorage profile data cannot grant UI ownership.
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Media Data State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [serverDataLoaded, setServerDataLoaded] = useState(false);
  // Prevent a slower background /api/data request from replacing a playlist
  // that was created or edited while that request was still in flight.
  const playlistMutationVersionRef = useRef(0);
  const activePlaylistMutationsRef = useRef(0);
  const backgroundDataRequestInFlightRef = useRef(false);
  const lastBackgroundRefreshAtRef = useRef(0);
  const chatHydratedUserIdRef = useRef<string | null>(null);
  const lastSavedChatHistoryRef = useRef('');
  const pendingPlayTimerRef = useRef<number | null>(null);
  const playRequestsInFlightRef = useRef(new Set<string>());
  const lastPlayRequestAtRef = useRef(new Map<string, number>());
  const preloadedNextTrackIdRef = useRef<string | null>(null);

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

  // Modals & Overlay States
  const [isEQOpen, setIsEQOpen] = useState<boolean>(false);
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState<boolean>(false);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState<boolean>(false);
  const [isEditPlaylistOpen, setIsEditPlaylistOpen] = useState<boolean>(false);
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState<boolean>(false);
  const [isSongScreenOpen, setIsSongScreenOpen] = useState<boolean>(false);

  const openWorkspacePanel = (panel: 'eq' | 'playlist' | 'upload') => {
    setIsEQOpen(panel === 'eq');
    setIsNewPlaylistOpen(panel === 'playlist');
    setIsAddTrackOpen(panel === 'upload');
  };

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | UserProfile | null>(null);
  const [isArtistLoading, setIsArtistLoading] = useState(false);
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null);
  // Captured once on first render so it survives later in-app navigation
  // (which never touches the URL) — used to resolve a shared /track,
  // /playlist, or /artist link into the right screen once data has loaded.
  const initialSharedPathRef = useRef<string>(window.location.pathname);
  const deepLinkResolvedRef = useRef<boolean>(false);
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

  // Recently played is server-authoritative. Keep only records still present after a refresh.
  useEffect(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    setRecentlyPlayed((previous) => previous.map((track) => byId.get(track.id)).filter((track): track is Track => Boolean(track)));
  }, [tracks]);

  // Update the visible list immediately while the play endpoint persists the same order.
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    setRecentlyPlayed((previous) => [currentTrack, ...previous.filter((track) => track.id !== currentTrack.id)].slice(0, 50));
  }, [isPlaying, currentTrack?.id]);

  // Resizable Sidebar Panel Width State (Persisted in localStorage with min/max constraints)
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vertex_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.min(LEFT_SIDEBAR_MAX_WIDTH, Math.max(LEFT_SIDEBAR_MIN_WIDTH, parsed));
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
      const newWidth = Math.min(LEFT_SIDEBAR_MAX_WIDTH, Math.max(LEFT_SIDEBAR_MIN_WIDTH, clientX - leftOffset));
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

  // Keeps the latest sidebar layout available to the window-resize handler
  // below without re-subscribing that listener on every drag.
  const sidebarLayoutRef = useRef({ sidebarWidth, rightSidebarWidth, isRightSidebarOpen });
  useEffect(() => {
    sidebarLayoutRef.current = { sidebarWidth, rightSidebarWidth, isRightSidebarOpen };
  });

  // Re-clamp both resizable sidebars whenever the browser window itself is
  // resized. Sidebar widths are dragged (up to 520px / 450px) and cached in
  // localStorage, so without this, a width saved on a wide monitor stayed
  // fixed after shrinking the window — squeezing the main content area
  // into a sliver (or negative space) and making the whole layout look
  // broken instead of scaling down cleanly like the rest of the app.
  useEffect(() => {
    const MIN_MAIN_CONTENT = 360;

    const clampToViewport = () => {
      if (window.innerWidth < 768) return; // sidebars are hidden below md anyway
      const { sidebarWidth: left, rightSidebarWidth: right, isRightSidebarOpen: rightOpen } =
        sidebarLayoutRef.current;
      const rightBudget = rightOpen ? right : 0;
      const available = window.innerWidth - MIN_MAIN_CONTENT;
      if (left + rightBudget <= available) return; // plenty of room, nothing to do

      const nextLeft = Math.max(LEFT_SIDEBAR_MIN_WIDTH, Math.min(left, available - (rightOpen ? 280 : 0)));
      const nextRight = rightOpen ? Math.max(280, Math.min(right, available - nextLeft)) : right;

      if (nextLeft !== left) {
        setSidebarWidth(nextLeft);
        try {
          localStorage.setItem('vertex_sidebar_width', nextLeft.toString());
        } catch {
          // ignore storage access errors
        }
      }
      if (rightOpen && nextRight !== right) {
        setRightSidebarWidth(nextRight);
        try {
          localStorage.setItem('vertex_right_sidebar_width', nextRight.toString());
        } catch {
          // ignore storage access errors
        }
      }
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, []);

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

    // Long-press gestures fire `contextmenu` on phones and tablets. Keep the
    // custom menu exclusive to pointer devices where it is opened by a real
    // desktop right-click.
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      setContextMenuTarget(null);
      return;
    }

    const targetElement = e.target as HTMLElement | null;
    if (!targetElement) return;

    // Resolve the nearest tagged entity in one pass. The old track-first
    // checks incorrectly opened a song menu when right-clicking an artist
    // name nested inside a track card, because the outer track ancestor was
    // found before the closer artist element.
    const entityElem = targetElement.closest(
      '[data-track-id], [data-playlist-id], [data-artist-id]'
    ) as HTMLElement | null;
    if (entityElem) {
      const trackId = entityElem.getAttribute('data-track-id');
      const playlistId = entityElem.getAttribute('data-playlist-id');
      const artistId = entityElem.getAttribute('data-artist-id');

      if (trackId) {
        const foundTrack = tracks.find((track) => track.id === trackId);
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
      } else if (playlistId) {
        const foundPlaylist = playlists.find((playlist) => playlist.id === playlistId);
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
      } else if (artistId) {
        const foundArtist = artists.find((artist) => artist.id === artistId);
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
    if (serverDataLoaded && !userProfile) {
      setIsAuthModalOpen(true);
    }
  }, [serverDataLoaded, userProfile]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('vertex_session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Clear account-scoped state while the server fetches a newly active account.
  // When /api/data has already hydrated this exact account, keep the freshly
  // restored history instead of clearing it in the user-id effect that follows.
  useEffect(() => {
    const activeUserWasHydrated = Boolean(
      userProfile?.id && chatHydratedUserIdRef.current === userProfile.id
    );
    if (!activeUserWasHydrated) {
      setFollowedArtistIds([]);
      setRecentlyPlayed([]);
    }
    setSelectedArtist(null);
    setIsArtistLoading(false);
    setArtistLoadError(null);
  }, [userProfile?.id]);

  // Hydrate any followed artist that isn't already in the local `artists`
  // cache. `followedArtistIds` is restored from the authenticated server state,
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
    if (!includeChatAndUser && backgroundDataRequestInFlightRef.current) return;
    if (!includeChatAndUser) backgroundDataRequestInFlightRef.current = true;
    const playlistVersionAtRequestStart = playlistMutationVersionRef.current;
    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(includeChatAndUser ? '/api/data' : '/api/data?scope=shared', { headers });
      if (res.ok) {
        const data = await res.json();
        const serverTracks: Track[] = Array.isArray(data.tracks) ? data.tracks : [];
        if (includeChatAndUser) {
          const likedIds: string[] = Array.isArray(data.likedTrackIds) ? data.likedTrackIds : [];
          setTracks(serverTracks.map((track) => ({ ...track, isLiked: likedIds.includes(track.id) })));
        } else {
          setTracks((previous) => {
            const likedById = new Map(previous.map((track) => [track.id, track.isLiked]));
            return serverTracks.map((track) => ({ ...track, isLiked: likedById.get(track.id) || false }));
          });
        }
        if (
          activePlaylistMutationsRef.current === 0 &&
          playlistMutationVersionRef.current === playlistVersionAtRequestStart
        ) {
          setPlaylists(Array.isArray(data.playlists) ? data.playlists : []);
        }
        setArtists(Array.isArray(data.artists) ? data.artists.map(normalizePublicArtist).filter((artist: Artist) => artist.id && artist.name) : []);
        if (includeChatAndUser) {
          const recentIds: string[] = Array.isArray(data.recentTrackIds) ? data.recentTrackIds : [];
          const trackById = new Map(serverTracks.map((track) => [track.id, track]));
          setFollowedArtistIds(Array.isArray(data.followedArtistIds) ? data.followedArtistIds : []);
          setRecentlyPlayed(recentIds.map((id) => trackById.get(id)).filter((track): track is Track => Boolean(track)));
          const serverChatHistory = Array.isArray(data.chatHistory) ? data.chatHistory : [];
          const hydratedUserId = data.user?.id || null;
          chatHydratedUserIdRef.current = hydratedUserId;
          lastSavedChatHistoryRef.current = JSON.stringify(serverChatHistory);
          setChatMessages(serverChatHistory);
          if (data.user) {
            setUserProfile((previous) => (previous ? { ...previous, ...data.user } : data.user));
          } else if (token) {
            localStorage.removeItem('vertex_session_token');
            setUserProfile(null);
            setIsAuthModalOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing server data:', err);
    } finally {
      if (!includeChatAndUser) {
        backgroundDataRequestInFlightRef.current = false;
      }
      lastBackgroundRefreshAtRef.current = Date.now();
      setServerDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.id && chatHydratedUserIdRef.current === userProfile.id) return;
    fetchServerData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  // Keep the shared tracks/playlists lists live: poll periodically and refetch whenever
  // the tab regains focus, so songs another user uploads show up here without needing
  // a full page reload or re-login.
  useEffect(() => {
    const POLL_INTERVAL_MS = 60000;
    const FOCUS_REFRESH_COOLDOWN_MS = 15000;
    const refreshSharedData = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastBackgroundRefreshAtRef.current < FOCUS_REFRESH_COOLDOWN_MS) return;
      void fetchServerData(false);
    };
    const intervalId = window.setInterval(() => {
      refreshSharedData();
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', refreshSharedData);
    document.addEventListener('visibilitychange', refreshSharedData);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSharedData);
      document.removeEventListener('visibilitychange', refreshSharedData);
    };
  }, [fetchServerData]);

  const handleLogout = () => {
    const token = localStorage.getItem('vertex_session_token');
    if (token) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
    audioEngine.pause();
    if (pendingPlayTimerRef.current !== null) {
      window.clearTimeout(pendingPlayTimerRef.current);
      pendingPlayTimerRef.current = null;
    }
    playRequestsInFlightRef.current.clear();
    lastPlayRequestAtRef.current.clear();
    setIsPlaying(false);
    setCurrentTrack(null);
    chatHydratedUserIdRef.current = null;
    lastSavedChatHistoryRef.current = '';
    setUserProfile(null);
    setFollowedArtistIds([]);
    setRecentlyPlayed([]);
    setTracks((prev) => prev.map((t) => ({ ...t, isLiked: false })));
    setChatMessages([]);
    try {
      localStorage.removeItem('vertex_session_token');
      localStorage.removeItem('vertex_music_chat_history');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('vertex_music_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error clearing localStorage on logout:', e);
    }
    setIsAuthModalOpen(true);
  };

  // Fires when the server rejects a request because the session token is
  // missing/expired/unknown. This clears the client-side session state,
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
    chatHydratedUserIdRef.current = null;
    lastSavedChatHistoryRef.current = '';
    setUserProfile(user);
    if (token) {
      localStorage.setItem('vertex_session_token', token);
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!userProfile?.id || chatHydratedUserIdRef.current !== userProfile.id) return;
    const serializedHistory = JSON.stringify(chatMessages);
    if (serializedHistory === lastSavedChatHistoryRef.current) return;

    const saveTimer = window.setTimeout(() => {
      fetch(`/api/chat-history/${userProfile.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ chatHistory: chatMessages }),
      })
        .then((response) => {
          if (response.ok) lastSavedChatHistoryRef.current = serializedHistory;
        })
        .catch((e) => console.error('Error syncing chat history with server:', e));
    }, 1200);

    return () => window.clearTimeout(saveTimer);
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
    currentTimeSeconds,
    handleNextTrack: () => {},
    handleTrackEnded: () => {},
    handlePrevTrack: () => {},
    handleTogglePlay: () => {},
    handleToggleLike: (_trackId: string) => {},
    handleSelectTab: (_tab: TabType) => {},
  });

  // Remembers the volume level from just before a keyboard "Mute" (M) so
  // it can be restored on unmute, without needing volume in the effect's
  // dependency array.
  const prevVolumeRef = useRef(volume);

  // Handle Navigation Tab Switch
  const handleSelectTab = (tab: TabType) => {
    setIsSongScreenOpen(false);
    if (tab === activeTab) return;
    const newHistory = navHistory.slice(0, historyIndex + 1);
    newHistory.push(tab);
    setNavHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleOpenLibrary = (filter: LibraryFilter) => {
    setLibraryFilter(filter);
    handleSelectTab('library');
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
      playbackRef.current.handleTrackEnded();
    });

    audioEngine.setOnPlaybackStateChange((playing) => {
      setIsPlaying(playing);
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
            if (currentTrack && prev + 1 >= currentTrack.duration) {
              window.setTimeout(() => playbackRef.current.handleTrackEnded(), 0);
              return currentTrack.duration;
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

  // Persist only the last track selected during a burst of quick skips. A
  // per-listener cooldown also prevents duplicate effects from sending the
  // same play repeatedly while the server retains its own rate limit.
  const recordTrackPlay = (track: Track) => {
    if (pendingPlayTimerRef.current !== null) {
      window.clearTimeout(pendingPlayTimerRef.current);
    }

    const listenerKey = `${userProfile?.id || 'anonymous'}:${track.id}`;
    pendingPlayTimerRef.current = window.setTimeout(() => {
      pendingPlayTimerRef.current = null;
      const now = Date.now();
      const previousRequestAt = lastPlayRequestAtRef.current.get(listenerKey) || 0;
      if (playRequestsInFlightRef.current.has(listenerKey) || now - previousRequestAt < 30_000) return;

      playRequestsInFlightRef.current.add(listenerKey);
      lastPlayRequestAtRef.current.set(listenerKey, now);
      fetch(`/api/tracks/${track.id}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      })
      .then(async (response) => {
        if (response.status === 404) {
          setTracks((items) => items.filter((item) => item.id !== track.id));
          setRecentlyPlayed((items) => items.filter((item) => item.id !== track.id));
          setQueue((items) => items.filter((item) => item.id !== track.id));
          setCurrentTrack((current) => {
            if (current?.id === track.id) {
              setIsPlaying(false);
              return null;
            }
            return current;
          });
          showToast('This track no longer exists.');
          return;
        }
        if (!response.ok) throw new Error(`Play request failed (${response.status})`);
        const data = await response.json();
        setTracks((items) => items.map((item) => item.id === track.id ? { ...item, plays: String(data.plays || item.plays || '0') } : item));
        if (!data.deduplicated) {
          setUserProfile((profile) => profile ? {
            ...profile,
            stats: {
              ...(profile.stats || {
                hoursListened: 0,
                secondsListened: 0,
                tracksPlayed: 0,
                topGenre: 'N/A',
                playlistsCreated: 0,
              }),
              tracksPlayed: (profile.stats?.tracksPlayed || 0) + 1,
            },
          } : null);
        }
      })
      .catch((error) => {
        if (lastPlayRequestAtRef.current.get(listenerKey) === now) {
          lastPlayRequestAtRef.current.delete(listenerKey);
        }
        console.error('Failed to persist track play:', error);
      })
      .finally(() => {
        playRequestsInFlightRef.current.delete(listenerKey);
      });
    }, 900);
  };

  useEffect(() => () => {
    if (pendingPlayTimerRef.current !== null) {
      window.clearTimeout(pendingPlayTimerRef.current);
    }
  }, []);

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
      }, 60000);
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

  const handlePlayTrack = (track: Track, playbackContext?: Track[]) => {
    if (playbackContext && playbackContext.length > 0) {
      // Preserve the exact order of the album/playlist view that initiated
      // playback. Without this, automatic advance falls back to a stale queue
      // or the global catalogue and can appear to move backwards in an album.
      setQueue(playbackContext);
    } else if (queue.length > 0 && !queue.some((queuedTrack) => queuedTrack.id === track.id)) {
      // A track opened from another screen must not inherit an unrelated,
      // stale queue left behind by an earlier album or playlist.
      setQueue([]);
    }
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(track);
    }
  };

  // The artist-page shuffle control only changes playback order. It must not
  // interrupt, restart, or replace the track that is currently playing.
  const handleToggleShuffleForTracks = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    setQueue(trackList);
    setIsShuffle((enabled) => !enabled);
  };

  const resolveActivePlaybackContext = () => {
    if (!currentTrack) {
      const activeList = queue.length > 0 ? queue : tracks;
      return { activeList, currentIndex: -1 };
    }

    const queueIndex = queue.findIndex((track) => track.id === currentTrack.id);
    if (queueIndex >= 0) return { activeList: queue, currentIndex: queueIndex };

    return {
      activeList: tracks,
      currentIndex: tracks.findIndex((track) => track.id === currentTrack.id),
    };
  };

  // Keep the exact next song warm while the current one is playing. The audio
  // engine retains the prepared HTMLAudioElement (and its native byte-range
  // buffer), so the transition does not need to assign and reload the URL.
  // For shuffle, remember the selected candidate so Next consumes the same
  // track that was prebuffered instead of rolling a second random choice.
  useEffect(() => {
    if (!isPlaying || !currentTrack || repeatMode === 'one') {
      preloadedNextTrackIdRef.current = null;
      return;
    }

    const { activeList, currentIndex } = resolveActivePlaybackContext();
    if (activeList.length === 0) {
      preloadedNextTrackIdRef.current = null;
      return;
    }

    let nextTrack: Track | undefined;
    if (isShuffle) {
      const candidates = activeList.filter((track) => track.id !== currentTrack.id);
      const preparedCandidate = candidates.find((track) => track.id === preloadedNextTrackIdRef.current);
      nextTrack = preparedCandidate || candidates[Math.floor(Math.random() * candidates.length)];
      if (!nextTrack && repeatMode === 'all') nextTrack = currentTrack;
    } else {
      let nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      if (nextIndex >= activeList.length) {
        nextIndex = repeatMode === 'all' ? 0 : -1;
      }
      if (nextIndex >= 0) nextTrack = activeList[nextIndex];
    }

    preloadedNextTrackIdRef.current = nextTrack?.id || null;
    if (nextTrack && nextTrack.id !== currentTrack.id) {
      audioEngine.preloadTrack(nextTrack);
    }
  }, [isPlaying, currentTrack?.id, currentTrack?.audioUrl, queue, tracks, isShuffle, repeatMode]);

  const handleNextTrack = () => {
    const { activeList, currentIndex } = resolveActivePlaybackContext();
    if (activeList.length === 0) return;

    let nextIdx = currentIndex >= 0 ? currentIndex + 1 : 0;
    if (isShuffle) {
      const preparedIndex = activeList.findIndex((track) => track.id === preloadedNextTrackIdRef.current);
      if (preparedIndex >= 0 && (preparedIndex !== currentIndex || activeList.length === 1)) {
        nextIdx = preparedIndex;
      } else {
        const candidateIndexes = activeList
          .map((_, index) => index)
          .filter((index) => index !== currentIndex);
        nextIdx = candidateIndexes.length > 0
          ? candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)]
          : currentIndex;
      }
    }
    if (nextIdx >= activeList.length || nextIdx < 0) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        // With repeat disabled the queue has genuinely finished. Repeat-one
        // only affects natural completion; pressing Next still advances.
        setCurrentTimeSeconds(currentTrack?.duration || 0);
        setIsPlaying(false);
        return;
      }
    }
    if (activeList[nextIdx]) {
      setCurrentTrack(activeList[nextIdx]);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(activeList[nextIdx]);
    }
  };

  const handleTrackEnded = () => {
    if (repeatMode === 'one' && currentTrack) {
      // Natural completion in repeat-one mode restarts the same media from
      // zero. Manual Next intentionally remains free to advance.
      audioEngine.playTrack(currentTrack, 0);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      recordTrackPlay(currentTrack);
      return;
    }

    handleNextTrack();
  };

  const handlePrevTrack = () => {
    const { activeList, currentIndex } = resolveActivePlaybackContext();
    if (activeList.length === 0) return;
    let prevIdx = currentIndex >= 0 ? currentIndex - 1 : 0;
    if (prevIdx < 0) {
      if (repeatMode === 'all') {
        prevIdx = activeList.length - 1;
      } else {
        // At the beginning of a non-looping context, Previous restarts/stays
        // on the first song instead of wrapping forward to the final song.
        if (currentTrack) audioEngine.playTrack(currentTrack, 0);
        setCurrentTimeSeconds(0);
        setIsPlaying(Boolean(currentTrack));
        return;
      }
    }
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
      currentTimeSeconds,
      handleNextTrack,
      handleTrackEnded,
      handlePrevTrack,
      handleTogglePlay,
      handleToggleLike,
      handleSelectTab,
    };
  });

  const handleSeek = (fraction: number) => {
    if (!currentTrack) return;
    const newSeconds = Math.floor(fraction * currentTrack.duration);
    setCurrentTimeSeconds(newSeconds);
    audioEngine.seek(newSeconds, currentTrack);
  };

  const handleToggleLike = async (trackId: string) => {
    const target = tracks.find((track) => track.id === trackId);
    if (!target) return showToast('404 — Track not found.');
    if (!userProfile) return showToast('Sign in to save tracks.');

    const previousTracks = tracks;
    const previousCurrentTrack = currentTrack;
    const nextTracks = tracks.map((track) =>
      track.id === trackId ? { ...track, isLiked: !track.isLiked } : track
    );
    const nextCurrentTrack = currentTrack?.id === trackId
      ? { ...currentTrack, isLiked: !currentTrack.isLiked }
      : currentTrack;

    setTracks(nextTracks);
    setCurrentTrack(nextCurrentTrack);

    try {
      const likedTrackIds = nextTracks.filter((track) => track.isLiked).map((track) => track.id);
      const response = await fetch(`/api/user-state/${userProfile.id}/liked-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ likedTrackIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setTracks(previousTracks);
        setCurrentTrack(previousCurrentTrack);
        showToast(data?.error || 'Could not update liked tracks.');
      }
    } catch (error) {
      console.error('Error syncing liked tracks:', error);
      setTracks(previousTracks);
      setCurrentTrack(previousCurrentTrack);
      showToast('Could not update liked tracks.');
    }
  };

  const handleSetReleaseLiked = async (trackIds: string[], shouldLike: boolean): Promise<boolean> => {
    const uniqueIds = new Set(trackIds.filter(Boolean));
    if (uniqueIds.size === 0 || !tracks.some((track) => uniqueIds.has(track.id))) {
      showToast('404 — Release tracks not found.');
      return false;
    }
    if (!userProfile) {
      showToast('Sign in to save tracks.');
      return false;
    }

    const previousTracks = tracks;
    const previousCurrentTrack = currentTrack;
    const nextTracks = tracks.map((track) => uniqueIds.has(track.id) ? { ...track, isLiked: shouldLike } : track);
    const nextCurrentTrack = currentTrack && uniqueIds.has(currentTrack.id)
      ? { ...currentTrack, isLiked: shouldLike }
      : currentTrack;

    setTracks(nextTracks);
    setCurrentTrack(nextCurrentTrack);

    try {
      const likedTrackIds = nextTracks.filter((track) => track.isLiked).map((track) => track.id);
      const response = await fetch(`/api/user-state/${userProfile.id}/liked-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ likedTrackIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setTracks(previousTracks);
        setCurrentTrack(previousCurrentTrack);
        showToast(data?.error || 'Could not update liked tracks.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error syncing release liked tracks:', error);
      setTracks(previousTracks);
      setCurrentTrack(previousCurrentTrack);
      showToast('Could not update liked tracks.');
      return false;
    }
  };

  // Spotify-style desktop keyboard shortcuts. Mounted once and reads
  // everything it needs from playbackRef (kept fresh above) so it never
  // sees stale state without having to re-subscribe on every keystroke.
  //   Space              Play / Pause
  //   ←  /  →            Seek -5s / +5s
  //   Ctrl/Cmd + ←  /  → Previous / Next track
  //   ↑  /  ↓            Volume up / down
  //   M                  Mute / unmute
  //   L                  Like / unlike current track
  //   Ctrl/Cmd + K       Jump to Search
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // Ctrl/Cmd combos first, before the plain-key switch below.
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        playbackRef.current.handleNextTrack();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        playbackRef.current.handlePrevTrack();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        playbackRef.current.handleSelectTab('search');
        return;
      }
      // Don't hijack any other browser/OS shortcut combos.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          e.preventDefault();
          playbackRef.current.handleTogglePlay();
          break;
        }
        case 'ArrowRight': {
          const track = playbackRef.current.currentTrack;
          if (!track) break;
          e.preventDefault();
          const nextSeconds = Math.min(track.duration || 0, playbackRef.current.currentTimeSeconds + 5);
          setCurrentTimeSeconds(nextSeconds);
          audioEngine.seek(nextSeconds, track);
          break;
        }
        case 'ArrowLeft': {
          const track = playbackRef.current.currentTrack;
          if (!track) break;
          e.preventDefault();
          const nextSeconds = Math.max(0, playbackRef.current.currentTimeSeconds - 5);
          setCurrentTimeSeconds(nextSeconds);
          audioEngine.seek(nextSeconds, track);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setVolume((v) => Math.min(1, Math.round((v + 0.05) * 100) / 100));
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          setVolume((v) => Math.max(0, Math.round((v - 0.05) * 100) / 100));
          break;
        }
        case 'm':
        case 'M': {
          e.preventDefault();
          setVolume((v) => {
            if (v > 0) {
              prevVolumeRef.current = v;
              return 0;
            }
            return prevVolumeRef.current || 0.7;
          });
          break;
        }
        case 'l':
        case 'L': {
          const track = playbackRef.current.currentTrack;
          if (!track) break;
          e.preventDefault();
          playbackRef.current.handleToggleLike(track.id);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePlayPlaylist = (playlist: Playlist) => {
    const playlistTracks = playlist.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId))
      .filter((track): track is Track => Boolean(track));
    if (playlistTracks.length > 0) {
      handlePlayTrack(playlistTracks[0], playlistTracks);
    }
  };

  const handleShufflePlaylist = (playlistTracks: Track[]) => {
    if (playlistTracks.length === 0) return;
    if (isShuffle && currentTrack && playlistTracks.some((track) => track.id === currentTrack.id)) {
      setQueue(playlistTracks);
      setIsShuffle(false);
      return;
    }
    const shuffledTracks = [...playlistTracks];
    for (let index = shuffledTracks.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledTracks[index], shuffledTracks[swapIndex]] = [shuffledTracks[swapIndex], shuffledTracks[index]];
    }
    setIsShuffle(true);
    handlePlayTrack(shuffledTracks[0], shuffledTracks);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylistId(playlist.id);
    handleSelectTab('playlist');
  };

  const handleUpdatePlaylist = async (updatedPlaylist: Playlist): Promise<boolean> => {
    const existing = playlists.find((playlist) => playlist.id === updatedPlaylist.id);
    if (!existing) {
      showToast('404 — Playlist not found.');
      return false;
    }
    if (!userProfile || existing.userId !== userProfile.id) {
      showToast('Only the playlist owner can edit it.');
      return false;
    }

    activePlaylistMutationsRef.current += 1;
    try {
      const response = await fetch(`/api/playlists/${updatedPlaylist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          title: updatedPlaylist.title,
          description: updatedPlaylist.description,
          coverUrl: updatedPlaylist.coverUrl,
          trackIds: updatedPlaylist.trackIds,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.playlist) {
        showToast(data?.error || 'Playlist update failed.');
        return false;
      }
      setPlaylists((previous) => previous.map((playlist) => (playlist.id === data.playlist.id ? data.playlist : playlist)));
      showToast('Playlist updated.');
      return true;
    } catch (error) {
      console.error('Error updating playlist:', error);
      showToast('Playlist update failed.');
      return false;
    } finally {
      activePlaylistMutationsRef.current = Math.max(0, activePlaylistMutationsRef.current - 1);
      playlistMutationVersionRef.current += 1;
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    const target = playlists.find((playlist) => playlist.id === playlistId);
    if (!target) return showToast('404 — Playlist not found.');
    if (!userProfile || target.userId !== userProfile.id) return showToast('Only the playlist owner can delete it.');

    activePlaylistMutationsRef.current += 1;
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await response.json().catch(() => null);
      if (!response.ok) return showToast(data?.error || 'Playlist delete failed.');
      setPlaylists((previous) => previous.filter((playlist) => playlist.id !== playlistId));
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(null);
        handleGoBack();
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
      showToast('Playlist delete failed.');
    } finally {
      activePlaylistMutationsRef.current = Math.max(0, activePlaylistMutationsRef.current - 1);
      playlistMutationVersionRef.current += 1;
    }
  };

  const updatePlaylistTracks = async (playlistId: string, nextTrackIds: string[]): Promise<Playlist | null> => {
    const target = playlists.find((playlist) => playlist.id === playlistId);
    if (!target) {
      showToast('404 — Playlist not found.');
      return null;
    }
    if (!userProfile || target.userId !== userProfile.id) {
      showToast('Only the playlist owner can change its tracks.');
      return null;
    }

    activePlaylistMutationsRef.current += 1;
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ trackIds: nextTrackIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.playlist) {
        showToast(data?.error || 'Playlist update failed.');
        return null;
      }
      setPlaylists((previous) => previous.map((playlist) => (playlist.id === playlistId ? data.playlist : playlist)));
      return data.playlist;
    } catch (error) {
      console.error('Error changing playlist tracks:', error);
      showToast('Playlist update failed.');
      return null;
    } finally {
      activePlaylistMutationsRef.current = Math.max(0, activePlaylistMutationsRef.current - 1);
      playlistMutationVersionRef.current += 1;
    }
  };

  const handleAddTracksToPlaylist = async (playlistId: string, trackIds: string[]): Promise<boolean> => {
    const target = playlists.find((playlist) => playlist.id === playlistId);
    if (!target) {
      showToast('404 — Playlist not found.');
      return false;
    }
    const uniqueTrackIds = [...new Set(trackIds)];
    if (uniqueTrackIds.some((trackId) => !tracks.some((track) => track.id === trackId))) {
      showToast('404 — One or more tracks were not found.');
      return false;
    }
    const nextTrackIds = [...new Set([...target.trackIds, ...uniqueTrackIds])];
    if (nextTrackIds.length === target.trackIds.length) return true;
    return Boolean(await updatePlaylistTracks(playlistId, nextTrackIds));
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => handleAddTracksToPlaylist(playlistId, [trackId]);

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackId: string): Promise<boolean> => {
    const target = playlists.find((playlist) => playlist.id === playlistId);
    if (!target) {
      showToast('404 — Playlist not found.');
      return false;
    }
    return Boolean(await updatePlaylistTracks(playlistId, target.trackIds.filter((id) => id !== trackId)));
  };

  const handleCreatePlaylist = async (draft: NewPlaylistDraft) => {
    if (!userProfile) return showToast('Sign in to create a playlist.');
    activePlaylistMutationsRef.current += 1;
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          coverUrl: draft.coverUrl,
          trackIds: draft.trackIds,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.playlist) return showToast(data?.error || 'Playlist creation failed.');
      const createdPlaylist: Playlist = {
        ...data.playlist,
        userId: String(data.playlist.userId || userProfile.id),
        trackIds: Array.isArray(data.playlist.trackIds) ? data.playlist.trackIds : [],
        trackCount: Number(data.playlist.trackCount) || 0,
      };
      setPlaylists((previous) => [createdPlaylist, ...previous.filter((playlist) => playlist.id !== createdPlaylist.id)]);
      setSelectedPlaylistId(createdPlaylist.id);
      handleSelectTab('playlist');
      showToast(`Created "${createdPlaylist.title}" and added it to Your Library.`);
    } catch (error) {
      console.error('Error creating playlist:', error);
      showToast('Playlist creation failed.');
    } finally {
      activePlaylistMutationsRef.current = Math.max(0, activePlaylistMutationsRef.current - 1);
      playlistMutationVersionRef.current += 1;
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
      if (!id) return null;
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

  const handleSelectArtist = async (input: Artist | UserProfile | string) => {
    const requestId = ++artistRequestIdRef.current;
    handleSelectTab('artist');
    setSelectedArtist(null);
    setArtistLoadError(null);
    setIsArtistLoading(true);

    const requestedId = (typeof input === 'string' ? input : input.id).trim();
    const requestedLabel = typeof input === 'string'
      ? input.trim()
      : 'email' in input
        ? input.artistName || input.displayName || input.username
        : input.name;

    if (!requestedId) {
      setArtistLoadError('404 — Artist not found.');
      setIsArtistLoading(false);
      return;
    }

    if (userProfile?.id === requestedId) {
      setSelectedArtist(userProfile);
      setIsArtistLoading(false);
      return;
    }

    // Artist identity is immutable and server-owned. Display names, usernames,
    // and track labels are presentation data and must never be used as an
    // ownership fallback. Legacy name-only links therefore resolve to 404.
    const resolved = await resolveArtistByIdFromServer(requestedId);

    if (requestId !== artistRequestIdRef.current) return;
    if (!resolved) {
      setSelectedArtist(null);
      setArtistLoadError(`404 — No registered artist profile was found for “${requestedLabel || 'this artist'}”.`);
      setIsArtistLoading(false);
      return;
    }

    setSelectedArtist(resolved);
    setArtistLoadError(null);
    setIsArtistLoading(false);
  };

  // Resolve a shared link (Copy Song/Playlist/Artist Link) into the right
  // screen. Runs once tracks/playlists have loaded from the server; until
  // then a shared URL like /track/<id> would otherwise just fall through to
  // the normal empty-path home screen since this app has no router.
  useEffect(() => {
    if (deepLinkResolvedRef.current) return;
    const path = initialSharedPathRef.current;

    const trackMatch = path.match(/^\/track\/([^/?#]+)/);
    const playlistMatch = path.match(/^\/playlist\/([^/?#]+)/);
    const artistMatch = path.match(/^\/artist\/([^/?#]+)/);

    if (!trackMatch && !playlistMatch && !artistMatch) {
      deepLinkResolvedRef.current = true;
      return;
    }

    if (trackMatch) {
      if (!serverDataLoaded) return;
      deepLinkResolvedRef.current = true;
      const track = tracks.find((t) => t.id === trackMatch[1]);
      if (track) {
        handlePlayTrack(track);
        setIsSongScreenOpen(true);
      } else {
        showToast('That song link is invalid or the track was removed.');
      }
      window.history.replaceState({}, '', '/');
    } else if (playlistMatch) {
      if (!serverDataLoaded) return;
      deepLinkResolvedRef.current = true;
      const playlist = playlists.find((p) => p.id === playlistMatch[1]);
      if (playlist) {
        handleSelectPlaylist(playlist);
      } else {
        showToast('That playlist link is invalid or was removed.');
      }
      window.history.replaceState({}, '', '/');
    } else if (artistMatch) {
      deepLinkResolvedRef.current = true;
      handleSelectArtist(artistMatch[1]);
      window.history.replaceState({}, '', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, playlists, serverDataLoaded]);

  const handleSelectAlbum = (track: Track) => {
    setSelectedAlbumTrack(track);
    const releaseTracks = getReleaseTracksInPlaybackOrder(track, tracks);
    if (currentTrack && releaseTracks.some((releaseTrack) => releaseTrack.id === currentTrack.id)) {
      // Opening the release for the song that is already playing should make
      // both players immediately follow that visible album order.
      setQueue(releaseTracks);
    }
    handleSelectTab('album');
  };

  // Resolve the current track's real owner by immutable userId only.
  useEffect(() => {
    if (!currentTrack?.userId) return;
    if (currentTrack.userId === userProfile?.id || artists.some((artist) => artist.id === currentTrack.userId)) return;
    void resolveArtistByIdFromServer(currentTrack.userId);
  }, [currentTrack?.userId, artists, userProfile?.id, resolveArtistByIdFromServer]);

  const handleDeleteTrack = async (trackId: string) => {
    const target = tracks.find((track) => track.id === trackId);
    if (!target) return showToast('404 — Track not found.');
    if (!userProfile || target.userId !== userProfile.id) {
      return showToast('Only the track owner can delete it.');
    }

    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE', headers: getAuthHeaders() });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.success === false) {
        showToast(payload?.error || 'Failed to delete track.');
        return;
      }

      setTracks((previous) => previous.filter((track) => track.id !== trackId));
      setQueue((previous) => previous.filter((track) => track.id !== trackId));
      setPlaylists((previous) => previous.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
        trackCount: playlist.trackIds.filter((id) => id !== trackId).length,
      })));
      setRecentlyPlayed((previous) => previous.filter((track) => track.id !== trackId));
      if (currentTrack?.id === trackId) {
        audioEngine.pause();
        setIsPlaying(false);
        setCurrentTrack(null);
      }
      showToast('Track deleted.');
    } catch (error) {
      console.error('Error deleting track:', error);
      showToast('Failed to delete track. Please check your connection.');
    }
  };

  const handleWipeAllTracks = async () => {
    if (!userProfile) return showToast('Sign in first.');
    try {
      const response = await fetch('/api/tracks/wipe', { method: 'POST', headers: getAuthHeaders() });
      const data = await response.json().catch(() => null);
      if (!response.ok) return showToast(data?.error || 'Track cleanup failed.');
      const deletedIds = new Set<string>(Array.isArray(data?.deletedTrackIds) ? data.deletedTrackIds : []);
      setTracks((previous) => previous.filter((track) => !deletedIds.has(track.id)));
      setQueue((previous) => previous.filter((track) => !deletedIds.has(track.id)));
      setPlaylists((previous) => previous.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((trackId) => !deletedIds.has(trackId)),
        trackCount: playlist.trackIds.filter((trackId) => !deletedIds.has(trackId)).length,
      })));
      if (currentTrack && deletedIds.has(currentTrack.id)) {
        audioEngine.pause();
        setIsPlaying(false);
        setCurrentTrack(null);
      }
      showToast(`${deletedIds.size} owned track removed.`);
    } catch (error) {
      console.error('Error wiping owned tracks:', error);
      showToast('Track cleanup failed.');
    }
  };

  const handleToggleFollowArtist = async (artistToToggle: Artist | UserProfile) => {
    const target = normalizePublicArtist(artistToToggle);
    if (!userProfile || !target.id || target.id === userProfile.id) return;
    const action = followedArtistIds.includes(target.id) ? 'unfollow' : 'follow';

    try {
      const response = await fetch(`/api/users/${target.id}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) return showToast(data?.error || 'Follow action failed.');

      setFollowedArtistIds(Array.isArray(data.followedArtistIds) ? data.followedArtistIds : []);
      setUserProfile((previous) => previous ? {
        ...previous,
        stats: { ...previous.stats, followingCount: Number(data.followingCount) || 0 },
      } : previous);
      const confirmed: Artist = {
        ...target,
        stats: {
          hoursListened: target.stats?.hoursListened || 0,
          secondsListened: target.stats?.secondsListened || 0,
          tracksPlayed: target.stats?.tracksPlayed || 0,
          topGenre: target.stats?.topGenre || 'N/A',
          playlistsCreated: target.stats?.playlistsCreated || 0,
          followingCount: target.stats?.followingCount || 0,
          followersCount: Number(data.followersCount) || 0,
        },
      };
      upsertArtist(confirmed);
      setSelectedArtist((current) => current?.id === target.id ? { ...current, stats: confirmed.stats! } : current);
    } catch (error) {
      console.error('Error updating follow relation:', error);
      showToast('Follow action failed.');
    }
  };

  const handleUpdateArtist = async (updatedData: {
    artistName: string;
    artistBio: string;
    avatarUrl: string;
    bannerUrl: string;
    genre: string;
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
      instagramUrl: updatedData.instagramUrl,
      twitterUrl: updatedData.twitterUrl,
      websiteUrl: updatedData.websiteUrl,
      artistPickTrackId: updatedData.artistPickTrackId,
      artistPickComment: updatedData.artistPickComment,
    };

    const previousProfile = userProfile;
    const previousArtist = selectedArtist;

    try {
      const res = await fetch(`/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedProfile),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.user) {
        setUserProfile(previousProfile);
        setSelectedArtist(previousArtist);
        showToast(data?.error || 'Could not save artist profile changes — please try again.');
        return;
      }

      const persisted: UserProfile = { ...updatedProfile, ...data.user };
      const canonicalArtistName = persisted.artistName || persisted.displayName;
      const syncOwnedTrack = (track: Track): Track => track.userId === persisted.id
        ? { ...track, artist: canonicalArtistName }
        : track;
      const syncedArtist = normalizePublicArtist(persisted);

      setUserProfile(persisted);
      setTracks((previous) => previous.map(syncOwnedTrack));
      setCurrentTrack((previous) => previous ? syncOwnedTrack(previous) : null);
      setQueue((previous) => previous.map(syncOwnedTrack));
      setRecentlyPlayed((previous) => previous.map(syncOwnedTrack));
      setSelectedAlbumTrack((previous) => previous ? syncOwnedTrack(previous) : null);
      setEditingTrack((previous) => previous ? syncOwnedTrack(previous) : null);
      setSelectedArtist(syncedArtist);
      upsertArtist(syncedArtist);
      showToast('Artist profile saved successfully!');
    } catch (error) {
      console.error('Failed to sync artist profile update with server:', error);
      setUserProfile(previousProfile);
      setSelectedArtist(previousArtist);
      showToast('Could not save artist profile changes — please try again.');
    }
  };

  const handleUpdateUserProfile = async (updated: UserProfile) => {
    if (!userProfile || updated.id !== userProfile.id) {
      showToast('You can only edit your own profile.');
      return;
    }

    const nextDisplayName = updated.displayName.trim() || userProfile.displayName;
    const displayNameChanged = nextDisplayName !== userProfile.displayName;
    // A profile display-name edit is also an artist identity edit. Send an
    // explicit sync instruction so the server updates the canonical artist
    // label and every track owned by this immutable userId in one write.
    const updatePayload = displayNameChanged
      ? { ...updated, displayName: nextDisplayName, artistName: nextDisplayName, syncArtistNameWithDisplayName: true }
      : updated;

    try {
      const res = await fetch(`/api/users/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatePayload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.user) {
        showToast(data?.error || 'Profile update failed.');
        return;
      }
      const persisted = { ...userProfile, ...data.user } as UserProfile;
      const canonicalArtistName = persisted.artistName || persisted.displayName;
      const syncOwnedTrack = (track: Track): Track => track.userId === persisted.id
        ? { ...track, artist: canonicalArtistName }
        : track;

      setUserProfile(persisted);
      setTracks((previous) => previous.map(syncOwnedTrack));
      setCurrentTrack((previous) => previous ? syncOwnedTrack(previous) : null);
      setQueue((previous) => previous.map(syncOwnedTrack));
      setRecentlyPlayed((previous) => previous.map(syncOwnedTrack));
      setSelectedAlbumTrack((previous) => previous ? syncOwnedTrack(previous) : null);
      setEditingTrack((previous) => previous ? syncOwnedTrack(previous) : null);

      if (persisted.isArtist || tracks.some((track) => track.userId === persisted.id)) {
        const syncedArtist = normalizePublicArtist(persisted);
        upsertArtist(syncedArtist);
        setSelectedArtist((previous) => previous?.id === persisted.id ? syncedArtist : previous);
      }
    } catch (error) {
      console.error('Failed to update user profile on server:', error);
      showToast('Profile update failed.');
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!userProfile) return { success: false, error: 'Sign in to change your password.' };

    try {
      const response = await fetch(`/api/users/${userProfile.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        return { success: false, error: data?.error || 'Password update failed.' };
      }
      showToast('Password updated successfully!');
      return { success: true };
    } catch (error) {
      console.error('Failed to update account password:', error);
      return { success: false, error: 'Password update failed — please try again.' };
    }
  };

  const progressFraction = currentTrack?.duration ? currentTimeSeconds / currentTrack.duration : 0;
  const ownedPlaylists = userProfile ? playlists.filter((playlist) => playlist.userId === userProfile.id) : [];
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;
  const canManageSelectedPlaylist = Boolean(userProfile && selectedPlaylist?.userId === userProfile.id);
  const isWorkspacePanelOpen = isEQOpen || isNewPlaylistOpen || isAddTrackOpen;

  return (
    <div
      onContextMenu={handleContextMenu}
      className="vertex-app-shell relative flex h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden bg-black p-0 font-sans text-zinc-100 select-none md:h-screen md:gap-2 md:p-2"
    >
      {/* Static ambient color from the current track. Keeping this layer still
          avoids GPU paint seams over the player and prevents app-wide renders
          on every mouse movement. */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 z-0 opacity-25"
        style={{
          background: `radial-gradient(900px circle at 50% 100%, ${currentTrack?.accentColor || '#A855F7'} 0%, transparent 75%)`,
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
            playlists={ownedPlaylists}
            artists={artists.filter((a) => followedArtistIds.includes(a.id))}
            tracks={tracks}
            onSelectPlaylist={handleSelectPlaylist}
            onOpenNewPlaylistModal={() => openWorkspacePanel('playlist')}
            onPlayTrack={handlePlayTrack}
            currentTrackId={currentTrack?.id}
            onOpenProfileModal={handleOpenProfileModal}
            recentlyPlayed={recentlyPlayed}
            onSelectAlbum={handleSelectAlbum}
            onSelectArtist={handleSelectArtist}
            isCompact={sidebarWidth <= LEFT_SIDEBAR_COMPACT_THRESHOLD}
            onOpenLikedSongs={() => handleOpenLibrary('liked')}
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
              const newWidth = Math.min(LEFT_SIDEBAR_MAX_WIDTH, Math.max(LEFT_SIDEBAR_MIN_WIDTH, e.clientX - leftOffset));
              setSidebarWidth(newWidth);
            }}
            onMouseUp={() => setIsResizingSidebar(false)}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                const leftOffset = sidebarRef.current?.getBoundingClientRect().left ?? 0;
                const newWidth = Math.min(LEFT_SIDEBAR_MAX_WIDTH, Math.max(LEFT_SIDEBAR_MIN_WIDTH, e.touches[0].clientX - leftOffset));
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
        <main className="flex-1 bg-[#121212] flex flex-col min-w-0 overflow-hidden border-0 shadow-2xl relative md:rounded-xl md:border md:border-white/[0.04]">
          {/* Top Header Navigation Bar */}
          <SpotifyTopHeader
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
            onOpenAddTrackModal={() => openWorkspacePanel('upload')}
            onLogout={handleLogout}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />

          {/* Scrollable View Content */}
          <div
            className={`relative min-w-0 max-w-full flex-1 overflow-x-hidden custom-scrollbar ${
              isWorkspacePanelOpen
                ? 'overflow-y-auto p-0 pb-40 md:pb-24'
                : isSongScreenOpen
                  ? 'overflow-hidden p-0'
                : activeTab === 'chat'
                  ? `overflow-hidden p-0 ${currentTrack ? 'pb-[9.5rem]' : 'pb-[5.25rem]'} md:px-6 md:pt-4 md:pb-16`
                  : `overflow-y-auto overscroll-contain px-3 pt-3 ${currentTrack ? 'pb-44' : 'pb-28'} sm:px-6 sm:pt-4 md:pb-24`
            }`}
          >
            {isEQOpen ? (
              <AudioEQModal
                isOpen={isEQOpen}
                onClose={() => setIsEQOpen(false)}
                eq={eq}
                onUpdateEQ={setEq}
              />
            ) : isNewPlaylistOpen ? (
              <NewPlaylistModal
                isOpen={isNewPlaylistOpen}
                onClose={() => setIsNewPlaylistOpen(false)}
                onCreatePlaylist={handleCreatePlaylist}
              />
            ) : isAddTrackOpen ? (
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
            ) : isSongScreenOpen ? (
              <SongScreenModal
                isOpen={isSongScreenOpen}
                onClose={() => setIsSongScreenOpen(false)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                currentTimeSeconds={currentTimeSeconds}
                onTogglePlay={handleTogglePlay}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onToggleShuffle={() => setIsShuffle((current) => !current)}
                onToggleRepeat={() =>
                  setRepeatMode((currentMode) =>
                    currentMode === 'off' ? 'all' : currentMode === 'all' ? 'one' : 'off'
                  )
                }
                onSeek={handleSeek}
                onToggleLike={handleToggleLike}
                onOpenEQ={() => openWorkspacePanel('eq')}
                onSelectArtist={(artistId) => {
                  setIsSongScreenOpen(false);
                  handleSelectArtist(artistId);
                }}
                onSelectAlbum={(track) => {
                  setIsSongScreenOpen(false);
                  handleSelectAlbum(track);
                }}
              />
            ) : (
              <div key={activeTab} className={`view-transition ${activeTab === 'chat' ? 'h-full min-h-0 overflow-hidden' : ''}`}>
                {activeTab === 'home' && (
              <HomeView
                tracks={tracks}
                playlists={playlists}
                albums={[]}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onToggleLike={handleToggleLike}
                selectedCategory={selectedCategory}
                onOpenLikedSongs={() => handleOpenLibrary('liked')}
                onOpenAddTrackModal={() => openWorkspacePanel('upload')}
                onOpenNewPlaylistModal={() => openWorkspacePanel('playlist')}
                recentlyPlayed={recentlyPlayed}
              />
            )}

            {activeTab === 'browse' && (
              <BrowseView
                tracks={tracks}
                playlists={playlists}
                artists={artists}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectAlbum={handleSelectAlbum}
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
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onToggleLike={handleToggleLike}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                tracks={tracks}
                playlists={ownedPlaylists}
                artists={artists.filter((a) => followedArtistIds.includes(a.id))}
                onPlayTrack={handlePlayTrack}
                onPlayPlaylist={handlePlayPlaylist}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectAlbum={handleSelectAlbum}
                onSelectArtist={handleSelectArtist}
                onOpenNewPlaylistModal={() => openWorkspacePanel('playlist')}
                onWipeAllTracks={handleWipeAllTracks}
                onToggleLike={handleToggleLike}
                activeFilter={libraryFilter}
                onFilterChange={setLibraryFilter}
              />
            )}

            {activeTab === 'playlist' && (
              <PlaylistView
                playlist={selectedPlaylist}
                canManage={canManageSelectedPlaylist}
                allTracks={tracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                isShuffle={isShuffle}
                onPlayTrack={handlePlayTrack}
                onPlayPlaylist={handlePlayPlaylist}
                onShufflePlaylist={handleShufflePlaylist}
                onToggleLike={handleToggleLike}
                onOpenEditModal={() => setIsEditPlaylistOpen(true)}
                onDeletePlaylist={handleDeletePlaylist}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                onSelectAlbum={handleSelectAlbum}
                onSelectArtist={handleSelectArtist}
                showToast={showToast}
              />
            )}

            {activeTab === 'chat' && (
              <ChatView
                messages={chatMessages}
                onUpdateMessages={setChatMessages}
                onPlayTrack={handlePlayTrack}
                userId={userProfile?.id}
                userAvatarUrl={userProfile?.avatarUrl}
                userDisplayName={userProfile?.displayName || userProfile?.username}
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
                onToggleLike={handleToggleLike}
                onLogout={handleLogout}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onSelectArtist={handleSelectArtist}
                onDeleteTrack={handleDeleteTrack}
                onEditTrack={(tr) => setEditingTrack(tr)}
                onOpenAddTrackModal={() => openWorkspacePanel('upload')}
                artists={artists}
                onChangePassword={handleChangePassword}
              />
            )}

            {activeTab === 'artist' && (
              <ArtistView
                artist={selectedArtist}
                allTracks={tracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                isShuffle={isShuffle}
                onToggleShuffle={handleToggleShuffleForTracks}
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
                onSetReleaseLiked={handleSetReleaseLiked}
                onEditTrack={(track) => setEditingTrack(track)}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onGoBack={handleGoBack}
                userProfile={userProfile}
                playlists={ownedPlaylists}
                onAddToQueue={(tr) => setQueue((prev) => [...prev, tr])}
                onAddTracksToQueue={(releaseTracks) => setQueue((previous) => [...previous, ...releaseTracks])}
                onAddToPlaylist={handleAddTrackToPlaylist}
                onAddTracksToPlaylist={handleAddTracksToPlaylist}
                onOpenNewPlaylist={() => openWorkspacePanel('playlist')}
                showToast={showToast}
              />
            )}
              </div>
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
              playlists={ownedPlaylists}
              userProfile={userProfile}
              allTracks={tracks}
              onClose={() => setIsRightSidebarOpen(false)}
              onToggleLike={handleToggleLike}
              onSelectArtist={handleSelectArtist}
              onSelectAlbum={handleSelectAlbum}
              onAddToPlaylist={handleAddTrackToPlaylist}
              onOpenNewPlaylistModal={() => openWorkspacePanel('playlist')}
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
          setRepeatMode((currentMode) =>
            currentMode === 'off' ? 'all' : currentMode === 'all' ? 'one' : 'off'
          )
        }
        onOpenEQ={() => openWorkspacePanel('eq')}
        onOpenDeviceSelector={() => setIsDeviceSelectorOpen(true)}
        onOpenSongScreen={() => setIsSongScreenOpen((prev) => !prev)}
        onSelectArtist={handleSelectArtist}
        activeDeviceName={activeDeviceName}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={handleToggleRightSidebar}
      />

      {/* Modals */}

      <EditPlaylistModal
        isOpen={isEditPlaylistOpen}
        playlist={canManageSelectedPlaylist ? selectedPlaylist : null}
        onClose={() => setIsEditPlaylistOpen(false)}
        onSavePlaylist={handleUpdatePlaylist}
      />

      <DeviceSelectorModal
        isOpen={isDeviceSelectorOpen}
        onClose={() => setIsDeviceSelectorOpen(false)}
        activeDevice={activeDeviceName}
        onSelectDevice={setActiveDeviceName}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        userProfile={userProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateProfile={handleUpdateUserProfile}
        recentTracks={recentlyPlayed.slice(0, 5)}
        onPlayTrack={handlePlayTrack}
        onLogout={handleLogout}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
        tracks={tracks}
        userId={userProfile?.id}
        onTrackUpdated={(updated) => {
          setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          if (currentTrack?.id === updated.id) {
            setCurrentTrack((prev) => (prev ? { ...prev, ...updated } : null));
          }
          showToast(`Updated "${updated.title}" metadata!`);
        }}
        onTracksUpdated={(updatedTracks) => {
          const updatedById = new Map(updatedTracks.map((updated) => [updated.id, updated]));
          setTracks((previous) => previous.map((item) => updatedById.get(item.id) || item));
          setCurrentTrack((previous) => previous ? updatedById.get(previous.id) || previous : null);
          showToast(updatedTracks.length > 1 ? `Updated ${updatedTracks.length} tracks and release metadata!` : `Updated "${updatedTracks[0]?.title || 'track'}" metadata!`);
        }}
      />

      {/* Global Right-Click Context Menu */}
      <ContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
        playlists={ownedPlaylists}
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
        onOpenEQ={() => openWorkspacePanel('eq')}
        onOpenAddTrack={() => openWorkspacePanel('upload')}
        onOpenNewPlaylist={() => openWorkspacePanel('playlist')}
        onNavigate={handleSelectTab}
        onOpenProfile={handleOpenProfileModal}
        onOpenChat={() => handleSelectTab('chat')}
        onOpenDeviceSelector={() => setIsDeviceSelectorOpen(true)}
        showToast={showToast}
      />

      {/* Visual Toast Notification Banner */}
      <Toast message={toastMessage} hasPlayer={Boolean(currentTrack)} onClose={() => setToastMessage(null)} />
      <SiteTooltip />
    </div>
  );
}
