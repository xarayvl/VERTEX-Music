import React, { useState, useRef } from 'react';
import { X, Music, Upload, Link, Sparkles, Image, Check, FileAudio, AlertCircle, GripVertical, ArrowUp, ArrowDown, Trash2, ListMusic } from 'lucide-react';
import { Track } from '../../types';

interface AlbumTrackItem {
  clientId: string;
  title: string;
  audioUrl: string;
  duration: number;
  fileName: string;
  fileSize: string;
}

interface AddTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userProfileName?: string;
  existingAlbums?: string[];
  tracks?: Track[];
  onTrackAdded: (newTrack: Track) => void;
}

export const AddTrackModal: React.FC<AddTrackModalProps> = ({
  isOpen,
  onClose,
  userId,
  userProfileName,
  existingAlbums,
  tracks,
  onTrackAdded,
}) => {
  const [title, setTitle] = useState('');
  const [releaseType, setReleaseType] = useState('Single');
  const [album, setAlbum] = useState('__NEW__');
  const [customAlbumName, setCustomAlbumName] = useState('');
  const [copyright, setCopyright] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioSourceType, setAudioSourceType] = useState<'upload' | 'url' | 'ai-gen'>('upload');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  // Multi-track tracklist state, used for Album and EP releases.
  // Lets the user select several audio files at once and drag-reorder them
  // to decide which track number each song gets on the release.
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackItem[]>([]);
  const [isReadingMultiFiles, setIsReadingMultiFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>('lyria-3-clip-preview');
  const [isGeneratingAiMusic, setIsGeneratingAiMusic] = useState(false);

  const [loadedFileName, setLoadedFileName] = useState('');
  const [loadedFileSize, setLoadedFileSize] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultReleaseTypes = ['Single', 'EP', 'Album'];

  const customAlbumList = React.useMemo(() => {
    const list = (existingAlbums || [])
      .concat(tracks?.map((t) => t.album).filter(Boolean) as string[])
      .filter((name) => name && !defaultReleaseTypes.includes(name));
    return Array.from(new Set(list));
  }, [existingAlbums, tracks]);

  React.useEffect(() => {
    if (audioSourceType !== 'url') return;
    const candidate = audioUrl.trim();
    setDuration(0);
    if (!/^https?:\/\//i.test(candidate)) return;

    const audioEl = new Audio(candidate);
    audioEl.preload = 'metadata';
    audioEl.onloadedmetadata = () => {
      if (audioEl.duration && Number.isFinite(audioEl.duration)) {
        setDuration(Math.max(1, Math.round(audioEl.duration)));
        setError(null);
      }
    };
    audioEl.onerror = () => setError('The audio URL could not be loaded or does not point to playable audio.');
    return () => {
      audioEl.src = '';
    };
  }, [audioUrl, audioSourceType]);

  const selectAudioSource = (nextType: 'upload' | 'url' | 'ai-gen') => {
    if (nextType === audioSourceType) return;
    setAudioSourceType(nextType);
    setAudioUrl('');
    setDuration(0);
    setLoadedFileName('');
    setLoadedFileSize('');
    setError(null);
  };

  if (!isOpen) return null;

  const handleGenerateAiMusic = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a music description prompt.');
      return;
    }
    setError(null);
    setIsGeneratingAiMusic(true);
    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          model: aiModel,
          title: title.trim() || undefined,
          genre,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate AI music');
      }

      if (!data.audioUrl) throw new Error('The provider returned no playable audio.');
      setAudioUrl(data.audioUrl);
      if (!title.trim() && data.suggestedTitle) setTitle(data.suggestedTitle);
      setDuration(Number(data.duration) || 0);
      setLoadedFileName(`AI Lyria Track (${aiModel === 'lyria-3-pro-preview' ? 'Full Track' : '30s Clip'})`);
      setLoadedFileSize('AI Audio WAV');
    } catch (err: any) {
      setError(err.message || 'Error generating AI music with Lyria model.');
    } finally {
      setIsGeneratingAiMusic(false);
    }
  };

  const readAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const audioEl = new Audio(objectUrl);
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      audioEl.preload = 'metadata';
      audioEl.onloadedmetadata = () => {
        const value = audioEl.duration;
        cleanup();
        if (value && Number.isFinite(value)) resolve(Math.max(1, Math.round(value)));
        else reject(new Error(`Could not determine the duration of "${file.name}".`));
      };
      audioEl.onerror = () => {
        cleanup();
        reject(new Error(`"${file.name}" is not playable audio.`));
      };
    });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string' && result) resolve(result);
        else reject(new Error(`Could not read "${file.name}".`));
      };
      reader.onerror = () => reject(new Error(`Error reading "${file.name}".`));
      reader.readAsDataURL(file);
    });

  const processAudioFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      setError('Please select a valid audio file (MP3, WAV, OGG, M4A, AAC, FLAC).');
      return;
    }

    setError(null);
    setIsReadingFile(true);
    setAudioUrl('');
    setDuration(0);
    setLoadedFileName(file.name);
    setLoadedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');

    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!title.trim()) setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));

    try {
      const [dataUrl, detectedDuration] = await Promise.all([
        readFileAsDataUrl(file),
        readAudioDuration(file),
      ]);
      setAudioUrl(dataUrl);
      setDuration(detectedDuration);
    } catch (error: any) {
      setAudioUrl('');
      setDuration(0);
      setError(error?.message || 'Error reading selected audio file.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAudioFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAudioFile(e.dataTransfer.files[0]);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCoverUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Reads a single File into an AlbumTrackItem (base64 audio + detected duration + a
  // title guessed from the filename), resolving once the FileReader finishes.
  const readFileAsAlbumTrack = async (file: File): Promise<AlbumTrackItem> => {
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const guessedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const [audioDataUrl, detectedDuration] = await Promise.all([
      readFileAsDataUrl(file),
      readAudioDuration(file),
    ]);

    return {
      clientId: crypto.randomUUID(),
      title: guessedTitle,
      audioUrl: audioDataUrl,
      duration: detectedDuration,
      fileName: file.name,
      fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
    };
  };

  const handleMultiFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)
    );
    if (files.length === 0) {
      setError('Please select valid audio files (MP3, WAV, OGG, M4A, AAC).');
      return;
    }
    setError(null);
    setIsReadingMultiFiles(true);
    try {
      const newItems = await Promise.all(files.map(readFileAsAlbumTrack));
      setAlbumTracks((prev) => [...prev, ...newItems]);
    } catch (err: any) {
      setError(err?.message || 'Error reading one or more audio files.');
    } finally {
      setIsReadingMultiFiles(false);
    }
  };

  const handleMultiFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultiFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  const handleMultiDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultiFilesSelected(e.dataTransfer.files);
    }
  };

  const updateAlbumTrackTitle = (index: number, newTitle: string) => {
    setAlbumTracks((prev) => prev.map((t, i) => (i === index ? { ...t, title: newTitle } : t)));
  };

  const removeAlbumTrack = (index: number) => {
    setAlbumTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveAlbumTrack = (index: number, direction: -1 | 1) => {
    setAlbumTracks((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // Native HTML5 drag & drop reordering — lets the user drag a tracklist row
  // to whatever position ("track 1", "track 2", etc.) it should play at.
  const handleTrackDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleTrackDragEnter = (index: number) => {
    setDragOverIndex(index);
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    setAlbumTracks((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = index;
  };

  const handleTrackDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError('You must be signed in before uploading music.');
      return;
    }
    if (!userProfileName?.trim()) {
      setError('Your artist name is missing. Add an artist name to your profile before uploading music.');
      return;
    }

    const isMultiTrackRelease = releaseType !== 'Single';

    if (isMultiTrackRelease) {
      if (albumTracks.length === 0) {
        setError('Please add at least one song to the tracklist.');
        return;
      }
      if (isReadingMultiFiles) {
        setError('Audio files are still loading, please wait a moment...');
        return;
      }
      if (album === '__NEW__' && !customAlbumName.trim()) {
        setError('A release title is required for an album or EP.');
        return;
      }
      if (albumTracks.some((track) => !track.title.trim() || !Number.isFinite(track.duration) || track.duration <= 0)) {
        setError('Every track needs a title and verified audio duration.');
        return;
      }
      await handleMultiTrackSubmit();
      return;
    }

    if (!title.trim()) {
      setError('Song Title is required.');
      return;
    }

    if (audioSourceType === 'upload' && !audioUrl) {
      setError('Please select an audio file (MP3, WAV, etc.) to upload.');
      return;
    }

    if (audioSourceType === 'url' && !/^https?:\/\//i.test(audioUrl.trim())) {
      setError('Enter a valid http(s) audio URL.');
      return;
    }

    if (audioSourceType === 'ai-gen' && !audioUrl) {
      setError('Generate a real AI audio file before publishing the track.');
      return;
    }

    if (isReadingFile) {
      setError('Audio file is still loading, please wait a moment...');
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('The audio duration could not be verified. Select a playable audio file or URL.');
      return;
    }

    setLoading(true);

    const finalCover = coverUrl.trim();
    const finalAudioUrl = audioUrl.trim();
    const artistName = userProfileName.trim();
    const finalAlbumName = album === '__NEW__' ? (customAlbumName.trim() || 'Single') : album;

    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          title: title.trim(),
          artist: artistName,
          album: finalAlbumName.trim() || 'Single',
          releaseType,
          releaseTitle: releaseType === 'Single' ? title.trim() : finalAlbumName.trim() || 'Single',
          releaseId: crypto.randomUUID(),
          copyright: copyright.trim() || undefined,
          releaseYear: Number(releaseYear) || new Date().getFullYear(),
          genre,
          duration,
          audioUrl: finalAudioUrl,
          coverUrl: finalCover,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Response was not JSON (e.g. server HTML error page or 413)
      }

      if (!res.ok || !data?.success) {
        setError(data?.error || `Upload failed with status ${res.status}. Please try again.`);
        setLoading(false);
        return;
      }

      onTrackAdded(data.track);
      onClose();
    } catch (err: any) {
      console.error('Track upload error:', err);
      setError(err?.message || 'Server error saving track to database.');
    } finally {
      setLoading(false);
    }
  };

  // Uploads every track in the album tracklist, in the exact order the user
  // arranged them, tagging each with a shared releaseId + sequential
  // trackNumber so the release page (AlbumView) can list them in that order.
  const handleMultiTrackSubmit = async () => {
    setLoading(true);
    setUploadProgress({ current: 0, total: albumTracks.length });

    const finalCover = coverUrl.trim();
    const artistName = userProfileName?.trim();
    if (!userId || !artistName) {
      setError('Your signed-in artist profile is required before uploading an album.');
      setLoading(false);
      setUploadProgress(null);
      return;
    }
    const finalAlbumName = (album === '__NEW__' ? customAlbumName.trim() : album).trim();
    const sharedReleaseId = crypto.randomUUID();

    const token = localStorage.getItem('vertex_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const createdTracks: Track[] = [];

    try {
      // Uploaded sequentially (not Promise.all) so track order is
      // deterministic and the server isn't hit with a burst of large
      // base64 audio payloads at once.
      for (let i = 0; i < albumTracks.length; i++) {
        const item = albumTracks[i];
        setUploadProgress({ current: i + 1, total: albumTracks.length });

        const res = await fetch('/api/tracks', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId,
            title: (item.title || item.fileName).trim(),
            artist: artistName,
            album: finalAlbumName,
            releaseType,
            releaseTitle: finalAlbumName,
            releaseId: sharedReleaseId,
            copyright: copyright.trim() || undefined,
            releaseYear: Number(releaseYear) || new Date().getFullYear(),
            genre,
            duration: item.duration,
            audioUrl: item.audioUrl,
            coverUrl: finalCover,
            trackNumber: i + 1,
          }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // Response wasn't JSON (server error page, etc.)
        }

        if (!res.ok || !data?.success) {
          throw new Error(
            data?.error || `"${item.title}" failed to upload (status ${res.status}).`
          );
        }

        createdTracks.push(data.track);
      }

      createdTracks.forEach((t) => onTrackAdded(t));
      onClose();
    } catch (err: any) {
      console.error('Album tracklist upload error:', err);
      if (createdTracks.length > 0) {
        await Promise.allSettled(
          createdTracks.map((track) =>
            fetch(`/api/tracks/${track.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
          )
        );
      }
      setError((err?.message || 'Server error saving tracklist.') + ' No partial release was kept.');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const fieldClass =
    'w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10';
  const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400';
  const isMultiTrackRelease = releaseType !== 'Single';
  const releaseName = isMultiTrackRelease
    ? album === '__NEW__'
      ? customAlbumName.trim() || `Untitled ${releaseType}`
      : album
    : title.trim() || 'Untitled single';
  const totalReleaseDuration = isMultiTrackRelease
    ? albumTracks.reduce((total, track) => total + track.duration, 0)
    : duration;
  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'Not ready';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <section className="workspace-screen min-h-full w-full bg-[#121212] text-white select-none">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <header className="workspace-header flex items-start justify-between gap-5 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)]">
              <Music className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">
                <Sparkles className="h-3.5 w-3.5" /> Artist workspace
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Upload music</h1>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">Build a release, verify its audio and publish it from the main panel.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="control-press rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="Close music uploader"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          {error && (
            <div className="section-reveal flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <span>{error}</span>
            </div>
          )}

          <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Release format</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">What are you publishing?</h2>
              </div>
              <span className="w-fit rounded-full border border-[#D946EF]/25 bg-[#D946EF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F0ABFC]">
                Publishing as {userProfileName?.trim() || 'your artist account'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {defaultReleaseTypes.map((type, index) => {
                const active = releaseType === type;
                const copy = type === 'Single' ? 'One track' : type === 'EP' ? 'Short multi-track release' : 'Full multi-track release';
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReleaseType(type)}
                    style={{ '--stagger-index': index } as React.CSSProperties}
                    className={`stagger-item control-press flex min-h-20 items-center justify-between rounded-2xl border px-4 text-left transition-all ${
                      active
                        ? 'border-[#C084FC]/70 bg-gradient-to-r from-[#A855F7]/30 to-[#D946EF]/20 shadow-[0_10px_30px_rgba(168,85,247,0.16)]'
                        : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.15] hover:bg-white/[0.07]'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-black ${active ? 'text-white' : 'text-zinc-300'}`}>{type}</p>
                      <p className="mt-1 text-[10px] font-semibold text-zinc-500">{copy}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white/15 text-[#F0ABFC]' : 'bg-white/5 text-zinc-500'}`}>
                      {type === 'Single' ? <FileAudio className="h-4 w-4" /> : <ListMusic className="h-4 w-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-6">
              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f1728] to-[#181818] p-5 sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Audio files</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight">{isMultiTrackRelease ? 'Build the tracklist' : 'Choose an audio source'}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-400">
                    {isMultiTrackRelease ? `${albumTracks.length} track${albumTracks.length === 1 ? '' : 's'}` : formatDuration(duration)}
                  </span>
                </div>

                {!isMultiTrackRelease && (
                  <div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {([
                        { key: 'upload', label: 'Upload audio', icon: Upload },
                        { key: 'url', label: 'Audio URL', icon: Link },
                        { key: 'ai-gen', label: 'Lyria AI', icon: Sparkles },
                      ] as const).map(({ key, label, icon: Icon }, index) => {
                        const active = audioSourceType === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => selectAudioSource(key)}
                            style={{ '--stagger-index': index } as React.CSSProperties}
                            className={`stagger-item control-press flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition-all ${
                              active
                                ? 'border-[#C084FC]/70 bg-[#A855F7]/20 text-[#F0ABFC] shadow-[0_10px_28px_rgba(168,85,247,0.12)]'
                                : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:bg-white/[0.07] hover:text-white'
                            }`}
                          >
                            <Icon className="h-4 w-4" /> {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5">
                      {audioSourceType === 'upload' && (
                        <div
                          onDragOver={(event) => {
                            event.preventDefault();
                            setIsDragOver(true);
                          }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleDrop}
                          className={`relative overflow-hidden rounded-3xl border-2 border-dashed px-5 py-10 text-center transition-all ${
                            isDragOver
                              ? 'border-[#D946EF] bg-[#D946EF]/10'
                              : audioUrl
                              ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
                              : 'border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/[0.025]'
                          }`}
                        >
                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="audio-file-input"
                          />

                          {isReadingFile ? (
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#D946EF] border-t-transparent" />
                              <div>
                                <p className="text-sm font-black">Reading audio metadata</p>
                                <p className="mt-1 text-xs text-zinc-500">Verifying that the file is playable.</p>
                              </div>
                            </div>
                          ) : audioUrl ? (
                            <div className="flex flex-col items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                                <Check className="h-6 w-6" />
                              </div>
                              <div className="max-w-full">
                                <p className="mx-auto max-w-md truncate text-sm font-black text-white">{loadedFileName}</p>
                                <p className="mt-1 text-xs font-semibold text-emerald-300">{loadedFileSize} · {formatDuration(duration)} · Ready</p>
                              </div>
                              <label htmlFor="audio-file-input" className="control-press cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white">
                                Choose a different file
                              </label>
                            </div>
                          ) : (
                            <label htmlFor="audio-file-input" className="flex cursor-pointer flex-col items-center gap-3">
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#A855F7]/15 text-[#E879F9] shadow-[0_12px_30px_rgba(168,85,247,0.12)]">
                                <FileAudio className="h-7 w-7" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">Drop an audio file here</p>
                                <p className="mt-1 text-xs text-zinc-500">or click to browse · MP3, WAV, OGG, M4A, AAC and FLAC</p>
                              </div>
                            </label>
                          )}
                        </div>
                      )}

                      {audioSourceType === 'url' && (
                        <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5">
                          <label className={labelClass}>Direct audio URL</label>
                          <div className="relative">
                            <Link className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="url"
                              value={audioUrl}
                              onChange={(event) => setAudioUrl(event.target.value)}
                              placeholder="https://example.com/song.mp3"
                              className={`${fieldClass} pl-11`}
                            />
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                            <span className="text-zinc-500">The URL must expose playable audio metadata.</span>
                            <span className={duration > 0 ? 'font-bold text-emerald-300' : 'font-semibold text-zinc-600'}>{formatDuration(duration)}</span>
                          </div>
                        </div>
                      )}

                      {audioSourceType === 'ai-gen' && (
                        <div className="rounded-3xl border border-[#A855F7]/25 bg-[#17121d] p-5 sm:p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#A855F7]/15 text-[#F0ABFC]">
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black">Lyria music generator</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">Only real provider audio can be published.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1.5">
                              <button
                                type="button"
                                onClick={() => setAiModel('lyria-3-clip-preview')}
                                className={`control-press rounded-xl px-3 py-2 text-[10px] font-black ${aiModel === 'lyria-3-clip-preview' ? 'bg-[#D946EF] text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
                              >
                                30s preview
                              </button>
                              <button
                                type="button"
                                onClick={() => setAiModel('lyria-3-pro-preview')}
                                className={`control-press rounded-xl px-3 py-2 text-[10px] font-black ${aiModel === 'lyria-3-pro-preview' ? 'bg-[#D946EF] text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
                              >
                                Full track
                              </button>
                            </div>
                          </div>

                          <div className="mt-5">
                            <label className={labelClass}>Describe the sound or mood</label>
                            <textarea
                              rows={4}
                              value={aiPrompt}
                              onChange={(event) => setAiPrompt(event.target.value)}
                              placeholder="Ambient lofi beat with soft piano, rain textures and subtle synth chords..."
                              className={`${fieldClass} resize-none`}
                            />
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className={`flex items-center gap-2 text-xs font-bold ${audioUrl ? 'text-emerald-300' : 'text-zinc-500'}`}>
                              {audioUrl ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                              {audioUrl ? `Generated audio ready · ${formatDuration(duration)}` : 'No generated audio yet'}
                            </div>
                            <button
                              type="button"
                              disabled={isGeneratingAiMusic}
                              onClick={handleGenerateAiMusic}
                              className="control-press flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3 text-xs font-black shadow-[0_12px_30px_rgba(168,85,247,0.2)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isGeneratingAiMusic ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Composing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" /> {audioUrl ? 'Regenerate audio' : 'Generate audio'}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isMultiTrackRelease && (
                  <div>
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleMultiDrop}
                      className={`rounded-3xl border-2 border-dashed px-5 py-8 text-center transition-all ${
                        isDragOver ? 'border-[#D946EF] bg-[#D946EF]/10' : 'border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/[0.025]'
                      }`}
                    >
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                        multiple
                        onChange={handleMultiFileInputChange}
                        className="hidden"
                        id="multi-audio-file-input"
                      />
                      <label htmlFor="multi-audio-file-input" className="flex cursor-pointer flex-col items-center gap-3">
                        {isReadingMultiFiles ? (
                          <>
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#D946EF] border-t-transparent" />
                            <div>
                              <p className="text-sm font-black">Reading selected tracks</p>
                              <p className="mt-1 text-xs text-zinc-500">Checking duration and playability.</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#A855F7]/15 text-[#E879F9]">
                              <ListMusic className="h-7 w-7" />
                            </div>
                            <div>
                              <p className="text-sm font-black">Add all release tracks</p>
                              <p className="mt-1 text-xs text-zinc-500">Multi-select files, then drag rows below to set the final order.</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>

                    {albumTracks.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {albumTracks.map((item, index) => (
                          <div
                            key={item.clientId}
                            draggable
                            onDragStart={() => handleTrackDragStart(index)}
                            onDragEnter={() => handleTrackDragEnter(index)}
                            onDragOver={(event) => event.preventDefault()}
                            onDragEnd={handleTrackDragEnd}
                            style={{ '--stagger-index': index } as React.CSSProperties}
                            className={`stagger-item flex items-center gap-2 rounded-2xl border p-2.5 transition-all ${
                              dragOverIndex === index ? 'border-[#D946EF] bg-[#D946EF]/10' : 'border-white/[0.08] bg-white/[0.035]'
                            }`}
                          >
                            <span className="cursor-grab text-zinc-600 hover:text-zinc-300 active:cursor-grabbing">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/25 font-mono text-xs font-black text-zinc-400">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(event) => updateAlbumTrackTitle(index, event.target.value)}
                                placeholder="Track title"
                                className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none placeholder:text-zinc-600 focus:border-[#C084FC]/70"
                              />
                              <p className="mt-1 truncate px-1 text-[9px] font-semibold text-zinc-600">{item.fileName} · {item.fileSize}</p>
                            </div>
                            <span className="hidden shrink-0 font-mono text-[10px] font-bold text-zinc-500 sm:block">{formatDuration(item.duration)}</span>
                            <div className="flex shrink-0 items-center">
                              <button type="button" onClick={() => moveAlbumTrack(index, -1)} disabled={index === 0} className="control-press rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-20" aria-label="Move track up"><ArrowUp className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => moveAlbumTrack(index, 1)} disabled={index === albumTracks.length - 1} className="control-press rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-20" aria-label="Move track down"><ArrowDown className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => removeAlbumTrack(index)} className="control-press rounded-lg p-1.5 text-red-400/70 hover:bg-red-400/10 hover:text-red-300" aria-label="Remove track"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-xs text-zinc-600">Your ordered tracklist will appear here.</div>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6">
              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-5">
                <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">
                  {coverUrl.trim() ? (
                    <img
                      key={coverUrl}
                      src={coverUrl.trim()}
                      alt="Release cover preview"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                      className="media-fade h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#312e81] via-[#581c87] to-[#111827]">
                      <Image className="h-16 w-16 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E9D5FF]">{releaseType} preview</p>
                    <h2 className="mt-1 truncate text-2xl font-black">{releaseName}</h2>
                    <p className="mt-1 truncate text-xs font-semibold text-zinc-300">{userProfileName?.trim() || 'Artist name unavailable'}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Tracks</p>
                    <p className="mt-1 text-sm font-black">{isMultiTrackRelease ? albumTracks.length : 1}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Duration</p>
                    <p className="mt-1 text-sm font-black">{formatDuration(totalReleaseDuration)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Year</p>
                    <p className="mt-1 text-sm font-black">{releaseYear}</p>
                  </div>
                </div>
              </section>

              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Release details</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight">Metadata and artwork</h2>
                </div>

                {!isMultiTrackRelease ? (
                  <div>
                    <label className={labelClass}>Song title *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. Midnight signal"
                      className={fieldClass}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Release title *</label>
                    <select value={album} onChange={(event) => setAlbum(event.target.value)} className={fieldClass}>
                      <option value="__NEW__">Create a new release</option>
                      {customAlbumList.map((albumName) => (
                        <option key={albumName} value={albumName}>{albumName}</option>
                      ))}
                    </select>
                    {album === '__NEW__' && (
                      <input
                        type="text"
                        value={customAlbumName}
                        onChange={(event) => setCustomAlbumName(event.target.value)}
                        placeholder={`Name this ${releaseType.toLowerCase()}`}
                        className={`${fieldClass} mt-3`}
                      />
                    )}
                  </div>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div>
                    <label className={labelClass}>Genre</label>
                    <select value={genre} onChange={(event) => setGenre(event.target.value)} className={fieldClass}>
                      <option value="">Select genre</option>
                      <option value="Synthwave">Synthwave</option>
                      <option value="Cyberpunk">Cyberpunk</option>
                      <option value="Lofi">Lofi</option>
                      <option value="Ambient">Ambient</option>
                      <option value="Electronic">Electronic</option>
                      <option value="Acoustic">Acoustic</option>
                      <option value="Pop">Pop</option>
                      <option value="Rock">Rock</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Release year</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={releaseYear}
                      onChange={(event) => setReleaseYear(parseInt(event.target.value, 10) || new Date().getFullYear())}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className={labelClass}>Copyright / label</label>
                  <input
                    type="text"
                    value={copyright}
                    onChange={(event) => setCopyright(event.target.value)}
                    placeholder="e.g. © 2026 Your Label"
                    className={fieldClass}
                  />
                </div>

                <div className="mt-5">
                  <label className={labelClass}>Cover artwork</label>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                    <input
                      type="text"
                      value={coverUrl}
                      onChange={(event) => setCoverUrl(event.target.value)}
                      placeholder="Image URL or upload a file"
                      className={`${fieldClass} min-w-0 flex-1`}
                    />
                    <label className="control-press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-black text-zinc-300 hover:bg-white/10 hover:text-white">
                      <Upload className="h-4 w-4" /> Upload
                      <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </section>

              <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-4 sm:p-5">
                {uploadProgress && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <span>Publishing release</span>
                      <span>{uploadProgress.current}/{uploadProgress.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] transition-[width] duration-300"
                        style={{ width: `${Math.min(100, (uploadProgress.current / Math.max(1, uploadProgress.total)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end lg:flex-col-reverse xl:flex-row">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || isReadingFile || isReadingMultiFiles}
                    className="control-press flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {uploadProgress ? `Saving ${uploadProgress.current} of ${uploadProgress.total}` : 'Publishing...'}
                      </>
                    ) : isReadingFile || isReadingMultiFiles ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Reading audio
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> {isMultiTrackRelease ? `Publish ${albumTracks.length || ''} track${albumTracks.length === 1 ? '' : 's'}`.replace('  ', ' ') : 'Publish single'}
                      </>
                    )}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </form>
      </div>
    </section>
  );
};
