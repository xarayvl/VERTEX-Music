import React, { useState, useEffect } from 'react';
import { X, Sparkles, Image, Disc, Music2, Edit3, ShieldAlert } from 'lucide-react';
import { Track } from '../../types';

interface EditTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  userId?: string;
  onTrackUpdated: (updatedTrack: Track) => void;
}

export const EditTrackModal: React.FC<EditTrackModalProps> = ({
  isOpen,
  onClose,
  track,
  userId,
  onTrackUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [releaseType, setReleaseType] = useState<'Single' | 'EP' | 'Album'>('Single');
  const [releaseTitle, setReleaseTitle] = useState('');
  const [copyright, setCopyright] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [genre, setGenre] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState(''); // only set when the user picks a NEW audio file to replace the existing one
  const [duration, setDuration] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when track changes or modal opens
  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setGenre(track.genre || '');
      setCoverUrl(track.coverUrl || '');
      setCopyright(track.copyright || '');
      setReleaseYear(track.releaseYear || (track.createdAt ? new Date(track.createdAt).getFullYear() : new Date().getFullYear()));
      setAudioUrl('');
      setDuration(null);
      setNewFileName('');
      setNewFileSize('');
      setError(null);

      const normalizedReleaseType: 'Single' | 'EP' | 'Album' =
        String(track.releaseType || '').toUpperCase() === 'EP'
          ? 'EP'
          : String(track.releaseType || '').toUpperCase() === 'ALBUM' || (track.album && track.album !== 'Single')
            ? 'Album'
            : 'Single';
      setReleaseType(normalizedReleaseType);
      setReleaseTitle(normalizedReleaseType === 'Single' ? '' : (track.releaseTitle || track.album || ''));
    }
  }, [track, isOpen]);

  if (!isOpen || !track) return null;

  // Ownership check
  const isOwner = Boolean(userId && track.userId && track.userId === userId);

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCoverUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      setError('Please select a valid audio file (MP3, WAV, OGG, M4A, AAC).');
      return;
    }

    setError(null);
    setIsReadingFile(true);
    setNewFileName(file.name);
    setNewFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');

    try {
      const objectUrl = URL.createObjectURL(file);
      const audioEl = new Audio(objectUrl);
      audioEl.onloadedmetadata = () => {
        if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration)) {
          setDuration(Math.round(audioEl.duration));
        }
      };
    } catch (err) {
      console.warn('Metadata duration check error:', err);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) setAudioUrl(result);
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setError('Error reading selected audio file.');
      setIsReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Track title is required.');
      return;
    }
    if (!artist.trim()) {
      setError('Artist name is required.');
      return;
    }

    if (releaseType !== 'Single' && !releaseTitle.trim()) {
      setError('A release title is required for an EP or album.');
      return;
    }
    const finalAlbum = releaseType === 'Single' ? 'Single' : releaseTitle.trim();

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/tracks/${track.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          userId,
          title: title.trim(),
          album: finalAlbum,
          releaseType: releaseType.toUpperCase(),
          releaseTitle: releaseType === 'Single' ? title.trim() : finalAlbum,
          genre,
          coverUrl: coverUrl.trim() || track.coverUrl,
          audioUrl: audioUrl || undefined, // only sent when a new file was picked; backend keeps existing audio otherwise
          duration: duration ?? undefined,
          copyright: copyright.trim() || undefined,
          releaseYear: Number(releaseYear) || new Date().getFullYear(),
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          `Server returned an unexpected response (status ${res.status}). This usually means the request payload was too large or the server hit an error before it could respond with JSON. Try again, and if it keeps happening, try replacing the audio file (it may still be stored as inline data instead of a proper upload).`
        );
      }

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          throw new Error('Your session expired. Please log in again, then retry saving.');
        }
        if (res.status === 403) {
          throw new Error('403 Forbidden: You do not have permission to edit this track.');
        }
        throw new Error(data.error || 'Failed to update track metadata.');
      }

      onTrackUpdated(data.track);
      onClose();
    } catch (err: any) {
      console.error('Update track error:', err);
      setError(err.message || 'An unexpected error occurred while saving changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#18181a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#202024]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-[#A855F7] to-[#D946EF] text-white shadow-lg">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Edit Track Metadata</h2>
              <p className="text-xs text-zinc-400">Update everything from the original upload: title, artist, artwork, audio file, and more</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {!isOwner ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Ownership Authorization Required</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              You are not authorized to edit this track. Only the original uploader (Owner ID: <span className="font-mono text-zinc-300">{track.userId}</span>) can edit its metadata.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs font-semibold flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Track Title & Artist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Track Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Drive"
                  className="w-full px-3.5 py-2.5 bg-[#282828] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={artist}
                  disabled
                  readOnly
                  title="Artist name can't be changed here."
                  className="w-full px-3.5 py-2.5 bg-[#1e1e1e] border border-white/5 rounded-xl text-sm text-zinc-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Replace Audio File */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Audio File</span>
                <span className="text-[10px] text-zinc-500 lowercase font-normal">Optional — only if you want to replace it</span>
              </label>
              <div className="flex items-center gap-2 p-2.5 bg-[#282828] border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Music2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">
                    {newFileName ? `${newFileName} (${newFileSize})` : 'Current uploaded audio file'}
                  </span>
                </div>
                <label className="cursor-pointer px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors">
                  <span>{isReadingFile ? 'Reading...' : 'Replace'}</span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                    onChange={handleAudioFileUpload}
                    disabled={isReadingFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Album & Genre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Release Type
                </label>
                <select
                  value={releaseType}
                  onChange={(event) => setReleaseType(event.target.value as 'Single' | 'EP' | 'Album')}
                  className="w-full px-3 py-2.5 bg-[#282828] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#D946EF]"
                >
                  <option value="Single">Single</option>
                  <option value="EP">EP</option>
                  <option value="Album">Album</option>
                </select>

                {releaseType !== 'Single' && (
                  <input
                    type="text"
                    value={releaseTitle}
                    onChange={(event) => setReleaseTitle(event.target.value)}
                    placeholder={releaseType === 'EP' ? 'Enter EP title...' : 'Enter album title...'}
                    className="mt-2 w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Genre
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#282828] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#D946EF]"
                >
                  <option value="">No genre selected</option>
                  <option value="Synthwave">Synthwave</option>
                  <option value="Cyberpunk">Cyberpunk</option>
                  <option value="Lofi / Chill">Lofi / Chill</option>
                  <option value="Pop">Pop</option>
                  <option value="EDM / Dance">EDM / Dance</option>
                  <option value="Hip Hop / Trap">Hip Hop / Trap</option>
                  <option value="Rock">Rock</option>
                </select>
              </div>
            </div>

            {/* Copyright & Release Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Copyright / Label
                </label>
                <input
                  type="text"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  placeholder="e.g. © 2026 Vertex Records"
                  className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Release Year
                </label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
            </div>

            {/* Cover Artwork URL */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1 flex justify-between">
                <span>Cover Artwork URL</span>
                <span className="text-[10px] text-zinc-500 lowercase font-normal">Optional image link</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="Paste a real image URL"
                  className="flex-1 px-3.5 py-2 bg-[#282828] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
                <label className="cursor-pointer px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center space-x-1.5 whitespace-nowrap transition-colors">
                  <Image className="w-4 h-4 text-zinc-300" />
                  <span>Upload</span>
                  <input type="file" accept="image/*" onChange={handleCoverFileUpload} className="hidden" />
                </label>
              </div>
              {coverUrl && (
                <div className="mt-2 flex items-center space-x-3 p-2 bg-black/40 rounded-xl border border-white/5">
                  <img
                    src={coverUrl}
                    alt="Cover preview"
                    className="w-10 h-10 object-cover rounded-lg border border-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-xs text-zinc-400 truncate">Artwork Preview</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isReadingFile}
                className="px-6 py-2.5 bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isReadingFile ? (
                  <span>Reading Audio File...</span>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
