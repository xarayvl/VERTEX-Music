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
  const [genre, setGenre] = useState('Synthwave');
  const [duration, setDuration] = useState(180);
  const [audioSourceType, setAudioSourceType] = useState<'upload' | 'url' | 'ai-gen'>('upload');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  // Multi-track tracklist state, used when releaseType !== 'Single' (Album/EP/Compilation/Live Album).
  // Lets the user select several audio files at once and drag-reorder them
  // to decide which track number each song gets on the release.
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackItem[]>([]);
  const [isReadingMultiFiles, setIsReadingMultiFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [aiPrompt, setAiPrompt] = useState('Chill upbeat synthwave track with heavy bassline and warm pads');
  const [aiModel, setAiModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>('lyria-3-clip-preview');
  const [isGeneratingAiMusic, setIsGeneratingAiMusic] = useState(false);

  const [loadedFileName, setLoadedFileName] = useState('');
  const [loadedFileSize, setLoadedFileSize] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultReleaseTypes = ['Single', 'EP', 'Album', 'Compilation', 'Live Album'];

  const customAlbumList = React.useMemo(() => {
    const list = (existingAlbums || [])
      .concat(tracks?.map((t) => t.album).filter(Boolean) as string[])
      .filter((name) => name && !defaultReleaseTypes.includes(name));
    return Array.from(new Set(list));
  }, [existingAlbums, tracks]);

  React.useEffect(() => {
    if (audioSourceType === 'url' && audioUrl.trim().startsWith('http')) {
      try {
        const audioEl = new Audio(audioUrl.trim());
        audioEl.onloadedmetadata = () => {
          if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
            setDuration(Math.round(audioEl.duration));
          }
        };
      } catch (e) {
        console.warn('URL duration detection error:', e);
      }
    }
  }, [audioUrl, audioSourceType]);

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

      setAudioUrl(data.track.audioUrl);
      if (!title.trim()) {
        setTitle(data.track.title);
      }
      setDuration(data.track.duration);
      setLoadedFileName(`AI Lyria Track (${aiModel === 'lyria-3-pro-preview' ? 'Full Track' : '30s Clip'})`);
      setLoadedFileSize('AI Audio WAV');
    } catch (err: any) {
      setError(err.message || 'Error generating AI music with Lyria model.');
    } finally {
      setIsGeneratingAiMusic(false);
    }
  };

  const processAudioFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      setError('Please select a valid audio file (MP3, WAV, OGG, M4A, AAC).');
      return;
    }

    setError(null);
    setIsReadingFile(true);
    setLoadedFileName(file.name);
    setLoadedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');

    // Extract title from filename if title is empty
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!title.trim()) {
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    // Detect exact duration via Audio element
    try {
      const objectUrl = URL.createObjectURL(file);
      const audioEl = new Audio(objectUrl);
      audioEl.onloadedmetadata = () => {
        if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
          setDuration(Math.round(audioEl.duration));
        }
      };
    } catch (e) {
      console.warn('Metadata duration check error:', e);
    }

    // Read audio data as base64 data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAudioUrl(result);
      }
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setError('Error reading selected audio file.');
      setIsReadingFile(false);
    };
    reader.readAsDataURL(file);
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
  const readFileAsAlbumTrack = (file: File): Promise<AlbumTrackItem> => {
    return new Promise((resolve, reject) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const guessedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

      let detectedDuration = 180;
      try {
        const objectUrl = URL.createObjectURL(file);
        const probe = new Audio(objectUrl);
        probe.onloadedmetadata = () => {
          if (probe.duration && !isNaN(probe.duration) && isFinite(probe.duration)) {
            detectedDuration = Math.round(probe.duration);
          }
        };
      } catch {
        // Non-fatal: duration falls back to default.
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!result) {
          reject(new Error(`Could not read "${file.name}".`));
          return;
        }
        resolve({
          clientId: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title: guessedTitle,
          audioUrl: result,
          duration: detectedDuration,
          fileName: file.name,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        });
      };
      reader.onerror = () => reject(new Error(`Error reading "${file.name}".`));
      reader.readAsDataURL(file);
    });
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

    if (audioSourceType === 'ai-gen' && !audioUrl) {
      // Auto generate AI music if not yet generated
      await handleGenerateAiMusic();
    }

    if (isReadingFile) {
      setError('Audio file is still loading, please wait a moment...');
      return;
    }

    setLoading(true);

    const presetCovers: Record<string, string> = {
      Synthwave: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      Cyberpunk: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80',
      Lofi: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
      Ambient: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
      Acoustic: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    };

    const finalCover = coverUrl.trim() || presetCovers[genre] || presetCovers.Synthwave;
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
          releaseId: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

    const presetCovers: Record<string, string> = {
      Synthwave: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      Cyberpunk: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80',
      Lofi: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
      Ambient: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
      Acoustic: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    };

    const finalCover = coverUrl.trim() || presetCovers[genre] || presetCovers.Synthwave;
    const artistName = userProfileName?.trim();
    if (!userId || !artistName) {
      setError('Your signed-in artist profile is required before uploading an album.');
      setLoading(false);
      setUploadProgress(null);
      return;
    }
    const finalAlbumName = (album === '__NEW__' ? (customAlbumName.trim() || 'Untitled Release') : album).trim() || 'Untitled Release';
    const sharedReleaseId = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
      setError(
        (err?.message || 'Server error saving tracklist.') +
          (createdTracks.length > 0
            ? ` ${createdTracks.length} of ${albumTracks.length} track(s) were saved before the error.`
            : '')
      );
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-[#181818] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#A855F7]/30 to-[#D946EF]/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] flex items-center justify-center shadow-lg">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Upload New Song</h2>
              <p className="text-xs text-zinc-400">Upload MP3/audio files to play and save to database</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Release Type — chosen first so the right upload UI (single song vs. multi-track tracklist) shows below */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
              Release Type
            </label>
            <select
              value={releaseType}
              onChange={(e) => setReleaseType(e.target.value)}
              className="w-full px-3 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#D946EF]"
            >
              <option value="Single">Single</option>
              <option value="EP">EP</option>
              <option value="Album">Album</option>
              <option value="Compilation">Compilation</option>
              <option value="Live Album">Live Album</option>
            </select>
          </div>

          {/* Audio Source Selector (Single release only) */}
          {releaseType === 'Single' && (
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
              Audio Source
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setAudioSourceType('upload')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors ${
                  audioSourceType === 'upload'
                    ? 'bg-[#A855F7]/20 border-[#A855F7] text-[#C084FC]'
                    : 'bg-[#282828] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Audio</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioSourceType('url')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors ${
                  audioSourceType === 'url'
                    ? 'bg-[#A855F7]/20 border-[#A855F7] text-[#C084FC]'
                    : 'bg-[#282828] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                <span>Audio URL</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioSourceType('ai-gen')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors ${
                  audioSourceType === 'ai-gen'
                    ? 'bg-[#A855F7]/20 border-[#A855F7] text-[#C084FC]'
                    : 'bg-[#282828] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Music (Lyria)</span>
              </button>
            </div>

            {audioSourceType === 'upload' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`p-5 border-2 border-dashed rounded-xl transition-all text-center ${
                  isDragOver
                    ? 'border-[#D946EF] bg-[#D946EF]/10'
                    : audioUrl
                    ? 'border-[#D946EF]/50 bg-[#D946EF]/10'
                    : 'border-white/20 bg-[#282828]/50 hover:border-white/40'
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
                  <div className="flex flex-col items-center justify-center space-y-2 py-2">
                    <div className="w-6 h-6 border-2 border-[#D946EF] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-zinc-300 font-semibold">Reading audio file...</span>
                  </div>
                ) : audioUrl ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-[#D946EF]/20 text-[#D946EF] flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-white max-w-xs truncate mx-auto">{loadedFileName}</p>
                      <p className="text-[#D946EF] font-semibold text-[11px] mt-0.5">
                        Audio Ready ({loadedFileSize}) • {duration}s
                      </p>
                    </div>
                    <label
                      htmlFor="audio-file-input"
                      className="cursor-pointer text-[11px] font-bold text-[#D946EF] hover:underline pt-1"
                    >
                      Click to choose a different MP3
                    </label>
                  </div>
                ) : (
                  <label
                    htmlFor="audio-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#A855F7]/20 flex items-center justify-center text-[#D946EF]">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-200 font-bold block">
                        Drag & Drop or Click to choose MP3 File
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Supports MP3, WAV, OGG, M4A audio formats
                      </span>
                    </div>
                  </label>
                )}
              </div>
            )}

            {audioSourceType === 'url' && (
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://example.com/song.mp3"
                className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
              />
            )}

            {audioSourceType === 'ai-gen' && (
              <div className="p-4 bg-[#201c29] border border-[#A855F7]/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-[#D946EF]">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Lyria AI Music Generator</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={() => setAiModel('lyria-3-clip-preview')}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all ${
                        aiModel === 'lyria-3-clip-preview'
                          ? 'bg-[#D946EF] text-white shadow'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      30s Clip (Preview)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiModel('lyria-3-pro-preview')}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all ${
                        aiModel === 'lyria-3-pro-preview'
                          ? 'bg-[#D946EF] text-white shadow'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Full Track (Pro)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Describe the Music Style or Mood
                  </label>
                  <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Ambient lofi beat with soft piano, rain sounds, and subtle synth chords"
                    className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {audioUrl ? (
                    <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold">
                      <Check className="w-4 h-4" />
                      <span>Audio Generated & Ready!</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Powered by Lyria AI model</span>
                  )}

                  <button
                    type="button"
                    disabled={isGeneratingAiMusic}
                    onClick={handleGenerateAiMusic}
                    className="px-4 py-2 bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all active:scale-95"
                  >
                    {isGeneratingAiMusic ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Composing AI Music...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{audioUrl ? 'Regenerate Track' : 'Generate AI Music'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Multi-track Tracklist Builder (Album / EP / Compilation / Live Album) */}
          {releaseType !== 'Single' && (
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5 text-[#D946EF]" />
                <span>Tracklist ({albumTracks.length} song{albumTracks.length === 1 ? '' : 's'})</span>
              </label>

              {/* Multi-file dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleMultiDrop}
                className={`p-4 border-2 border-dashed rounded-xl transition-all text-center mb-3 ${
                  isDragOver
                    ? 'border-[#D946EF] bg-[#D946EF]/10'
                    : 'border-white/20 bg-[#282828]/50 hover:border-white/40'
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
                <label
                  htmlFor="multi-audio-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                >
                  {isReadingMultiFiles ? (
                    <>
                      <div className="w-6 h-6 border-2 border-[#D946EF] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-zinc-300 font-semibold">Reading audio files...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full bg-[#A855F7]/20 flex items-center justify-center text-[#D946EF]">
                        <FileAudio className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-xs text-zinc-200 font-bold">
                        Drag & Drop or Click to add song files (multi-select supported)
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Add as many songs as you like, then drag to reorder them below
                      </span>
                    </>
                  )}
                </label>
              </div>

              {/* Reorderable tracklist */}
              {albumTracks.length > 0 && (
                <div className="space-y-1.5">
                  {albumTracks.map((item, index) => (
                    <div
                      key={item.clientId}
                      draggable
                      onDragStart={() => handleTrackDragStart(index)}
                      onDragEnter={() => handleTrackDragEnter(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={handleTrackDragEnd}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                        dragOverIndex === index
                          ? 'border-[#D946EF] bg-[#D946EF]/10'
                          : 'border-white/10 bg-[#232323]'
                      }`}
                    >
                      <span className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="w-6 text-center text-xs font-mono font-bold text-zinc-400 flex-shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateAlbumTrackTitle(index, e.target.value)}
                        placeholder="Track title"
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#181818] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                      />
                      <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0 hidden sm:inline">
                        {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                      </span>
                      <div className="flex items-center flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveAlbumTrack(index, -1)}
                          disabled={index === 0}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-400 transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAlbumTrack(index, 1)}
                          disabled={index === albumTracks.length - 1}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-400 transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAlbumTrack(index)}
                          className="p-1 text-red-400/70 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {releaseType === 'Single' && (
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
              Song Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Favorite Song"
              className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
            />
          </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {releaseType !== 'Single' && (
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Release Title
                </label>
                <select
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="w-full px-3 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#D946EF]"
                >
                  <option value="__NEW__">+ Create New Release...</option>
                  {customAlbumList.map((alb) => (
                    <option key={alb} value={alb}>{alb}</option>
                  ))}
                </select>
                {album === '__NEW__' && (
                  <input
                    type="text"
                    value={customAlbumName}
                    onChange={(e) => setCustomAlbumName(e.target.value)}
                    placeholder="e.g. My Awesome Album"
                    className="mt-2 w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                )}
              </div>
            )}
            
            <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  COPYRIGHT / LABEL
                </label>
                <input
                  type="text"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  placeholder="e.g. © 2026 Vertex Records"
                  className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  RELEASE YEAR
                </label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(parseInt(e.target.value) || new Date().getFullYear())}
                  placeholder="e.g. 2026"
                  className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                Genre
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#D946EF]"
              >
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
          </div>

          {/* Cover Art */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              Cover Artwork Image URL (or Upload)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="Image URL or leave blank for genre artwork"
                className="flex-1 px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
              />
              <label className="cursor-pointer px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors">
                <Image className="w-4 h-4 text-zinc-300" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isReadingFile || isReadingMultiFiles}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-sm shadow-xl transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {loading && uploadProgress
                ? `Saving Track ${uploadProgress.current} of ${uploadProgress.total}...`
                : loading
                ? 'Saving Song to Database...'
                : isReadingFile || isReadingMultiFiles
                ? 'Reading Audio File(s)...'
                : releaseType !== 'Single'
                ? `Upload ${albumTracks.length || ''} Track${albumTracks.length === 1 ? '' : 's'}`.replace('  ', ' ')
                : 'Upload & Play Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
