import React, { useState } from 'react';
import { Grid, Heart, Library, List, Mic2, Play, Plus } from 'lucide-react';
import { Artist, Playlist, Track } from '../../types';

interface LibraryViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: Artist[];
  onPlayTrack: (track: Track) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectAlbum?: (track: Track) => void;
  onSelectArtist?: (artist: Artist | string) => void;
  onOpenNewPlaylistModal: () => void;
  onOpenAddTrackModal?: () => void;
  onWipeAllTracks?: () => void;
  onToggleLike: (trackId: string) => void;
}

type LibraryFilter = 'liked' | 'playlists' | 'artists';

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  playlists,
  artists,
  onPlayTrack,
  onPlayPlaylist,
  onSelectPlaylist,
  onSelectAlbum,
  onSelectArtist,
  onOpenNewPlaylistModal,
  onOpenAddTrackModal,
  onToggleLike,
}) => {
  // Playlists open first so anything the user just created is immediately
  // visible when they return to Your Library.
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('playlists');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const likedTracks = tracks.filter((track) => track.isLiked);

  const emptyState = (icon: React.ReactNode, title: string, description: string, action?: React.ReactNode) => (
    <div className="rounded-3xl border border-white/[0.07] bg-[#181818]/80 px-6 py-14 text-center shadow-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">{icon}</div>
      <h2 className="mt-4 text-base font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">{description}</p>
      {action}
    </div>
  );

  return (
    <div className="workspace-screen min-h-full space-y-6 overflow-x-hidden pb-14 text-white select-none">
      <header className="workspace-card section-reveal relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#2b1738] via-[#19131f] to-[#121212] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#D946EF]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_14px_38px_rgba(168,85,247,0.3)]"><Library className="h-7 w-7" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D8B4FE]">Your collection</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your Library</h1>
              <p className="mt-1 text-xs text-zinc-400">Liked Songs · Playlists · Artists</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenAddTrackModal && <button type="button" onClick={onOpenAddTrackModal} className="control-press rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white">Upload</button>}
            <button type="button" onClick={onOpenNewPlaylistModal} className="control-press flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3 text-xs font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110"><Plus className="h-4 w-4" /> Create playlist</button>
          </div>
        </div>
      </header>

      <div className="workspace-card section-reveal flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#181818] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          {([
            { id: 'liked', label: `Liked Songs (${likedTracks.length})`, icon: Heart },
            { id: 'playlists', label: `Playlists (${playlists.length})`, icon: List },
            { id: 'artists', label: `Artists (${artists.length})`, icon: Mic2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setLibraryFilter(id)} className={`control-press flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition-all ${libraryFilter === id ? 'border-[#D946EF]/45 bg-[#D946EF]/15 text-[#F0ABFC]' : 'border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white'}`}><Icon className={`h-4 w-4 ${id === 'liked' && libraryFilter === id ? 'fill-current' : ''}`} /> {label}</button>
          ))}
        </div>

        {libraryFilter !== 'liked' && <div className="flex self-end rounded-xl border border-white/10 bg-black/20 p-1 sm:self-auto">
          <button type="button" onClick={() => setViewMode('grid')} className={`rounded-lg p-2 transition-colors ${viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-white'}`} aria-label="Grid view"><Grid className="h-4 w-4" /></button>
          <button type="button" onClick={() => setViewMode('list')} className={`rounded-lg p-2 transition-colors ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-white'}`} aria-label="List view"><List className="h-4 w-4" /></button>
        </div>}
      </div>

      {libraryFilter === 'liked' && (
        <section className="space-y-5">
          <div className="relative flex items-center justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-purple-800 via-fuchsia-800 to-pink-700 p-6 shadow-2xl">
            <div className="flex min-w-0 items-center gap-5"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-lg"><Heart className="h-8 w-8 fill-white" /></div><div className="min-w-0"><h2 className="truncate text-2xl font-black">Liked Songs</h2><p className="mt-1 text-xs font-medium text-white/75">{likedTracks.length} saved song{likedTracks.length === 1 ? '' : 's'}</p></div></div>
            <button type="button" onClick={() => likedTracks[0] && onPlayTrack(likedTracks[0])} disabled={likedTracks.length === 0} className="control-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-2xl hover:scale-105 disabled:opacity-40"><Play className="ml-0.5 h-5 w-5 fill-black" /></button>
          </div>

          {likedTracks.length === 0 ? emptyState(<Heart className="h-6 w-6" />, 'No liked songs yet', 'Tap the heart on any track to save it here.') : (
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#181818]/80 divide-y divide-white/[0.045]">
              {likedTracks.map((track) => <div key={track.id} data-track-id={track.id} data-context-type="track" onClick={() => onSelectAlbum?.(track)} className="group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-white/[0.06] sm:px-5">
                <button type="button" onClick={(event) => { event.stopPropagation(); onPlayTrack(track); }} className="control-press group/cover relative h-11 w-11 shrink-0 overflow-hidden rounded-xl"><img src={track.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover/cover:opacity-100"><Play className="h-4 w-4 fill-white" /></span></button>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{track.title}</p><button type="button" data-artist-id={track.userId} data-context-type="artist" onClick={(event) => { event.stopPropagation(); onSelectArtist?.(track.userId || ''); }} className="mt-1 truncate text-left text-[10px] text-zinc-500 hover:text-[#D946EF] hover:underline">{track.artist}</button></div>
                <button type="button" onClick={(event) => { event.stopPropagation(); onToggleLike(track.id); }} className="control-press rounded-xl p-2 text-[#D946EF]" aria-label={`Remove ${track.title} from Liked Songs`}><Heart className="h-4 w-4 fill-current" /></button>
                <span className="hidden font-mono text-[10px] text-zinc-500 sm:block">{Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}</span>
              </div>)}
            </div>
          )}
        </section>
      )}

      {libraryFilter === 'playlists' && (
        <section>
          {playlists.length === 0 ? emptyState(<List className="h-6 w-6" />, 'No playlists yet', 'Create your first playlist and it will appear here immediately.', <button type="button" onClick={onOpenNewPlaylistModal} className="control-press mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3 text-xs font-black"><Plus className="h-4 w-4" /> Create playlist</button>) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{playlists.map((playlist, index) => <article key={playlist.id} data-playlist-id={playlist.id} data-context-type="playlist" onClick={() => onSelectPlaylist(playlist)} style={{ '--stagger-index': index } as React.CSSProperties} className="stagger-item card-interactive group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#181818] p-3.5 shadow-xl hover:bg-[#282828]">
              <div className="relative aspect-square overflow-hidden rounded-xl shadow-lg"><img src={playlist.coverUrl} alt={playlist.title} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /><button type="button" onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist); }} disabled={playlist.trackIds.length === 0} className="mobile-card-action control-press absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] opacity-0 shadow-2xl group-hover:translate-y-0 group-hover:opacity-100 disabled:opacity-40"><Play className="ml-0.5 h-5 w-5 fill-white" /></button></div>
              <h3 className="mt-3 truncate text-sm font-black transition-colors group-hover:text-[#F0ABFC]">{playlist.title}</h3><p className="mt-1 truncate text-[10px] text-zinc-500">Playlist · {playlist.trackCount} tracks</p>
            </article>)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#181818]/80 divide-y divide-white/[0.045]">{playlists.map((playlist) => <div key={playlist.id} data-playlist-id={playlist.id} data-context-type="playlist" onClick={() => onSelectPlaylist(playlist)} className="group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-white/[0.06] sm:px-5"><img src={playlist.coverUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black group-hover:text-[#F0ABFC]">{playlist.title}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{playlist.description || `${playlist.trackCount} tracks`}</p></div><span className="hidden text-[10px] font-bold text-zinc-500 sm:block">{playlist.trackCount} tracks</span><button type="button" onClick={(event) => { event.stopPropagation(); onPlayPlaylist(playlist); }} disabled={playlist.trackIds.length === 0} className="control-press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-[#A855F7] disabled:opacity-40"><Play className="h-4 w-4 fill-white" /></button></div>)}</div>
          )}
        </section>
      )}

      {libraryFilter === 'artists' && (
        <section>
          {artists.length === 0 ? emptyState(<Mic2 className="h-6 w-6" />, 'No followed artists yet', 'Follow an artist from their profile to keep them in Your Library.') : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{artists.map((artist, index) => <article key={artist.id} data-artist-id={artist.id} data-context-type="artist" onClick={() => onSelectArtist?.(artist)} style={{ '--stagger-index': index } as React.CSSProperties} className="stagger-item group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#181818] p-4 text-center shadow-xl hover:bg-[#282828]"><img src={artist.avatarUrl} alt={artist.name} referrerPolicy="no-referrer" className="mx-auto aspect-square w-full rounded-full border border-white/[0.08] object-cover shadow-xl transition-transform duration-300 group-hover:scale-[1.03]" /><h3 className="mt-3 truncate text-sm font-black group-hover:text-[#F0ABFC]">{artist.name}</h3><p className="mt-1 text-[10px] text-zinc-500">Artist</p></article>)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#181818]/80 divide-y divide-white/[0.045]">{artists.map((artist) => <div key={artist.id} data-artist-id={artist.id} data-context-type="artist" onClick={() => onSelectArtist?.(artist)} className="group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-white/[0.06] sm:px-5"><img src={artist.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full border border-white/[0.08] object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black group-hover:text-[#F0ABFC]">{artist.name}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{artist.totalStreamsLabel || 'Artist'}</p></div></div>)}</div>
          )}
        </section>
      )}
    </div>
  );
};
