import React, { useRef, useState } from 'react';
import { AlertCircle, Image as ImageIcon, ListMusic, Plus, Sparkles, Upload, X } from 'lucide-react';
import { Playlist } from '../../types';
import { DEFAULT_COVER_URL } from '../../utils/profilePlaceholders';

export type NewPlaylistDraft = Pick<Playlist, 'title' | 'description' | 'coverUrl' | 'trackIds'>;

interface NewPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlaylist: (playlist: NewPlaylistDraft) => void;
}

export const NewPlaylistModal: React.FC<NewPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreatePlaylist,
}) => {
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCover, setSelectedCover] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [coverError, setCoverError] = useState('');

  if (!isOpen) return null;

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCoverError('Please select a valid image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setCoverError('Playlist cover must be smaller than 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setSelectedCover(reader.result);
      setCoverFileName(file.name);
      setCoverError('');
    };
    reader.onerror = () => setCoverError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    const newPlaylist: NewPlaylistDraft = {
      title: title.trim(),
      description: description.trim(),
      coverUrl: selectedCover.trim(),
      trackIds: [],
    };

    onCreatePlaylist(newPlaylist);
    setTitle('');
    setDescription('');
    setSelectedCover('');
    setCoverFileName('');
    setCoverError('');
    onClose();
  };

  return (
    <section className="workspace-screen min-h-full w-full bg-[#121212] text-white select-none">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <header className="workspace-header flex min-w-0 items-start justify-between gap-3 border-b border-white/10 pb-5 sm:gap-5 sm:pb-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)] sm:h-12 sm:w-12">
              <ListMusic className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#D8B4FE] sm:gap-2 sm:text-[10px] sm:tracking-[0.24em]">
                <Sparkles className="h-3.5 w-3.5" /> Your collection
              </div>
              <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">Create playlist</h1>
              <p className="mt-1 text-[11px] leading-4 text-zinc-400 sm:text-sm">Give your next mix a clear identity and cover.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="control-press shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="Close playlist creator"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-5 sm:p-7">
            <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-2xl">
              <img
                key={selectedCover}
                src={selectedCover.trim() || DEFAULT_COVER_URL}
                alt="Selected playlist cover"
                referrerPolicy="no-referrer"
                className="media-fade h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E9D5FF]">Playlist preview</p>
                <h2 className="mt-1 truncate text-2xl font-black">{title.trim() || 'Untitled playlist'}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{description.trim() || 'Add a description to set the mood.'}</p>
              </div>
            </div>
          </div>

          <div className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-7">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Playlist title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Midnight drive"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What belongs in this playlist?"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10"
                />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#D946EF]" />
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Custom cover URL</label>
                </div>
                <input
                  type="url"
                  value={selectedCover.startsWith('data:') ? '' : selectedCover}
                  onChange={(event) => { setSelectedCover(event.target.value); setCoverFileName(''); setCoverError(''); }}
                  placeholder={selectedCover.startsWith('data:') ? 'Uploaded image selected' : 'Paste a real image URL, or leave empty'}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10"
                />
                <input ref={coverFileInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                <button type="button" onClick={() => coverFileInputRef.current?.click()} className="control-press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/10 px-4 py-3 text-xs font-black text-[#F0ABFC] hover:bg-[#D946EF]/15"><Upload className="h-4 w-4" /> Upload cover image</button>
                <p className="mt-2 truncate text-center text-[10px] text-zinc-500">{coverFileName || 'JPG, PNG, WebP or GIF · maximum 8 MB'}</p>
                {coverError && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-xs font-bold text-red-200"><AlertCircle className="h-4 w-4 shrink-0" /> {coverError}</div>}
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="control-press flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-6 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!title.trim()}
              >
                <Plus className="h-4 w-4" /> Create playlist
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
