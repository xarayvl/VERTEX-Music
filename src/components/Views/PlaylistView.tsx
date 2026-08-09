import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Copy,
  Edit3,
  Heart,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Playlist, Track } from '../../types';

interface PlaylistViewProps {
  playlist: Playlist | null;
  canManage: boolean;
  allTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  isShuffle: boolean;
  onPlayTrack: (track: Track, playbackContext?: Track[]) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onShufflePlaylist: (tracks: Track[]) => void;
  onToggleLike: (trackId: string) => void;
  onOpenEditModal: () => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean> | boolean;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean> | boolean;
  onSelectAlbum?: (track: Track) => void;
  onSelectArtist?: (artistId: string) => void;
  showToast?: (message: string) => void;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  canManage,
  allTracks,
  currentTrackId,
  isPlaying,
  isShuffle,
  onPlayTrack,
  onPlayPlaylist,
  onShufflePlaylist,
  onToggleLike,
  onOpenEditModal,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onSelectAlbum,
  onSelectArtist,
  showToast,
}) => {
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [pendingTrackIds, setPendingTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSongSearchQuery('');
    setShowAddSection(false);
    setPendingTrackIds(new Set());
  }, [playlist?.id]);

  useEffect(() => {
    if (!showAddSection) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAddSection(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddSection]);

  if (!playlist) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center p-8">
        <div className="rounded-3xl border border-white/10 bg-[#181818] px-10 py-12 text-center shadow-2xl">
          <p className="text-5xl font-black text-white">404</p>
          <h2 className="mt-3 text-xl font-bold text-white">Playlist not found</h2>
          <p className="mt-2 text-sm text-zinc-400">This playlist does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const playlistTracks = playlist.trackIds
    .map((id) => allTracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track));
  const normalizedQuery = songSearchQuery.trim().toLowerCase();
  const availableTracks = allTracks.filter((track) =>
    !playlist.trackIds.includes(track.id) && (
      !normalizedQuery ||
      track.title.toLowerCase().includes(normalizedQuery) ||
      track.artist.toLowerCase().includes(normalizedQuery) ||
      (track.genre || '').toLowerCase().includes(normalizedQuery) ||
      (track.releaseTitle || track.album || '').toLowerCase().includes(normalizedQuery)
    )
  );
  const totalDurationSeconds = playlistTracks.reduce((total, track) => total + track.duration, 0);
  const isCurrentPlaylistActive = playlistTracks.some((track) => track.id === currentTrackId);
  const isCurrentPlaylistPlaying = isCurrentPlaylistActive && isPlaying;
  const isCurrentPlaylistShuffled = isShuffle && isCurrentPlaylistActive;
  const activePlaylistTrack = playlistTracks.find((track) => track.id === currentTrackId);
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

  const handlePlayButton = () => {
    if (activePlaylistTrack) onPlayTrack(activePlaylistTrack, playlistTracks);
    else onPlayPlaylist(playlist);
  };

  const mutateTrack = async (track: Track, action: 'add' | 'remove') => {
    // Serialize playlist mutations. The server returns a complete playlist, so
    // overlapping writes based on the same snapshot could otherwise lose one.
    if (pendingTrackIds.size > 0) return;
    setPendingTrackIds((current) => new Set(current).add(track.id));
    try {
      const succeeded = action === 'add'
        ? await onAddTrackToPlaylist(playlist.id, track.id)
        : await onRemoveTrackFromPlaylist(playlist.id, track.id);
      if (succeeded) showToast?.(action === 'add' ? `Added "${track.title}" to ${playlist.title}` : `Removed "${track.title}" from ${playlist.title}`);
    } finally {
      setPendingTrackIds((current) => {
        const next = new Set(current);
        next.delete(track.id);
        return next;
      });
    }
  };

  const handleCopyLink = async () => {
    const copied = await copyToClipboard(`${window.location.origin}/playlist/${playlist.id}`);
    showToast?.(copied ? 'Playlist link copied.' : 'Could not copy the playlist link.');
  };

  return (
    <div className="workspace-screen min-h-full space-y-6 overflow-x-hidden pb-16 text-white select-none">
      <section data-playlist-id={playlist.id} data-context-type="playlist" className="workspace-card section-reveal relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#17131d] shadow-2xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${playlist.coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#151018] via-[#151018]/95 to-[#25152f]/80" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#D946EF]/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end md:p-9">
          <button type="button" onClick={canManage ? onOpenEditModal : undefined} className={`group relative mx-auto aspect-square w-44 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_22px_55px_rgba(0,0,0,0.5)] sm:w-52 md:mx-0 ${canManage ? 'cursor-pointer' : 'cursor-default'}`} aria-label={canManage ? 'Edit playlist cover and details' : undefined}>
            <img src={playlist.coverUrl} alt={playlist.title} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {canManage && <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-xs font-black opacity-0 transition-opacity group-hover:opacity-100"><Edit3 className="h-4 w-4" /> Edit playlist</span>}
          </button>

          <div className="min-w-0 flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D946EF]/25 bg-[#D946EF]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#F0ABFC]"><Sparkles className="h-3 w-3" /> Public playlist</span>
              {canManage && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">Owned by you</span>}
            </div>
            <h1 className="mt-4 break-words text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl lg:text-6xl">{playlist.title}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:mx-0">{playlist.description || 'A personal mix from your VERTEX Music library.'}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-zinc-400 md:justify-start">
              <span className="flex items-center gap-1.5 text-white"><ListMusic className="h-3.5 w-3.5 text-[#D946EF]" /> {playlistTracks.length} track{playlistTracks.length === 1 ? '' : 's'}</span>
              <span className="text-zinc-700">•</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatDuration(totalDurationSeconds)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-card section-reveal flex flex-col items-stretch gap-4 rounded-3xl border border-white/10 bg-[#181818] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
          <button type="button" onClick={handlePlayButton} disabled={playlistTracks.length === 0} className="control-press flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white shadow-[0_14px_34px_rgba(168,85,247,0.25)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" title={isCurrentPlaylistPlaying ? 'Pause playlist' : 'Play playlist'}>
            {isCurrentPlaylistPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="ml-0.5 h-6 w-6 fill-white" />}
          </button>
          <button type="button" onClick={() => onShufflePlaylist(playlistTracks)} disabled={playlistTracks.length === 0} className={`control-press flex h-11 items-center gap-2 rounded-2xl border px-4 text-xs font-black transition-all disabled:opacity-40 ${isCurrentPlaylistShuffled ? 'border-[#D946EF]/50 bg-[#D946EF]/15 text-[#F0ABFC]' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'}`} title={isCurrentPlaylistShuffled ? 'Turn shuffle off' : 'Shuffle playlist'}>
            <Shuffle className="h-4 w-4" /> <span className="hidden sm:inline">{isCurrentPlaylistShuffled ? 'Shuffling' : 'Shuffle'}</span>
          </button>
          {canManage && <button type="button" onClick={onOpenEditModal} className="control-press flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white"><Edit3 className="h-4 w-4 text-[#D946EF]" /> Edit</button>}
          {canManage && <button type="button" onClick={() => setShowAddSection(true)} className="control-press flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4" /> Add songs</button>}
          <button type="button" onClick={handleCopyLink} className="control-press flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white"><Copy className="h-4 w-4" /><span className="hidden sm:inline">Copy link</span></button>
        </div>

        {canManage && <button type="button" onClick={() => { if (window.confirm(`Delete "${playlist.title}" permanently?`)) onDeletePlaylist(playlist.id); }} className="control-press flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 text-xs font-black text-red-300 hover:bg-red-400/15"><Trash2 className="h-4 w-4" /> Delete</button>}
      </section>

      <section className="workspace-card section-reveal overflow-hidden rounded-3xl border border-white/10 bg-[#181818]">
        <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] px-4 py-4 sm:px-6">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Tracklist</p><h2 className="mt-1 text-xl font-black">Inside this playlist</h2></div>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[10px] font-bold text-zinc-500">{playlistTracks.length} songs</span>
        </div>

        {playlistTracks.length === 0 ? (
          <div className="p-10 text-center sm:p-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500"><Music className="h-6 w-6" /></div>
            <h3 className="mt-4 text-base font-black">This playlist is empty</h3>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">Add songs from your real catalog and they will appear here in playlist order.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.045]">
            {playlistTracks.map((track, index) => {
              const isSelected = track.id === currentTrackId;
              const pending = pendingTrackIds.has(track.id);
              return (
                <div key={track.id} data-track-id={track.id} data-context-type="track" onClick={() => onPlayTrack(track, playlistTracks)} className={`group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-colors sm:px-5 ${isSelected ? 'bg-[#D946EF]/10' : 'hover:bg-white/[0.055]'}`}>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onPlayTrack(track, playlistTracks); }} className={`control-press flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${isSelected ? 'bg-[#D946EF]/15 text-[#F0ABFC]' : 'bg-black/20 text-zinc-500 group-hover:text-white'}`} aria-label={isSelected && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}>
                    {isSelected && isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <span className="group-hover:hidden">{index + 1}</span>}
                    {!(isSelected && isPlaying) && <Play className="hidden h-3.5 w-3.5 fill-current group-hover:block" />}
                  </button>

                  <div className="flex min-w-0 items-center gap-3">
                    <img src={track.coverUrl} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-xl border border-white/[0.08] object-cover shadow" />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-black ${isSelected ? 'text-[#F0ABFC]' : 'text-white'}`}>{track.title}</p>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
                        <button type="button" data-artist-id={track.userId} data-context-type="artist" onClick={(event) => { event.stopPropagation(); onSelectArtist?.(track.userId); }} className="truncate hover:text-[#D946EF] hover:underline">{track.artist}</button>
                        <span>•</span>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onSelectAlbum?.(track); }} className="hidden truncate hover:text-white hover:underline sm:block">{track.releaseTitle || (track.album === 'Single' ? track.title : track.album)}</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onToggleLike(track.id); }} className={`control-press flex h-10 w-10 items-center justify-center rounded-xl ${track.isLiked ? 'text-[#D946EF]' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`} aria-label={track.isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}><Heart className={`h-4 w-4 ${track.isLiked ? 'fill-current' : ''}`} /></button>
                    <span className="hidden w-10 text-right font-mono text-[10px] text-zinc-500 sm:block">{formatDuration(track.duration)}</span>
                    {canManage && <button type="button" disabled={pendingTrackIds.size > 0} onClick={(event) => { event.stopPropagation(); void mutateTrack(track, 'remove'); }} className="control-press flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600 hover:bg-red-400/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-40" aria-label={`Remove ${track.title} from playlist`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canManage && showAddSection && createPortal(
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/80 p-3 text-white sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAddSection(false); }}>
        <section role="dialog" aria-modal="true" aria-label={`Add songs to ${playlist.title}`} className="workspace-card section-reveal flex max-h-[min(82dvh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[#D946EF]/20 bg-gradient-to-b from-[#211526] to-[#181818] shadow-[0_32px_100px_rgba(0,0,0,0.9)]">
          <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D8B4FE]">Build your mix</p><h2 className="mt-1 text-xl font-black">Add songs to {playlist.title}</h2><p className="mt-1 text-xs text-zinc-500">Search the catalog, preview a track or add it directly.</p></div>
            <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1 sm:w-72"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input autoFocus value={songSearchQuery} onChange={(event) => setSongSearchQuery(event.target.value)} placeholder="Search songs, artists, albums..." className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-11 pr-4 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#C084FC]/60 focus:ring-4 focus:ring-[#A855F7]/10" /></div><button type="button" onClick={() => setShowAddSection(false)} className="control-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white" aria-label="Close add songs"><X className="h-5 w-5" /></button></div>
          </header>

          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          {availableTracks.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-8 text-center text-xs text-zinc-500">{normalizedQuery ? 'No available tracks match this search.' : 'Every catalog track is already in this playlist.'}</div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {availableTracks.map((track, index) => {
                const pending = pendingTrackIds.has(track.id);
                return (
                  <div key={track.id} data-track-id={track.id} data-context-type="track" style={{ '--stagger-index': index } as React.CSSProperties} className="stagger-item flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2.5 hover:bg-white/[0.065]">
                    <button type="button" onClick={() => onPlayTrack(track)} className="control-press group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl" aria-label={`Preview ${track.title}`}><img src={track.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100"><Play className="h-4 w-4 fill-white" /></span></button>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{track.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{track.artist} · {track.releaseTitle || track.album}</p></div>
                    <button type="button" disabled={pendingTrackIds.size > 0} onClick={() => void mutateTrack(track, 'add')} className="control-press flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-3 text-[10px] font-black shadow-lg disabled:cursor-wait disabled:opacity-50">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}<span className="hidden xl:inline">Add</span></button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </section>
        </div>,
        document.body
      )}
    </div>
  );
};
