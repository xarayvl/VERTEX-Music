import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileAudio,
  ListMusic,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { ChatMessage, Playlist, Track, UserProfile } from '../../types';
import { ADMIN_USER_ID } from '../../utils/admin';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

type AdminUser = UserProfile & {
  trackCount: number;
  playlistCount: number;
  likedTrackCount: number;
  recentTrackCount: number;
  followedArtistCount: number;
  chatMessageCount: number;
};

type AdminTrack = Track & {
  playCount: number;
  owner: { id: string; username: string; displayName: string } | null;
};

type AdminPlaylist = Playlist & {
  createdAt?: string;
  owner: { id: string; username: string; displayName: string } | null;
};

type AdminActivity = {
  id: string;
  type: string;
  timestamp: string;
  userId: string;
  title: string;
  detail: string;
};

type AdminSnapshot = {
  generatedAt: string;
  adminUserId: string;
  summary: {
    users: number;
    artists: number;
    tracks: number;
    playlists: number;
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
  target: {
    user: AdminUser | null;
    state: { likedTrackIds: string[]; recentTrackIds: string[]; followedArtistIds: string[] };
    tracks: AdminTrack[];
    playlists: AdminPlaylist[];
    chatHistory: ChatMessage[];
  };
  users: AdminUser[];
  tracks: AdminTrack[];
  playlists: AdminPlaylist[];
  activity: AdminActivity[];
  topGenres: { genre: string; plays: number }[];
};

type AdminSection = 'overview' | 'users' | 'content' | 'activity';

const panelClass = 'rounded-2xl border border-white/[0.08] bg-[#181818]/90 shadow-xl';

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string): string {
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

function MetricCard({ icon, label, value, detail, accent = 'text-[#F0ABFC]' }: { icon: React.ReactNode; label: string; value: string; detail?: string; accent?: string }) {
  return (
    <div className={`${panelClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
          {detail && <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>}
        </div>
        <div className={`rounded-xl bg-white/[0.06] p-2.5 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function StatusPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <span className="text-xs font-bold text-zinc-300">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${enabled ? 'text-emerald-300' : 'text-zinc-500'}`}>
        {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {enabled ? 'Ready' : 'Off'}
      </span>
    </div>
  );
}

export const AdminDashboard: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('vertex_session_token');
      const response = await fetch('/api/admin/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || 'Unable to load admin overview.');
      setSnapshot(data as AdminSnapshot);
      setLastRefreshed(new Date().toISOString());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin overview.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(loadSnapshot, 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadSnapshot]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.users || [];
    return snapshot.users.filter((user) => [user.displayName, user.username, user.email, user.id].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.tracks || [];
    return snapshot.tracks.filter((track) => [track.title, track.artist, track.album, track.genre, track.owner?.username || '', track.id].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);

  const filteredPlaylists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!snapshot || !normalized) return snapshot?.playlists || [];
    return snapshot.playlists.filter((playlist) => [playlist.title, playlist.description, playlist.owner?.username || '', playlist.id].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, snapshot]);

  if (error && !snapshot) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-6">
        <div className={`${panelClass} w-full p-8 text-center`}>
          <ShieldCheck className="mx-auto h-10 w-10 text-[#D946EF]" />
          <h1 className="mt-4 text-xl font-black text-white">Admin access unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{error}</p>
          <button type="button" onClick={loadSnapshot} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#D946EF] px-4 py-3 text-xs font-black text-white hover:bg-[#E879F9]"><RefreshCw className="h-4 w-4" /> Retry</button>
        </div>
      </div>
    );
  }

  if (!snapshot) return <div className="p-8 text-sm text-zinc-500">Loading admin overview…</div>;

  const { summary, system, target } = snapshot;
  const targetUser = target.user;
  const maxGenrePlays = Math.max(1, ...snapshot.topGenres.map((genre) => genre.plays));
  const topTracks = [...snapshot.tracks].sort((left, right) => right.playCount - left.playCount).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#D946EF]/25 bg-[#21152b] p-5 shadow-2xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D946EF]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F0ABFC]"><ShieldCheck className="h-4 w-4" /> Restricted admin surface</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Admin command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Read-only visibility into users, catalog, listening, AI chat, playlists, and storage for the VERTEX Music app.</p>
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-bold text-zinc-400"><span className="text-zinc-600">Allowlisted user</span><span className="truncate text-zinc-200">{ADMIN_USER_ID}</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs font-bold text-zinc-300"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="accent-fuchsia-500" /> Auto-refresh 30s</label>
            <button type="button" onClick={loadSnapshot} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2.5 text-xs font-black text-white hover:bg-white/[0.14] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-2 text-[10px] text-zinc-500"><Clock3 className="h-3.5 w-3.5" /> Snapshot generated {formatDate(snapshot.generatedAt)}{lastRefreshed ? ` · refreshed ${formatDate(lastRefreshed)}` : ''}</div>
      </section>

      {error && <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-xs font-bold text-amber-200">The last refresh failed: {error}. Showing the previous snapshot.</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Users" value={formatNumber(summary.users)} detail={`${formatNumber(summary.artists)} artist profiles`} />
        <MetricCard icon={<FileAudio className="h-5 w-5" />} label="Catalog tracks" value={formatNumber(summary.tracks)} detail={`${formatNumber(summary.totalPlays)} total plays`} accent="text-sky-300" />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="Listening time" value={formatHours(summary.totalListeningSeconds)} detail={`${formatNumber(summary.activeSessions)} active sessions`} accent="text-emerald-300" />
        <MetricCard icon={<MessageSquare className="h-5 w-5" />} label="AI chat messages" value={formatNumber(summary.chatMessageCount)} detail={`${formatNumber(summary.playlists)} playlists`} accent="text-amber-300" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['overview', 'users', 'content', 'activity'] as AdminSection[]).map((item) => (
            <button key={item} type="button" onClick={() => { setSection(item); setQuery(''); }} className={`rounded-xl px-4 py-2.5 text-xs font-black capitalize transition-colors ${section === item ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white'}`}>{item}</button>
          ))}
        </div>
        {section !== 'overview' && <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section}…`} className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#D946EF]/50" /></div>}
      </div>

      {section === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className={`${panelClass} overflow-hidden`}>
              <div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck className="h-4 w-4 text-[#D946EF]" /> Target account</div><p className="mt-1 text-xs text-zinc-500">The only account permitted to open this panel.</p></div>
              {targetUser ? <div className="p-5"><div className="flex flex-wrap items-center gap-4"><img src={targetUser.avatarUrl || DEFAULT_AVATAR_URL} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-2xl border border-[#D946EF]/40 object-cover" /><div className="min-w-0"><h2 className="truncate text-xl font-black text-white">{targetUser.displayName}</h2><p className="text-sm text-[#F0ABFC]">@{targetUser.username}</p><p className="mt-1 truncate text-xs text-zinc-500">{targetUser.email}</p></div><div className="ml-auto flex flex-wrap gap-2"><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-300">Admin allowlist</span>{targetUser.isArtist && <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-sky-300">Artist</span>}</div></div><p className="mt-4 break-all rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[10px] text-zinc-500">{targetUser.id}</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[10px] text-zinc-500">Tracks played</p><p className="mt-1 text-lg font-black text-white">{formatNumber(targetUser.stats?.tracksPlayed || 0)}</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[10px] text-zinc-500">Listening</p><p className="mt-1 text-lg font-black text-white">{formatHours(targetUser.stats?.secondsListened || 0)}</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[10px] text-zinc-500">Uploads</p><p className="mt-1 text-lg font-black text-white">{formatNumber(target.tracks.length)}</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[10px] text-zinc-500">AI messages</p><p className="mt-1 text-lg font-black text-white">{formatNumber(target.chatHistory.length)}</p></div></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-zinc-400"><span>♥ {formatNumber(target.state.likedTrackIds.length)} liked tracks</span><span>↗ {formatNumber(target.state.followedArtistIds.length)} followed artists</span><span>◷ {formatNumber(target.state.recentTrackIds.length)} recent tracks</span><span>Joined {formatDate(targetUser.createdAt)}</span></div></div> : <div className="p-5 text-sm text-zinc-500">The configured admin user was not found in the current database.</div>}
            </section>

            <section className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><Server className="h-4 w-4 text-emerald-300" /> System health</div><p className="mt-1 text-xs text-zinc-500">Runtime and persistence signals from the server.</p><div className="mt-4 space-y-2"><StatusPill label="Upstash Redis" enabled={system.upstashRedisConfigured} /><StatusPill label="Cloudflare R2" enabled={system.cloudflareR2Configured} /><StatusPill label="Admin API" enabled={true} /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><p className="text-[10px] text-zinc-500">Environment</p><p className="mt-1 text-sm font-black text-white">{system.nodeEnvironment}</p></div><div className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><p className="text-[10px] text-zinc-500">Storage</p><p className="mt-1 truncate text-sm font-black text-white">{system.storageMode}</p></div></div><p className="mt-4 text-[11px] text-zinc-500">Server uptime: {formatDuration(system.uptimeSeconds)}</p></section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <section className={`${panelClass} p-5`}><div className="flex items-center gap-2 text-sm font-black text-white"><BarChart3 className="h-4 w-4 text-[#F0ABFC]" /> Plays by genre</div><div className="mt-5 space-y-4">{snapshot.topGenres.length ? snapshot.topGenres.map((genre) => <div key={genre.genre}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate font-bold text-zinc-300">{genre.genre}</span><span className="font-black text-white">{formatNumber(genre.plays)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[#D946EF]" style={{ width: `${Math.max(3, (genre.plays / maxGenrePlays) * 100)}%` }} /></div></div>) : <p className="text-xs text-zinc-500">No play data yet.</p>}</div></section>
            <section className={`${panelClass} overflow-hidden`}><div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><div className="flex items-center gap-2 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-amber-300" /> Top tracks</div><p className="mt-1 text-xs text-zinc-500">Most-played catalog items.</p></div><span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{formatNumber(summary.totalPlays)} total</span></div><div className="divide-y divide-white/[0.06]">{topTracks.length ? topTracks.map((track, index) => <div key={track.id} className="flex items-center gap-3 px-5 py-3"><span className="w-5 text-xs font-black text-zinc-600">{index + 1}</span><img src={track.coverUrl || DEFAULT_AVATAR_URL} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{track.title}</p><p className="truncate text-[11px] text-zinc-500">{track.artist} · {track.genre || 'Unspecified'}</p></div><span className="text-xs font-black text-[#F0ABFC]">{formatNumber(track.playCount)}</span></div>) : <p className="p-5 text-xs text-zinc-500">No tracks uploaded yet.</p>}</div></section>
          </div>

          <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Activity className="h-4 w-4 text-sky-300" /> Latest activity</div><p className="mt-1 text-xs text-zinc-500">Account, upload, playlist, and AI chat events.</p></div><div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.activity.slice(0, 12).map((event) => <div key={event.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wide text-[#F0ABFC]">{event.type}</span><span className="text-[10px] text-zinc-600">{formatDate(event.timestamp)}</span></div><p className="mt-2 text-xs font-black text-white">{event.title}</p><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-500">{event.detail}</p></div>)}</div></section>
        </div>
      )}

      {section === 'users' && <section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Users className="h-4 w-4 text-sky-300" /> All users <span className="text-xs font-medium text-zinc-500">{filteredUsers.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-3">Account</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Tracks</th><th className="px-3 py-3">Playlists</th><th className="px-3 py-3">Likes / Recent</th><th className="px-3 py-3">AI chat</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredUsers.map((user) => <tr key={user.id} className="hover:bg-white/[0.025]"><td className="px-5 py-3"><div className="flex items-center gap-3"><img src={user.avatarUrl || DEFAULT_AVATAR_URL} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-xl object-cover" /><div className="min-w-0"><p className="max-w-[220px] truncate font-black text-white">{user.displayName}</p><p className="max-w-[220px] truncate text-[11px] text-zinc-500">@{user.username} · {user.email}</p></div></div></td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{user.id === ADMIN_USER_ID && <span className="rounded-full bg-fuchsia-400/10 px-2 py-1 text-[10px] font-black text-fuchsia-300">ADMIN</span>}{user.isArtist && <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-black text-sky-300">ARTIST</span>}{!user.isArtist && user.id !== ADMIN_USER_ID && <span className="text-zinc-600">Listener</span>}</div></td><td className="whitespace-nowrap px-3 py-3 text-zinc-400">{formatDate(user.createdAt)}</td><td className="px-3 py-3 font-black text-white">{user.trackCount}</td><td className="px-3 py-3 font-black text-white">{user.playlistCount}</td><td className="px-3 py-3 text-zinc-400">{user.likedTrackCount} / {user.recentTrackCount}</td><td className="px-3 py-3 font-black text-[#F0ABFC]">{user.chatMessageCount}</td></tr>)}</tbody></table>{!filteredUsers.length && <p className="p-8 text-center text-xs text-zinc-500">No users match this search.</p>}</div></section>}

      {section === 'content' && <div className="space-y-5"><section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><FileAudio className="h-4 w-4 text-sky-300" /> Catalog tracks <span className="text-xs font-medium text-zinc-500">{filteredTracks.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-3">Track</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Genre</th><th className="px-3 py-3">Length</th><th className="px-3 py-3">Plays</th><th className="px-3 py-3">Uploaded</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredTracks.map((track) => <tr key={track.id} className="hover:bg-white/[0.025]"><td className="px-5 py-3"><div className="flex items-center gap-3"><img src={track.coverUrl || DEFAULT_AVATAR_URL} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-xl object-cover" /><div className="min-w-0"><p className="max-w-[260px] truncate font-black text-white">{track.title}</p><p className="max-w-[260px] truncate text-[11px] text-zinc-500">{track.artist} · {track.album}</p></div></div></td><td className="px-3 py-3 text-zinc-300">@{track.owner?.username || 'unknown'}</td><td className="px-3 py-3 text-zinc-400">{track.genre || 'Unspecified'}</td><td className="px-3 py-3 font-mono text-zinc-400">{formatDuration(track.duration)}</td><td className="px-3 py-3 font-black text-[#F0ABFC]">{formatNumber(track.playCount)}</td><td className="whitespace-nowrap px-3 py-3 text-zinc-500">{formatDate(track.createdAt)}</td></tr>)}</tbody></table>{!filteredTracks.length && <p className="p-8 text-center text-xs text-zinc-500">No tracks match this search.</p>}</div></section><section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><ListMusic className="h-4 w-4 text-emerald-300" /> Playlists <span className="text-xs font-medium text-zinc-500">{filteredPlaylists.length} shown</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-black/20 text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-3">Playlist</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Tracks</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">ID</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredPlaylists.map((playlist) => <tr key={playlist.id} className="hover:bg-white/[0.025]"><td className="px-5 py-3"><p className="font-black text-white">{playlist.title}</p><p className="mt-1 max-w-[360px] truncate text-[11px] text-zinc-500">{playlist.description || 'No description'}</p></td><td className="px-3 py-3 text-zinc-300">@{playlist.owner?.username || 'unknown'}</td><td className="px-3 py-3 font-black text-white">{playlist.trackCount}</td><td className="whitespace-nowrap px-3 py-3 text-zinc-500">{formatDate(playlist.createdAt)}</td><td className="px-3 py-3 font-mono text-[10px] text-zinc-600">{playlist.id}</td></tr>)}</tbody></table>{!filteredPlaylists.length && <p className="p-8 text-center text-xs text-zinc-500">No playlists match this search.</p>}</div></section></div>}

      {section === 'activity' && <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><Activity className="h-4 w-4 text-sky-300" /> Activity feed</div><p className="mt-1 text-xs text-zinc-500">{snapshot.activity.length} recent events retained in this snapshot.</p></div><div className="divide-y divide-white/[0.06]">{snapshot.activity.filter((event) => !query || [event.title, event.detail, event.type, event.userId].some((value) => value.toLowerCase().includes(query.toLowerCase()))).map((event) => <div key={event.id} className="flex gap-3 p-4"><div className="mt-0.5 rounded-lg bg-white/[0.06] p-2 text-[#F0ABFC]"><Activity className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-white">{event.title}</p><span className="text-[10px] text-zinc-600">{formatDate(event.timestamp)}</span></div><p className="mt-1 text-xs leading-5 text-zinc-400">{event.detail}</p><p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{event.userId}</p></div></div>)}</div></section><section className={`${panelClass} overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><MessageSquare className="h-4 w-4 text-amber-300" /> Target AI DJ history</div><p className="mt-1 text-xs text-zinc-500">Conversation records for @{targetUser?.username || 'admin user'}.</p></div><div className="max-h-[700px] divide-y divide-white/[0.06] overflow-y-auto custom-scrollbar">{target.chatHistory.length ? target.chatHistory.map((message) => <div key={message.id} className="p-4"><div className="flex items-center justify-between gap-2"><span className={`text-[10px] font-black uppercase tracking-wider ${message.sender === 'user' ? 'text-[#F0ABFC]' : 'text-emerald-300'}`}>{message.sender === 'user' ? 'Prompt' : 'AI response'}</span><span className="text-[10px] text-zinc-600">{formatDate(message.timestamp)}</span></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-300">{message.text}</p>{message.webSearchUsed && <p className="mt-2 text-[10px] font-bold text-sky-300">Web search used · {message.searchQueries?.join(', ') || 'query not recorded'}</p>}</div>) : <p className="p-5 text-xs text-zinc-500">No AI DJ history for the target account.</p>}</div></section></div>}
    </div>
  );
};
