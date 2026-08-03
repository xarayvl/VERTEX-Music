import React, { useState, useEffect } from 'react';
import { X, Edit3, Image as ImageIcon } from 'lucide-react';
import { Playlist } from '../../types';

interface EditPlaylistModalProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onSavePlaylist: (updatedPlaylist: Playlist) => void;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  playlist,
  onClose,
  onSavePlaylist,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    if (playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description);
      setCoverUrl(playlist.coverUrl);
    }
  }, [playlist]);

  if (!isOpen || !playlist) return null;


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSavePlaylist({
      ...playlist,
      title: title.trim(),
      description: description.trim(),
      coverUrl: coverUrl || playlist.coverUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl select-none">
      <div className="relative w-full max-w-lg bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl text-white animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-[#D946EF]" />
            <h2 className="text-lg font-extrabold text-white tracking-tight">Edit Playlist Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-zinc-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Cover Art Preview */}
            <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10 relative group shadow-md">
              <img
                src={coverUrl || playlist.coverUrl}
                alt="Playlist cover"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Title & Description Inputs */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Playlist Title"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A855F7] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Custom Cover URL */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Custom Image URL (Optional)
            </label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Paste a real image URL"
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
