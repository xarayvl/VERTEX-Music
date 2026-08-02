import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newPlaylist: Playlist = {
      id: `playlist-user-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Custom user created playlist',
      coverUrl: selectedCover,
      trackCount: 0,
      likes: '1',
      tags: ['Custom', 'User'],
      trackIds: ['track-1', 'track-2'],
    };

    onCreatePlaylist(newPlaylist);
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
      <div className="relative w-full max-w-md bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-[#D946EF]" />
            <h2 className="text-lg font-bold text-white tracking-tight">Create New Playlist</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Playlist Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midnight Chill Beats"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A855F7]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#A855F7]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Select Cover Art Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {covers.map((c, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedCover(c.url)}
                  className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    selectedCover === c.url ? 'border-[#D946EF] scale-105' : 'border-transparent opacity-60'
                  }`}
                >
                  <img
                    src={c.url}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-bold text-sm shadow-xl hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Create Playlist
          </button>
        </form>
      </div>
    </div>
  );
};
