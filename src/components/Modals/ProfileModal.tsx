import React, { useEffect, useRef, useState } from 'react';
import { Edit3, LogOut, Play, Upload, User, X } from 'lucide-react';
import { UserProfile, Track } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';

interface ProfileModalProps {
  isOpen: boolean;
  userProfile: UserProfile | null;
  onClose: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  recentTracks?: Track[];
  onPlayTrack?: (track: Track) => void;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  userProfile,
  onClose,
  onUpdateProfile,
  recentTracks = [],
  onPlayTrack,
  onLogout,
  onOpenAuthModal,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_URL);
  const [isReadingAvatarFile, setIsReadingAvatarFile] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile) return;
    setDisplayName(userProfile.displayName || '');
    setUsername(userProfile.username || '');
    setBio(userProfile.bio || '');
    setAvatarUrl(userProfile.avatarUrl || DEFAULT_AVATAR_URL);
  }, [userProfile]);

  if (!isOpen) return null;

  const handleAvatarFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setIsReadingAvatarFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarUrl(reader.result);
      setIsReadingAvatarFile(false);
    };
    reader.onerror = () => setIsReadingAvatarFile(false);
    reader.readAsDataURL(file);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile) return;
    onUpdateProfile({
      ...userProfile,
      displayName: displayName.trim() || userProfile.displayName,
      username: username.trim() || userProfile.username,
      bio: bio.trim(),
      avatarUrl: avatarUrl || DEFAULT_AVATAR_URL,
    });
    setIsEditing(false);
  };

  if (!userProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181818] p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white">Account required</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <p className="mt-3 text-sm text-zinc-400">Sign in to view and edit your server-backed profile.</p>
          <button onClick={() => { onClose(); onOpenAuthModal?.(); }} className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] py-3 text-xs font-bold text-white">Sign In / Register</button>
        </div>
      </div>
    );
  }

  const recent = recentTracks.filter((track) => Boolean(track?.id)).slice(0, 5);
  const accountType = userProfile.isArtist ? 'Artist' : 'Listener';
  const joinedDate = userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unavailable';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-[#181818] shadow-2xl flex flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-[#121212] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D946EF]/20 text-[#D946EF] flex items-center justify-center"><User className="w-5 h-5" /></div>
            <div><h2 className="text-base font-extrabold text-white">Account & Profile</h2><p className="text-[11px] text-zinc-400">Authenticated account data</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <section className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <img src={avatarUrl || DEFAULT_AVATAR_URL} onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-[#D946EF]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold text-white truncate">{displayName}</h3><span className="rounded-full bg-[#D946EF]/20 px-2 py-0.5 text-[10px] font-bold text-[#D946EF]">{accountType} account</span></div>
              <p className="text-xs text-zinc-400">@{username} • joined {joinedDate}</p>
              <p className="mt-2 text-xs text-zinc-300 line-clamp-2">{bio || 'No biography added.'}</p>
            </div>
            <button onClick={() => setIsEditing((value) => !value)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" />{isEditing ? 'Cancel' : 'Edit'}</button>
          </section>

          {isEditing && (
            <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-[#D946EF]/30 bg-black/30 p-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Display name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#D946EF]" /></label>
                <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Username</span><input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#D946EF]" /></label>
              </div>
              <label className="block space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Bio</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#D946EF]" /></label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><button type="button" onClick={() => avatarFileInputRef.current?.click()} disabled={isReadingAvatarFile} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50 flex items-center gap-2"><Upload className="w-3.5 h-3.5" />{isReadingAvatarFile ? 'Reading…' : 'Upload photo'}</button><input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileUpload} className="hidden" /></div>
                <button type="submit" className="rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-2 text-xs font-bold text-white">Save Changes</button>
              </div>
            </form>
          )}

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"><p className="text-xl font-extrabold text-white">{((userProfile.stats?.secondsListened || 0) / 3600).toFixed(1)}</p><p className="text-[10px] uppercase text-zinc-400">Hours</p></div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"><p className="text-xl font-extrabold text-white">{userProfile.stats?.tracksPlayed || 0}</p><p className="text-[10px] uppercase text-zinc-400">Plays</p></div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"><p className="text-xl font-extrabold text-white">{userProfile.stats?.followersCount || 0}</p><p className="text-[10px] uppercase text-zinc-400">Followers</p></div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"><p className="text-xl font-extrabold text-white">{userProfile.stats?.followingCount || 0}</p><p className="text-[10px] uppercase text-zinc-400">Following</p></div>
          </section>

          <section>
            <h3 className="text-sm font-extrabold text-white">Recently played</h3>
            {recent.length === 0 ? <p className="mt-3 text-xs text-zinc-500">No saved listening history yet.</p> : <div className="mt-3 space-y-2">{recent.map((track) => <button key={track.id} onClick={() => onPlayTrack?.(track)} className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10 transition-colors"><img src={track.coverUrl || DEFAULT_AVATAR_URL} onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }} alt="" className="w-10 h-10 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{track.title}</p><p className="truncate text-[11px] text-zinc-400">{track.artist}</p></div><Play className="w-4 h-4 text-[#D946EF]" /></button>)}</div>}
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 bg-[#121212] p-4">
          <button onClick={() => { onClose(); onLogout?.(); }} className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25"><LogOut className="w-4 h-4" />Log out</button>
          <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Done</button>
        </footer>
      </div>
    </div>
  );
};
