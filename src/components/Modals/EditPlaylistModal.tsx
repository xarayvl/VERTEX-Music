import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Edit3, Image as ImageIcon, Loader2, Save, Sparkles, Upload, X } from 'lucide-react';
import { Playlist } from '../../types';
import { DEFAULT_COVER_URL } from '../../utils/profilePlaceholders';

interface EditPlaylistModalProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onSavePlaylist: (updatedPlaylist: Playlist) => Promise<boolean> | boolean;
}

const fieldClass = 'w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10';
const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400';
const MAX_COVER_BYTES = 8 * 1024 * 1024;

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  playlist,
  onClose,
  onSavePlaylist,
}) => {
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description);
      setCoverUrl(playlist.coverUrl);
      setCoverFileName('');
      setErrorMessage('');
      setIsSaving(false);
      setSavedSuccess(false);
    }
  }, [playlist, isOpen]);

  if (!isOpen || !playlist) return null;


  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setErrorMessage('Playlist cover must be smaller than 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setCoverUrl(reader.result);
      setCoverFileName(file.name);
      setErrorMessage('');
    };
    reader.onerror = () => setErrorMessage('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    setErrorMessage('');
    try {
      const succeeded = await onSavePlaylist({
        ...playlist,
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim() || playlist.coverUrl,
      });
      if (succeeded === false) {
        setErrorMessage('Playlist could not be updated.');
        return;
      }
      setSavedSuccess(true);
      window.setTimeout(onClose, 450);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-black/80 p-2 text-white select-none sm:items-center sm:p-6">
      <div className="relative my-auto w-full min-w-0 max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#121212] shadow-[0_32px_100px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-200 sm:rounded-[2rem]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D946EF]/15 blur-3xl" />
        <header className="relative flex min-w-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:gap-5 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)] sm:h-12 sm:w-12">
              <Edit3 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#D8B4FE] sm:gap-2 sm:text-[9px] sm:tracking-[0.22em]"><Sparkles className="h-3.5 w-3.5" /> Playlist workspace</div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">Edit playlist</h2>
              <p className="mt-1 text-xs text-zinc-500">Update its identity without changing the track order.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="control-press shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close playlist editor"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="relative grid min-w-0 gap-5 p-4 sm:gap-6 sm:p-7 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-4 sm:p-5">
            <div className="group relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[1.6rem] border border-white/10 bg-black shadow-2xl">
              <img key={coverUrl} src={coverUrl.trim() || DEFAULT_COVER_URL} alt="Playlist cover preview" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />
              <button type="button" onClick={() => coverFileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                <Upload className="h-7 w-7" />
                <span className="text-xs font-black">Upload new cover</span>
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E9D5FF]">Live preview</p>
                <h3 className="mt-1 truncate text-2xl font-black">{title.trim() || playlist.title}</h3>
                <p className="mt-1 text-[10px] text-zinc-300">{playlist.trackIds.length} songs</p>
              </div>
            </div>
            <input ref={coverFileInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            <button type="button" onClick={() => coverFileInputRef.current?.click()} className="control-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-4 py-3 text-xs font-black text-[#F0ABFC] hover:bg-[#D946EF]/15"><Upload className="h-4 w-4" /> Choose image</button>
            <p className="mt-2 truncate text-center text-[10px] text-zinc-500">{coverFileName || 'JPG, PNG, WebP or GIF · maximum 8 MB'}</p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-6">
            <div className="space-y-5">
              <div><label className={labelClass}>Playlist title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Playlist title"
                  className={fieldClass}
                />
              </div>

              <div><div className="mb-2 flex items-center justify-between"><label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Description</label><span className="text-[9px] font-mono text-zinc-600">{description.length}/1000</span></div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  placeholder="Add a description..."
                  rows={5}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              <div><label className={`${labelClass} flex items-center gap-2`}><ImageIcon className="h-4 w-4 text-[#D946EF]" /> Cover URL</label><input type="text" value={coverUrl.startsWith('data:') ? '' : coverUrl} onChange={(e) => { setCoverUrl(e.target.value); setCoverFileName(''); setErrorMessage(''); }} placeholder={coverUrl.startsWith('data:') ? 'Uploaded image selected' : 'Paste an HTTP(S) image URL'} className={fieldClass} /></div>
            </div>

            {errorMessage && <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-xs font-bold text-red-200"><AlertCircle className="h-4 w-4 shrink-0" /> {errorMessage}</div>}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={isSaving} className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40">Cancel</button>
              <button type="submit" disabled={!title.trim() || isSaving || savedSuccess} className={`control-press flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] disabled:cursor-not-allowed disabled:opacity-60 ${savedSuccess ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:brightness-110'}`}>
                {savedSuccess ? <><Check className="h-4 w-4" /> Saved</> : isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save changes</>}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};
