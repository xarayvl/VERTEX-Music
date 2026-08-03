import React, { useState } from 'react';
import { Check, Image as ImageIcon, ListMusic, Plus, Sparkles, X } from 'lucide-react';
import { Playlist } from '../../types';

interface NewPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlaylist: (playlist: Playlist) => void;
}

export const NewPlaylistModal: React.FC<NewPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreatePlaylist,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCover, setSelectedCover] = useState(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'
  );

  if (!isOpen) return null;

  const covers = [
    {
      name: 'Neon Sunset',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Celestial Space',
      url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Cyberpunk Grid',
      url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80',
    },
    {
      name: 'Tokyo Rain',
      url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    const newPlaylist: Playlist = {
      id: `playlist-user-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Custom user created playlist',
      coverUrl: selectedCover,
      trackCount: 0,
      likes: '1',
      tags: ['Custom', 'User'],
      trackIds: [],
    };

    onCreatePlaylist(newPlaylist);
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <section className="workspace-screen min-h-full w-full bg-[#121212] text-white select-none">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <header className="workspace-header flex items-start justify-between gap-5 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)]">
              <ListMusic className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">
                <Sparkles className="h-3.5 w-3.5" /> Your collection
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Create playlist</h1>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">Give your next mix a clear identity and cover.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="control-press rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white"
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
                src={selectedCover}
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
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Cover style</label>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {covers.map((cover, index) => {
                    const selected = selectedCover === cover.url;
                    return (
                      <button
                        type="button"
                        key={cover.name}
                        onClick={() => setSelectedCover(cover.url)}
                        style={{ '--stagger-index': index } as React.CSSProperties}
                        className={`stagger-item control-press group relative aspect-square overflow-hidden rounded-2xl border-2 ${
                          selected ? 'border-[#E879F9] ring-4 ring-[#A855F7]/15' : 'border-transparent hover:border-white/20'
                        }`}
                        aria-label={`Select ${cover.name} cover`}
                      >
                        <img src={cover.url} alt={cover.name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <span className="absolute inset-x-2 bottom-2 truncate text-left text-[9px] font-black text-white">{cover.name}</span>
                        {selected && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D946EF] shadow-lg">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
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
