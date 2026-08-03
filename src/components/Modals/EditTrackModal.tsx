import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Disc3,
  Edit3,
  FileAudio,
  Image,
  Music2,
  Save,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Track } from '../../types';
import { formatCopyright, stripCopyrightPrefix } from '../../utils/copyright';

interface EditTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  tracks?: Track[];
  userId?: string;
  onTrackUpdated: (updatedTrack: Track) => void;
  onTracksUpdated?: (updatedTracks: Track[]) => void;
}

interface TrackDraft {
  id: string;
  title: string;
  genre: string;
}

const genreOptions = ['', 'Synthwave', 'Cyberpunk', 'Lofi', 'Ambient', 'Electronic', 'Acoustic', 'Pop', 'EDM / Dance', 'Hip Hop / Trap', 'Rock'];

function inferAudioMimeType(file: File): string {
  if (file.type.startsWith('audio/')) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'ogg') return 'audio/ogg';
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'flac') return 'audio/flac';
  return '';
}

export const EditTrackModal: React.FC<EditTrackModalProps> = ({
  isOpen,
  onClose,
  track,
  tracks = [],
  userId,
  onTrackUpdated,
  onTracksUpdated,
}) => {
  const releaseTracks = useMemo(() => {
    if (!track) return [];
    const catalog = tracks.length > 0 ? tracks : [track];
    const siblings = track.releaseId
      ? catalog.filter((candidate) => candidate.userId === track.userId && candidate.releaseId === track.releaseId)
      : track.album && track.album !== 'Single'
        ? catalog.filter((candidate) => candidate.userId === track.userId && candidate.album === track.album)
        : [track];

    return (siblings.length > 0 ? siblings : [track]).slice().sort(
      (a, b) => (a.trackNumber || 0) - (b.trackNumber || 0) || (a.createdAt || '').localeCompare(b.createdAt || '')
    );
  }, [track, tracks]);

  const [releaseType, setReleaseType] = useState<'Single' | 'EP' | 'Album'>('Single');
  const [releaseTitle, setReleaseTitle] = useState('');
  const [copyright, setCopyright] = useState('');
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear());
  const [coverUrl, setCoverUrl] = useState('');
  const [trackDrafts, setTrackDrafts] = useState<TrackDraft[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const storedType = String(track?.releaseType || '').toUpperCase();
  const isCollection = releaseTracks.length > 1 || storedType === 'EP' || storedType === 'ALBUM' || Boolean(track?.album && track.album !== 'Single');
  const isOwner = Boolean(track && userId && track.userId === userId && releaseTracks.every((item) => item.userId === userId));

  useEffect(() => {
    if (!track || !isOpen) return;
    const normalizedType: 'Single' | 'EP' | 'Album' = storedType === 'EP'
      ? 'EP'
      : storedType === 'ALBUM' || isCollection
        ? 'Album'
        : 'Single';
    setReleaseType(normalizedType);
    setReleaseTitle(normalizedType === 'Single' ? track.title : (track.releaseTitle || track.album || track.title));
    setCopyright(stripCopyrightPrefix(track.copyright || ''));
    setReleaseYear(track.releaseYear || (track.createdAt ? new Date(track.createdAt).getFullYear() : new Date().getFullYear()));
    setCoverUrl(track.coverUrl || '');
    setTrackDrafts(releaseTracks.map((item) => ({ id: item.id, title: item.title || '', genre: item.genre || '' })));
    setAudioUrl('');
    setDuration(null);
    setNewFileName('');
    setNewFileSize('');
    setSaveProgress(0);
    setError(null);
  }, [isCollection, isOpen, releaseTracks, storedType, track]);

  if (!isOpen || !track) return null;

  const fieldClass = 'w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10';
  const compactFieldClass = 'w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:text-zinc-600 focus:border-[#C084FC]/70';
  const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400';
  const totalDuration = releaseTracks.reduce((total, item) => total + (Number(item.duration) || 0), 0);
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

  const updateDraft = (id: string, changes: Partial<TrackDraft>) => {
    setTrackDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...changes } : draft));
  };

  const moveDraft = (index: number, direction: -1 | 1) => {
    setTrackDrafts((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleCoverFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => setCoverUrl(String(loadEvent.target?.result || ''));
    reader.onerror = () => setError('Cover artwork could not be read.');
    reader.readAsDataURL(file);
  };

  const handleAudioFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const mimeType = inferAudioMimeType(file);
    if (!mimeType) {
      setError('Please select a valid audio file (MP3, WAV, OGG, M4A, AAC, or FLAC).');
      return;
    }

    setError(null);
    setIsReadingFile(true);
    setNewFileName(file.name);
    setNewFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);

    const objectUrl = URL.createObjectURL(file);
    const audioElement = new Audio(objectUrl);
    audioElement.preload = 'metadata';
    audioElement.onloadedmetadata = () => {
      const nextDuration = audioElement.duration;
      URL.revokeObjectURL(objectUrl);
      if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(Math.max(1, Math.round(nextDuration)));
    };
    audioElement.onerror = () => URL.revokeObjectURL(objectUrl);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setAudioUrl(String(loadEvent.target?.result || ''));
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setError('The replacement audio file could not be read.');
      setIsReadingFile(false);
    };
    const readableFile = file.type.startsWith('audio/') ? file : new Blob([file], { type: mimeType });
    reader.readAsDataURL(readableFile);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (trackDrafts.length === 0 || trackDrafts.some((draft) => !draft.title.trim())) {
      setError('Every track needs a title.');
      return;
    }
    if (releaseType !== 'Single' && !releaseTitle.trim()) {
      setError('The release needs an album or EP title.');
      return;
    }

    setLoading(true);
    setSaveProgress(0);
    setError(null);

    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const finalAlbum = releaseType === 'Single' ? 'Single' : releaseTitle.trim();
      let updatedTracks: Track[] = [];

      if (isCollection) {
        setSaveProgress(trackDrafts.length);
        const response = await fetch(`/api/releases/${track.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            releaseType: releaseType.toUpperCase(),
            releaseTitle: finalAlbum,
            coverUrl: coverUrl.trim() || track.coverUrl,
            copyright: formatCopyright(copyright),
            releaseYear: Number(releaseYear) || new Date().getFullYear(),
            tracks: trackDrafts.map((draft) => ({ id: draft.id, title: draft.title.trim(), genre: draft.genre.trim() })),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          if (response.status === 401) throw new Error('Your session expired. Please log in again.');
          if (response.status === 403) throw new Error('You do not have permission to edit this release.');
          throw new Error(payload?.error || 'Failed to update the release.');
        }
        updatedTracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      } else {
        const draft = trackDrafts[0];
        setSaveProgress(1);
        const response = await fetch(`/api/tracks/${draft.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            userId,
            title: draft.title.trim(),
            album: finalAlbum,
            releaseType: releaseType.toUpperCase(),
            releaseTitle: releaseType === 'Single' ? draft.title.trim() : finalAlbum,
            genre: draft.genre.trim(),
            coverUrl: coverUrl.trim() || track.coverUrl,
            audioUrl: audioUrl || undefined,
            audioFileName: audioUrl ? newFileName : undefined,
            duration: audioUrl ? duration ?? undefined : undefined,
            copyright: formatCopyright(copyright),
            releaseYear: Number(releaseYear) || new Date().getFullYear(),
            trackNumber: track.trackNumber,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          if (response.status === 401) throw new Error('Your session expired. Please log in again.');
          if (response.status === 403) throw new Error('You do not have permission to edit this track.');
          throw new Error(payload?.error || `Failed to update "${draft.title}".`);
        }
        updatedTracks = [payload.track];
      }

      if (onTracksUpdated) onTracksUpdated(updatedTracks);
      else updatedTracks.forEach(onTrackUpdated);
      onClose();
    } catch (submitError: any) {
      console.error('Release update error:', submitError);
      setError(submitError?.message || 'An unexpected error occurred while saving the release.');
    } finally {
      setLoading(false);
      setSaveProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-2 text-white animate-in fade-in duration-200 sm:p-4">
      <div className="mx-auto min-h-full w-full max-w-6xl rounded-[1.75rem] border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-300 sm:min-h-0">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 rounded-t-[1.75rem] border-b border-white/10 bg-[#121212]/95 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)]">
              <Edit3 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">
                <Sparkles className="h-3.5 w-3.5" /> Artist workspace
              </div>
              <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{isCollection ? 'Edit release' : 'Edit track'}</h1>
              <p className="mt-1 hidden text-xs text-zinc-400 sm:block">{isCollection ? 'Update the album and every song in its tracklist from one place.' : 'Refresh the song metadata, artwork, or audio source.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="control-press rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Close editor">
            <X className="h-5 w-5" />
          </button>
        </header>

        {!isOwner ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300"><ShieldAlert className="h-7 w-7" /></div>
            <h2 className="mt-4 text-lg font-black">Ownership required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">Only the original uploader can edit this track or release.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-7">
            {error && (
              <div className="section-reveal flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3.5 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Release format</p>
                <h2 className="mt-1 text-xl font-black">What are you editing?</h2>
              </div>
              <div className={`grid gap-3 ${isCollection ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {(isCollection ? ['EP', 'Album'] : ['Single', 'EP', 'Album']).map((type) => {
                  const active = releaseType === type;
                  return (
                    <button key={type} type="button" onClick={() => setReleaseType(type as 'Single' | 'EP' | 'Album')} className={`control-press flex min-h-16 items-center justify-between rounded-2xl border px-4 text-left ${active ? 'border-[#C084FC]/70 bg-gradient-to-r from-[#A855F7]/30 to-[#D946EF]/20 text-white' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:bg-white/[0.07]'}`}>
                      <div><p className="text-sm font-black">{type}</p><p className="mt-1 text-[10px] text-zinc-500">{type === 'Single' ? 'One song' : type === 'EP' ? 'Short release' : 'Full release'}</p></div>
                      {type === 'Single' ? <FileAudio className="h-5 w-5" /> : <Disc3 className="h-5 w-5" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f1728] to-[#181818] p-5 sm:p-7">
                  <div className="mb-5 flex items-end justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{isCollection ? 'Tracklist' : 'Song details'}</p><h2 className="mt-1 text-xl font-black">{isCollection ? 'Edit every track' : 'Track metadata'}</h2></div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-400">{trackDrafts.length} track{trackDrafts.length === 1 ? '' : 's'} · {formatDuration(totalDuration)}</span>
                  </div>

                  <div className="space-y-2.5">
                    {trackDrafts.map((draft, index) => (
                      <div key={draft.id} className="stagger-item rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3" style={{ '--stagger-index': index } as React.CSSProperties}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25 font-mono text-xs font-black text-zinc-400">{index + 1}</span>
                          <input value={draft.title} onChange={(event) => updateDraft(draft.id, { title: event.target.value })} placeholder="Track title" className={`${compactFieldClass} min-w-0 flex-1`} />
                          {isCollection && (
                            <div className="flex shrink-0">
                              <button type="button" onClick={() => moveDraft(index, -1)} disabled={index === 0} className="control-press rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-20" aria-label="Move track up"><ArrowUp className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => moveDraft(index, 1)} disabled={index === trackDrafts.length - 1} className="control-press rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-20" aria-label="Move track down"><ArrowDown className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <select value={draft.genre} onChange={(event) => updateDraft(draft.id, { genre: event.target.value })} className={compactFieldClass}>
                            {genreOptions.map((option) => <option key={option || 'none'} value={option}>{option || 'No genre selected'}</option>)}
                          </select>
                          <span className="px-1 text-right font-mono text-[10px] text-zinc-600">{formatDuration(releaseTracks.find((item) => item.id === draft.id)?.duration || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isCollection && (
                    <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${audioUrl ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-zinc-500'}`}>{audioUrl ? <Check className="h-5 w-5" /> : <Music2 className="h-5 w-5" />}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{newFileName || 'Keep current audio file'}</p><p className="mt-1 text-[10px] text-zinc-600">{newFileName ? `${newFileSize} · replacement ready` : 'Optional — choose a file only if the audio must change.'}</p></div>
                        <label className="control-press cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-zinc-300 hover:bg-white/10">
                          {isReadingFile ? 'Reading...' : 'Replace audio'}
                          <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={handleAudioFileUpload} disabled={isReadingFile} className="hidden" />
                        </label>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24">
                <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-5">
                  <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">
                    {coverUrl ? <img src={coverUrl} alt="Release cover preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#312e81] via-[#581c87] to-[#111827]"><Image className="h-16 w-16 text-white/30" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E9D5FF]">{releaseType}</p><h2 className="mt-1 truncate text-2xl font-black">{releaseType === 'Single' ? trackDrafts[0]?.title || track.title : releaseTitle || 'Untitled release'}</h2><p className="mt-1 truncate text-xs font-semibold text-zinc-300">{track.artist}</p></div>
                  </div>
                </section>

                <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
                  <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Release details</p><h2 className="mt-1 text-xl font-black">Metadata and artwork</h2></div>
                  {releaseType !== 'Single' && <div><label className={labelClass}>Album / EP title *</label><input value={releaseTitle} onChange={(event) => setReleaseTitle(event.target.value)} placeholder="Release title" className={fieldClass} /></div>}
                  <div className={releaseType !== 'Single' ? 'mt-5' : ''}><label className={labelClass}>Release year</label><input type="number" min="1900" max={new Date().getFullYear() + 1} value={releaseYear} onChange={(event) => setReleaseYear(parseInt(event.target.value, 10) || new Date().getFullYear())} className={fieldClass} /></div>
                  <div className="mt-5"><label className={labelClass}>Copyright / label</label><div className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] focus-within:border-[#C084FC]/70 focus-within:ring-4 focus-within:ring-[#A855F7]/10"><span className="flex shrink-0 select-none items-center border-r border-white/10 px-4 text-sm font-black">©</span><input value={copyright} onChange={(event) => setCopyright(stripCopyrightPrefix(event.target.value))} placeholder="2026 Your Label" className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600" /></div></div>
                  <div className="mt-5"><label className={labelClass}>Cover artwork</label><div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row"><input value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="Image URL or upload a file" className={`${fieldClass} min-w-0 flex-1`} /><label className="control-press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-black text-zinc-300 hover:bg-white/10"><Upload className="h-4 w-4" /> Upload<input type="file" accept="image/*" onChange={handleCoverFileUpload} className="hidden" /></label></div></div>
                </section>

                <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-4 sm:p-5">
                  {loading && <div className="mb-4"><div className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500"><span>Saving release</span><span>{saveProgress}/{trackDrafts.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] transition-[width]" style={{ width: `${(saveProgress / Math.max(1, trackDrafts.length)) * 100}%` }} /></div></div>}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row lg:flex-col-reverse xl:flex-row"><button type="button" onClick={onClose} disabled={loading} className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-50">Cancel</button><button type="submit" disabled={loading || isReadingFile} className="control-press flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:opacity-50">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving {saveProgress}/{trackDrafts.length}</> : <><Save className="h-4 w-4" /> Save {isCollection ? 'release' : 'changes'}</>}</button></div>
                </section>
              </aside>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
