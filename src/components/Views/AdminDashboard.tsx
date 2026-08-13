import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  Ban,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileAudio,
  History,
  KeyRound,
  ListMusic,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserRoundCog,
  Users,
  XCircle,
} from 'lucide-react';
import { ChatMessage, Playlist, Track, UserProfile } from '../../types';
import { ADMIN_USER_ID } from '../../utils/admin';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

type RecordStatus = 'active' | 'banned' | 'archived';

type AdminUser = UserProfile & {
  status: RecordStatus;
  trackCount: number;
  activeTrackCount: number;
  archivedTrackCount: number;
  playlistCount: number;
  activePlaylistCount: number;
  archivedPlaylistCount: number;
  likedTrackCount: number;
  recentTrackCount: number;
  followedArtistCount: number;
  chatMessageCount: number;
};

type AdminTrack = Track & {
  status: 'active' | 'archived';
  playCount: number;
  owner: { id: string; username: string; displayName: string } | null;
};

type AdminPlaylist = Playlist & {
  status: 'active' | 'archived';
  createdAt?: string;
  owner: { id: string; username: string; displayName: string } | null;
};

type AdminAudit = {
  id: string;
  actorId: string;
  action: string;
  targetType: 'user' | 'track' | 'playlist';
  targetId: string;
  timestamp: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

type AdminActivity = {
  id: string;
  type: string;
  timestamp: string;
  userId: string;
  title: string;
  detail: string;
};

type SelectedUserDetails = {
  user: AdminUser | null;
  state: { likedTrackIds: string[]; recentTrackIds: string[]; followedArtistIds: string[] };
  tracks: AdminTrack[];
  playlists: AdminPlaylist[];
  chatHistory: ChatMessage[];
  auditHistory: AdminAudit[];
};

type AdminSnapshot = {
  generatedAt: string;
  adminUserId: string;
  summary: {
    users: number;
    activeUsers: number;
    bannedUsers: number;
    archivedUsers: number;
    artists: number;
    tracks: number;
    activeTracks: number;
    archivedTracks: number;
    playlists: number;
    activePlaylists: number;
    archivedPlaylists: number;
    totalPlays: number;
    totalListeningSeconds: number;
    chatMessageCount: number;
    activeSessions: number;
  };
  system: {
    uptimeSeconds: number;
    nodeEnvironment: string;
    upstashRedisConfigured: boolean;
    cloudflareR2Configured: boolean;
    storageMode: string;
  };
  selected: SelectedUserDetails;
  users: AdminUser[];
  tracks: AdminTrack[];
  playlists: AdminPlaylist[];
  activity: AdminActivity[];
  auditLog: AdminAudit[];
  topGenres: { genre: string; plays: number }[];
};

type AdminSection = 'overview' | 'users' | 'content' | 'audit';

type ProfileForm = {
  displayName: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  favoriteGenres: string;
  isArtist: boolean;
  artistName: string;
  artistBio: string;
  artistVerified: boolean;
  instagramUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  artistPickTrackId: string;
  artistPickComment: string;
};

const panelClass = 'rounded-2xl border border-white/[0.08] bg-[#181818]/90 shadow-xl';
const inputClass = 'w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-400/50';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40';

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function formatHours(seconds: number): string {
  return `${((Number(seconds) || 0) / 3600).toFixed(1)}h`;
}

function StatusBadge({ status }: { status: RecordStatus | 'active' | 'archived' }) {
  const colors = status === 'active'
    ? 'bg-emerald-400/10 text-emerald-300'
    : status === 'banned'
      ? 'bg-red-400/10 text-red-300'
      : 'bg-amber-400/10 text-amber-300';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${colors}`}>{status}</span>;
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className={`${panelClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[11px] text-zinc-500">{detail}</p></div>
        <div className="rounded-xl bg-white/[0.06] p-2.5 text-fuchsia-300">{icon}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span>{children}</label>;
}

function SystemStatus({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-xs">
      <span className="font-bold text-zinc-300">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase ${ready ? 'text-emerald-300' : 'text-zinc-500'}`}>{ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{ready ? 'Ready' : 'Off'}</span>
    </div>
  );
}

export const AdminDashboard: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [selectedUserId, setSelectedUserId] = useState(ADMIN_USER_ID);
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [cascadeRestore, setCascadeRestore] = useState(true);
  const [statsForm, setStatsForm] = useState({ secondsListened: '0', tracksPlayed: '0', topGenre: 'N/A', reason: '' });
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    displayName: '', username: '', email: '', bio: '', avatarUrl: '', bannerUrl: '', favoriteGenres: '', isArtist: false,
    artistName: '', artistBio: '', artistVerified: false, instagramUrl: '', twitterUrl: '', websiteUrl: '', artistPickTrackId: '', artistPickComment: '',
  });
  const [profileReason, setProfileReason] = useState('');
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '', reason: '' });

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('vertex_session_token');
      const response = await fetch(`/api/admin/overview?userId=${encodeURIComponent(selectedUserId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || 'Unable to load admin overview.');
      setSnapshot(data as AdminSnapshot);
      setLastRefreshed(new Date().toISOString());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load admin overview.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => { void loadSnapshot(); }, [loadSnapshot]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => { void loadSnapshot(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadSnapshot]);

  const selectedUser = snapshot?.selected.user || null;
  useEffect(() => {
    if (!selectedUser) return;
    setStatsForm({
      secondsListened: String(selectedUser.stats?.secondsListened || 0),
      tracksPlayed: String(selectedUser.stats?.tracksPlayed || 0),
      topGenre: selectedUser.stats?.topGenre || 'N/A',
      reason: '',
    });
    setProfileForm({
      displayName: selectedUser.displayName || '', username: selectedUser.username || '', email: selectedUser.email || '', bio: selectedUser.bio || '',
      avatarUrl: selectedUser.avatarUrl === DEFAULT_AVATAR_URL ? '' : selectedUser.avatarUrl || '', bannerUrl: selectedUser.bannerUrl || '',
      favoriteGenres: (selectedUser.favoriteGenres || []).join(', '), isArtist: selectedUser.isArtist === true, artistName: selectedUser.artistName || '',
      artistBio: selectedUser.artistBio || '', artistVerified: selectedUser.artistVerified === true, instagramUrl: selectedUser.instagramUrl || '',
      twitterUrl: selectedUser.twitterUrl || '', websiteUrl: selectedUser.websiteUrl || '', artistPickTrackId: selectedUser.artistPickTrackId || '',
      artistPickComment: selectedUser.artistPickComment || '',
    });
    setModerationReason('');
  }, [selectedUser]);

  const runMutation = useCallback(async (path: string, method: 'PATCH' | 'POST', body: Record<string, unknown>, successMessage: string) => {
    setIsMutating(true);
    setMutationError(null);
    setMutationMessage(null);
    try {
      const token = localStorage.getItem('vertex_session_token');
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'The admin operation failed.');
      setMutationMessage(successMessage);
      await loadSnapshot();
      return true;
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The admin operation failed.');
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [loadSnapshot]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.users || [];
    return snapshot.users.filter((user) => [user.displayName, user.username, user.email, user.id, user.status].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);
  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.tracks || [];
    return snapshot.tracks.filter((track) => [track.title, track.artist, track.album, track.genre, track.owner?.username || '', track.id, track.status].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);
  const filteredPlaylists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.playlists || [];
    return snapshot.playlists.filter((playlist) => [playlist.title, playlist.description, playlist.owner?.username || '', playlist.id, playlist.status].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);
  const filteredAudit = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.auditLog || [];
    return snapshot.auditLog.filter((entry) => [entry.action, entry.actorId, entry.targetType, entry.targetId, entry.reason].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);

  const submitStats = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    const secondsListened = Number(statsForm.secondsListened);
    const tracksPlayed = Number(statsForm.tracksPlayed);
    if (!Number.isInteger(secondsListened) || secondsListened < 0 || secondsListened > 1_000_000_000_000 || !Number.isInteger(tracksPlayed) || tracksPlayed < 0 || tracksPlayed > 1_000_000_000 || !statsForm.topGenre.trim() || statsForm.topGenre.trim().length > 80) {
      setMutationError('Enter bounded whole-number stats and a top genre of at most 80 characters.');
      return;
    }
    if (!window.confirm(`Set absolute listening stats for @${selectedUser.username}?`)) return;
    await runMutation(`/api/admin/users/${selectedUser.id}/stats`, 'PATCH', { secondsListened, tracksPlayed, topGenre: statsForm.topGenre.trim(), reason: statsForm.reason }, 'Stats saved and audited.');
  };

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUser || !window.confirm(`Save profile changes for @${selectedUser.username}?`)) return;
    await runMutation(`/api/admin/users/${selectedUser.id}/profile`, 'PATCH', {
      ...profileForm,
      favoriteGenres: profileForm.favoriteGenres.split(',').map((genre) => genre.trim()).filter(Boolean),
      reason: profileReason,
    }, 'Profile saved and audited.');
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    if (passwordForm.newPassword.length < 8 || passwordForm.newPassword.length > 128 || passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMutationError('Passwords must match and contain 8–128 characters.');
      return;
    }
    if (!window.confirm(`Reset the password for @${selectedUser.username}? The existing password cannot be recovered.`)) return;
    const success = await runMutation(`/api/admin/users/${selectedUser.id}/password-reset`, 'POST', { ...passwordForm, confirmed: true }, 'Password reset completed without logging credentials.');
    if (success) setPasswordForm({ newPassword: '', confirmPassword: '', reason: '' });
  };

  const moderateUser = async (action: 'ban' | 'unban' | 'archive' | 'restore') => {
    if (!selectedUser) return;
    if ((action === 'ban' || action === 'archive') && !moderationReason.trim()) {
      setMutationError(`A reason is required to ${action} this user.`);
      return;
    }
    const cascadeText = action === 'archive' ? ' Their tracks and playlists will also be archived.' : action === 'restore' && cascadeRestore ? ' Their archived tracks and playlists will also be restored.' : '';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} @${selectedUser.username}?${cascadeText}`)) return;
    await runMutation(`/api/admin/users/${selectedUser.id}/moderation`, 'PATCH', { action, reason: moderationReason, cascade: action === 'restore' && cascadeRestore }, `User ${action} completed and audited.`);
  };

  const archiveContent = async (target: AdminTrack | AdminPlaylist, type: 'track' | 'playlist') => {
    const action = target.status === 'archived' ? 'restore' : 'archive';
    let reason = '';
    if (action === 'archive') {
      const supplied = window.prompt(`Reason for archiving “${target.title}”:`);
      if (supplied === null) return;
      reason = supplied.trim();
      if (!reason) { setMutationError('An archive reason is required.'); return; }
    }
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${type} “${target.title}”?`)) return;
    const plural = type === 'track' ? 'tracks' : 'playlists';
    await runMutation(`/api/admin/${plural}/${target.id}/archive`, 'PATCH', { action, reason }, `${type} ${action} completed and audited.`);
  };

  if (loadError && !snapshot) {
    return <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-6"><div className={`${panelClass} w-full p-8 text-center`}><ShieldCheck className="mx-auto h-10 w-10 text-fuchsia-400" /><h1 className="mt-4 text-xl font-black text-white">Admin access unavailable</h1><p className="mt-2 text-sm text-zinc-400">{loadError}</p><button type="button" onClick={() => void loadSnapshot()} className={`${buttonClass} mt-6 bg-fuchsia-500 text-white`}><RefreshCw className="h-4 w-4" /> Retry</button></div></div>;
  }
  if (!snapshot) return <div className="p-8 text-sm text-zinc-500">Loading moderation console…</div>;

  const { summary, system } = snapshot;
  const maxGenrePlays = Math.max(1, ...snapshot.topGenres.map((genre) => genre.plays));
  const protectedAdmin = selectedUser?.id === ADMIN_USER_ID;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-[#21152b] p-5 shadow-2xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300"><ShieldCheck className="h-4 w-4" /> Restricted moderation surface</div><h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">Admin command center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Inspect accounts, apply reversible moderation, edit account data, recover archived content, and review every audited change.</p><p className="mt-4 break-all text-[10px] font-bold text-zinc-500">Fixed operator · {ADMIN_USER_ID}</p></div>
          <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs font-bold text-zinc-300"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="accent-fuchsia-500" /> Auto-refresh 30s</label><button type="button" onClick={() => void loadSnapshot()} disabled={isLoading} className={`${buttonClass} border border-white/10 bg-white/[0.08] text-white`}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button></div>
        </div>
        <p className="relative mt-5 flex items-center gap-2 text-[10px] text-zinc-500"><Clock3 className="h-3.5 w-3.5" /> Snapshot {formatDate(snapshot.generatedAt)}{lastRefreshed ? ` · refreshed ${formatDate(lastRefreshed)}` : ''}</p>
      </section>

      {loadError && <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-xs font-bold text-amber-200">Refresh failed: {loadError}. Showing the previous snapshot.</div>}
      {mutationError && <div className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-xs font-bold text-red-200">{mutationError}</div>}
      {mutationMessage && <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-xs font-bold text-emerald-200">{mutationMessage}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Accounts" value={formatNumber(summary.users)} detail={`${summary.activeUsers} active · ${summary.bannedUsers} banned · ${summary.archivedUsers} archived`} />
        <MetricCard icon={<FileAudio className="h-5 w-5" />} label="Tracks" value={formatNumber(summary.tracks)} detail={`${summary.activeTracks} active · ${summary.archivedTracks} archived`} />
        <MetricCard icon={<ListMusic className="h-5 w-5" />} label="Playlists" value={formatNumber(summary.playlists)} detail={`${summary.activePlaylists} active · ${summary.archivedPlaylists} archived`} />
        <MetricCard icon={<Activity className="h-5 w-5" />} label="Sessions" value={formatNumber(summary.activeSessions)} detail={`${formatNumber(summary.totalPlays)} active-catalog plays`} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">{(['overview', 'users', 'content', 'audit'] as AdminSection[]).map((item) => <button key={item} type="button" onClick={() => { setSection(item); setQuery(''); }} className={`${buttonClass} ${section === item ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-zinc-400'}`}>{item === 'audit' ? 'Audit log' : item}</button>)}</div>
        {section !== 'overview' && <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section}…`} className={`${inputClass} pl-10`} /></div>}
      </div>

      {section === 'overview' && <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><BarChart3 className="h-4 w-4 text-fuchsia-300" /> Active-catalog plays by genre</div><div className="mt-5 space-y-4">{snapshot.topGenres.length ? snapshot.topGenres.map((item) => <div key={item.genre}><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold text-zinc-300">{item.genre}</span><span className="font-black text-white">{formatNumber(item.plays)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${Math.max(3, item.plays / maxGenrePlays * 100)}%` }} /></div></div>) : <p className="text-xs text-zinc-500">No active play data.</p>}</div></section>
        <section className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Runtime and persistence</div><div className="mt-4 grid gap-2 sm:grid-cols-3"><SystemStatus label="Admin API" ready /><SystemStatus label="Upstash Redis" ready={system.upstashRedisConfigured} /><SystemStatus label="Cloudflare R2" ready={system.cloudflareR2Configured} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Environment</p><p className="mt-1 font-black text-white">{system.nodeEnvironment}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Storage</p><p className="mt-1 truncate font-black text-white">{system.storageMode}</p></div></div><p className="mt-4 text-[11px] text-zinc-500">Listening {formatHours(summary.totalListeningSeconds)} · AI chat {formatNumber(summary.chatMessageCount)} · artists {formatNumber(summary.artists)}</p></section>
        <section className={`${panelClass} overflow-hidden xl:col-span-2`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Activity className="h-4 w-4 text-sky-300" /> Recent system and audit activity</div></div><div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.activity.slice(0, 12).map((event) => <div key={event.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><div className="flex justify-between gap-2 text-[10px]"><span className="font-black uppercase text-fuchsia-300">{event.type}</span><span className="text-zinc-600">{formatDate(event.timestamp)}</span></div><p className="mt-2 text-xs font-black text-white">{event.title}</p><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-500">{event.detail}</p></div>)}</div></section>
      </div>}

      {section === 'users' && <div className="space-y-5" onFocus={() => setAutoRefresh(false)}>
        <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Users className="h-4 w-4 text-sky-300" /> Select an account <span className="text-xs font-medium text-zinc-500">{filteredUsers.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase text-zinc-600"><tr><th className="px-5 py-3">Account</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Tracks</th><th className="px-3 py-3">Playlists</th><th className="px-3 py-3">AI chat</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredUsers.map((user) => <tr key={user.id} tabIndex={0} aria-selected={selectedUserId === user.id} onClick={() => setSelectedUserId(user.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedUserId(user.id); } }} className={`cursor-pointer outline-none hover:bg-white/[0.04] focus:bg-fuchsia-400/[0.09] ${selectedUserId === user.id ? 'bg-fuchsia-400/[0.07]' : ''}`}><td className="px-5 py-3"><div className="flex items-center gap-3"><img src={user.avatarUrl || DEFAULT_AVATAR_URL} alt="" className="h-9 w-9 rounded-xl object-cover" /><div><p className="max-w-[260px] truncate font-black text-white">{user.displayName}</p><p className="max-w-[260px] truncate text-[11px] text-zinc-500">@{user.username} · {user.email}</p></div></div></td><td className="px-3 py-3"><StatusBadge status={user.status} /></td><td className="px-3 py-3 text-zinc-400">{user.id === ADMIN_USER_ID ? 'Fixed admin' : user.isArtist ? 'Artist' : 'Listener'}</td><td className="px-3 py-3 text-zinc-500">{formatDate(user.createdAt)}</td><td className="px-3 py-3 text-white">{user.activeTrackCount} <span className="text-zinc-600">/ {user.archivedTrackCount} archived</span></td><td className="px-3 py-3 text-white">{user.activePlaylistCount} <span className="text-zinc-600">/ {user.archivedPlaylistCount} archived</span></td><td className="px-3 py-3 font-black text-fuchsia-300">{user.chatMessageCount}</td></tr>)}</tbody></table></div></section>

        {selectedUser && <>
          <section className={`${panelClass} p-5`}><div className="flex flex-wrap items-center gap-4"><img src={selectedUser.avatarUrl || DEFAULT_AVATAR_URL} alt="" className="h-16 w-16 rounded-2xl object-cover" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-white">{selectedUser.displayName}</h2><StatusBadge status={selectedUser.status} /></div><p className="text-sm text-fuchsia-300">@{selectedUser.username}</p><p className="mt-1 break-all text-[10px] text-zinc-600">{selectedUser.id}</p></div><div className="ml-auto grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded-xl bg-black/20 p-3 text-zinc-400"><strong className="block text-base text-white">{selectedUser.likedTrackCount}</strong>likes</div><div className="rounded-xl bg-black/20 p-3 text-zinc-400"><strong className="block text-base text-white">{selectedUser.followedArtistCount}</strong>following</div><div className="rounded-xl bg-black/20 p-3 text-zinc-400"><strong className="block text-base text-white">{selectedUser.recentTrackCount}</strong>recent</div></div></div>{(selectedUser.banReason || selectedUser.archiveReason) && <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-xs text-amber-200">{selectedUser.archiveReason || selectedUser.banReason}</p>}
            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"><Field label="Moderation / archive reason"><input value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} maxLength={1000} placeholder="Required for bans and archive actions" className={inputClass} /></Field><div className="flex flex-wrap items-end gap-2"><button type="button" disabled={isMutating || protectedAdmin} onClick={() => void moderateUser(selectedUser.bannedAt ? 'unban' : 'ban')} className={`${buttonClass} ${selectedUser.bannedAt ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{selectedUser.bannedAt ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{selectedUser.bannedAt ? 'Unban' : 'Ban'}</button><button type="button" disabled={isMutating || protectedAdmin} onClick={() => void moderateUser(selectedUser.archivedAt ? 'restore' : 'archive')} className={`${buttonClass} ${selectedUser.archivedAt ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'}`}>{selectedUser.archivedAt ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{selectedUser.archivedAt ? 'Restore user' : 'Archive user + content'}</button></div></div>
            {selectedUser.archivedAt && <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={cascadeRestore} onChange={(event) => setCascadeRestore(event.target.checked)} className="accent-fuchsia-500" /> Cascade restore to this user’s archived tracks and playlists</label>}
            {protectedAdmin && <p className="mt-3 text-[11px] font-bold text-emerald-300">This allowlisted operator is protected from bans and archives.</p>}
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={submitStats} className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><BarChart3 className="h-4 w-4 text-sky-300" /> Absolute stats editor</div><p className="mt-1 text-xs text-zinc-500">Hours and relationship/content counts remain server-derived.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Seconds listened"><input type="number" min="0" max="1000000000000" step="1" value={statsForm.secondsListened} onChange={(event) => setStatsForm((form) => ({ ...form, secondsListened: event.target.value }))} className={inputClass} /></Field><Field label="Tracks played"><input type="number" min="0" max="1000000000" step="1" value={statsForm.tracksPlayed} onChange={(event) => setStatsForm((form) => ({ ...form, tracksPlayed: event.target.value }))} className={inputClass} /></Field><Field label="Top genre"><input value={statsForm.topGenre} maxLength={80} onChange={(event) => setStatsForm((form) => ({ ...form, topGenre: event.target.value }))} className={inputClass} /></Field></div><div className="mt-3"><Field label="Audit reason (optional)"><input value={statsForm.reason} onChange={(event) => setStatsForm((form) => ({ ...form, reason: event.target.value }))} className={inputClass} /></Field></div><button disabled={isMutating} className={`${buttonClass} mt-4 bg-sky-500 text-white`}><Save className="h-4 w-4" /> Save stats</button></form>

            <form onSubmit={submitPassword} className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><KeyRound className="h-4 w-4 text-amber-300" /> Password reset</div><p className="mt-1 text-xs text-zinc-500">Credentials are never returned or written to the audit log.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="New password"><input type="password" minLength={8} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm((form) => ({ ...form, newPassword: event.target.value }))} className={inputClass} /></Field><Field label="Confirm password"><input type="password" minLength={8} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((form) => ({ ...form, confirmPassword: event.target.value }))} className={inputClass} /></Field></div><div className="mt-3"><Field label="Audit reason (optional)"><input value={passwordForm.reason} onChange={(event) => setPasswordForm((form) => ({ ...form, reason: event.target.value }))} className={inputClass} /></Field></div><button disabled={isMutating} className={`${buttonClass} mt-4 bg-amber-500 text-black`}><KeyRound className="h-4 w-4" /> Reset password</button></form>
          </div>

          <form onSubmit={submitProfile} className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><UserRoundCog className="h-4 w-4 text-fuchsia-300" /> Profile editor</div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Display name"><input value={profileForm.displayName} onChange={(event) => setProfileForm((form) => ({ ...form, displayName: event.target.value }))} className={inputClass} /></Field><Field label="Username"><input value={profileForm.username} onChange={(event) => setProfileForm((form) => ({ ...form, username: event.target.value }))} className={inputClass} /></Field><Field label="Email"><input type="email" value={profileForm.email} onChange={(event) => setProfileForm((form) => ({ ...form, email: event.target.value }))} className={inputClass} /></Field><Field label="Avatar URL"><input value={profileForm.avatarUrl} onChange={(event) => setProfileForm((form) => ({ ...form, avatarUrl: event.target.value }))} className={inputClass} /></Field><Field label="Banner URL"><input value={profileForm.bannerUrl} onChange={(event) => setProfileForm((form) => ({ ...form, bannerUrl: event.target.value }))} className={inputClass} /></Field><Field label="Favorite genres (comma-separated)"><input value={profileForm.favoriteGenres} onChange={(event) => setProfileForm((form) => ({ ...form, favoriteGenres: event.target.value }))} className={inputClass} /></Field><Field label="Artist name"><input value={profileForm.artistName} onChange={(event) => setProfileForm((form) => ({ ...form, artistName: event.target.value }))} className={inputClass} /></Field><Field label="Instagram URL"><input value={profileForm.instagramUrl} onChange={(event) => setProfileForm((form) => ({ ...form, instagramUrl: event.target.value }))} className={inputClass} /></Field><Field label="X / Twitter URL"><input value={profileForm.twitterUrl} onChange={(event) => setProfileForm((form) => ({ ...form, twitterUrl: event.target.value }))} className={inputClass} /></Field><Field label="Website URL"><input value={profileForm.websiteUrl} onChange={(event) => setProfileForm((form) => ({ ...form, websiteUrl: event.target.value }))} className={inputClass} /></Field><Field label="Artist pick track ID"><input value={profileForm.artistPickTrackId} onChange={(event) => setProfileForm((form) => ({ ...form, artistPickTrackId: event.target.value }))} className={inputClass} /></Field><Field label="Artist pick comment"><input value={profileForm.artistPickComment} maxLength={500} onChange={(event) => setProfileForm((form) => ({ ...form, artistPickComment: event.target.value }))} className={inputClass} /></Field></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Bio"><textarea rows={4} maxLength={500} value={profileForm.bio} onChange={(event) => setProfileForm((form) => ({ ...form, bio: event.target.value }))} className={inputClass} /></Field><Field label="Artist bio"><textarea rows={4} maxLength={2000} value={profileForm.artistBio} onChange={(event) => setProfileForm((form) => ({ ...form, artistBio: event.target.value }))} className={inputClass} /></Field></div><div className="mt-3 flex flex-wrap gap-5 text-xs text-zinc-300"><label className="flex items-center gap-2"><input type="checkbox" checked={profileForm.isArtist} onChange={(event) => setProfileForm((form) => ({ ...form, isArtist: event.target.checked }))} className="accent-fuchsia-500" /> Artist profile</label><label className="flex items-center gap-2"><input type="checkbox" checked={profileForm.artistVerified} onChange={(event) => setProfileForm((form) => ({ ...form, artistVerified: event.target.checked }))} className="accent-fuchsia-500" /> Verified artist</label></div><div className="mt-3"><Field label="Audit reason (optional)"><input value={profileReason} onChange={(event) => setProfileReason(event.target.value)} className={inputClass} /></Field></div><button disabled={isMutating} className={`${buttonClass} mt-4 bg-fuchsia-500 text-white`}><Save className="h-4 w-4" /> Save profile</button></form>
        </>}
      </div>}

      {section === 'content' && <div className="space-y-5">
        <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><FileAudio className="h-4 w-4 text-sky-300" /> Tracks <span className="text-xs font-medium text-zinc-500">{filteredTracks.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase text-zinc-600"><tr><th className="px-5 py-3">Track</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Genre</th><th className="px-3 py-3">Length</th><th className="px-3 py-3">Plays</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredTracks.map((track) => <tr key={track.id}><td className="px-5 py-3"><p className="font-black text-white">{track.title}</p><p className="text-[11px] text-zinc-500">{track.artist} · {track.album}</p></td><td className="px-3 py-3 text-zinc-300">@{track.owner?.username || 'unknown'}</td><td className="px-3 py-3"><StatusBadge status={track.status} /></td><td className="px-3 py-3 text-zinc-400">{track.genre || 'Unspecified'}</td><td className="px-3 py-3 font-mono text-zinc-400">{formatDuration(track.duration)}</td><td className="px-3 py-3 font-black text-fuchsia-300">{formatNumber(track.playCount)}</td><td className="px-3 py-3"><button disabled={isMutating} onClick={() => void archiveContent(track, 'track')} className={`${buttonClass} border border-white/10 bg-white/[0.05] text-white`}>{track.status === 'archived' ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{track.status === 'archived' ? 'Restore' : 'Archive'}</button></td></tr>)}</tbody></table></div></section>
        <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><ListMusic className="h-4 w-4 text-emerald-300" /> Playlists <span className="text-xs font-medium text-zinc-500">{filteredPlaylists.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase text-zinc-600"><tr><th className="px-5 py-3">Playlist</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Tracks</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredPlaylists.map((playlist) => <tr key={playlist.id}><td className="px-5 py-3"><p className="font-black text-white">{playlist.title}</p><p className="max-w-[360px] truncate text-[11px] text-zinc-500">{playlist.description || 'No description'}</p></td><td className="px-3 py-3 text-zinc-300">@{playlist.owner?.username || 'unknown'}</td><td className="px-3 py-3"><StatusBadge status={playlist.status} /></td><td className="px-3 py-3 font-black text-white">{playlist.trackCount}</td><td className="px-3 py-3 text-zinc-500">{formatDate(playlist.createdAt)}</td><td className="px-3 py-3"><button disabled={isMutating} onClick={() => void archiveContent(playlist, 'playlist')} className={`${buttonClass} border border-white/10 bg-white/[0.05] text-white`}>{playlist.status === 'archived' ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{playlist.status === 'archived' ? 'Restore' : 'Archive'}</button></td></tr>)}</tbody></table></div></section>
      </div>}

      {section === 'audit' && <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><History className="h-4 w-4 text-amber-300" /> Persistent admin audit log <span className="text-xs font-medium text-zinc-500">{filteredAudit.length} shown</span></div><p className="mt-1 text-xs text-zinc-500">Credential values and hashes are excluded from summaries.</p></div><div className="divide-y divide-white/[0.06]">{filteredAudit.map((entry) => <article key={entry.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-xs font-black text-white">{entry.action}</span><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] uppercase text-zinc-400">{entry.targetType}</span></div><span className="text-[10px] text-zinc-600">{formatDate(entry.timestamp)}</span></div><p className="mt-2 text-xs text-zinc-300">{entry.reason}</p><p className="mt-1 break-all font-mono text-[10px] text-zinc-600">actor {entry.actorId} · target {entry.targetId}</p><details className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-zinc-500">Safe before / after summary</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-zinc-400">{JSON.stringify(entry.before, null, 2)}</pre><pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-zinc-400">{JSON.stringify(entry.after, null, 2)}</pre></div></details></article>)}{!filteredAudit.length && <p className="p-8 text-center text-xs text-zinc-500">No audit entries match this search.</p>}</div></section>}

      {isMutating && <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl border border-fuchsia-400/25 bg-[#21152b] px-4 py-3 text-xs font-black text-white shadow-2xl"><Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" /> Applying admin operation…</div>}
    </div>
  );
};
