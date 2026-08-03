import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Check,
  Zap,
  Settings,
  Edit3,
  Clock,
  Music,
  Heart,
  Sparkles,
  Headphones,
  Download,
  ShieldCheck,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
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
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'audioSettings'>('profile');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(userProfile?.favoriteGenres || []);
  const [newGenre, setNewGenre] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingAvatarFile, setIsReadingAvatarFile] = useState(false);

  // Settings toggles
  const [settings, setSettings] = useState({
    losslessAudio: userProfile?.settings?.losslessAudio ?? true,
    autoplay: userProfile?.settings?.autoplay ?? true,
    audioNormalization: userProfile?.settings?.audioNormalization ?? true,
    offlineDownloads: userProfile?.settings?.offlineDownloads ?? true,
  });

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
      setUsername(userProfile.username);
      setBio(userProfile.bio);
      setAvatarUrl(userProfile.avatarUrl);
      setFavoriteGenres(userProfile.favoriteGenres);
      setSettings({
        losslessAudio: userProfile.settings?.losslessAudio ?? true,
        autoplay: userProfile.settings?.autoplay ?? true,
        audioNormalization: userProfile.settings?.audioNormalization ?? true,
        offlineDownloads: userProfile.settings?.offlineDownloads ?? true,
      });
    }
  }, [userProfile]);

  if (!isOpen) return null;

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    setIsReadingAvatarFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) setAvatarUrl(result);
      setIsReadingAvatarFile(false);
    };
    reader.onerror = () => setIsReadingAvatarFile(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      displayName: displayName.trim() || userProfile.displayName,
      username: username.trim() || userProfile.username,
      bio: bio.trim(),
      avatarUrl: avatarUrl || userProfile.avatarUrl,
      favoriteGenres,
      settings,
    });
    setIsEditing(false);
  };

  const handleAddGenre = () => {
    if (newGenre.trim() && !favoriteGenres.includes(newGenre.trim())) {
      setFavoriteGenres([...favoriteGenres, newGenre.trim()]);
      setNewGenre('');
    }
  };

  const handleRemoveGenre = (genre: string) => {
    setFavoriteGenres(favoriteGenres.filter((g) => g !== genre));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#181818] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121212]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#D946EF]/20 text-[#D946EF] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Account & Listening Profile
              </h2>
              <p className="text-[11px] text-zinc-400">
                VERTEX Music • Personal Audio Profile
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#141414] px-6 py-2 gap-2">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'profile'
                ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            onClick={() => setActiveSubTab('audioSettings')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'audioSettings'
                ? 'bg-white text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Audio & Playback</span>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeSubTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Card Summary */}
              <div className="flex items-center space-x-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#D946EF]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-white truncate">{displayName}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#D946EF]/20 text-[#D946EF] text-[10px] font-bold">
                      {userProfile.membershipTier || 'Free Member'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">@{username} • {userProfile.email}</p>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {/* Edit Profile Form */}
              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4 p-4 rounded-xl bg-black/40 border border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D946EF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D946EF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D946EF] resize-none"
                    />
                  </div>

                  {/* Avatar Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Profile Photo
                      </label>
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        disabled={isReadingAvatarFile}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{isReadingAvatarFile ? 'Reading...' : 'Upload Your Own Photo'}</span>
                      </button>
                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        className="hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(DEFAULT_AVATAR_URL)}
                      className="text-[11px] text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Reset to default icon
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-bold text-xs hover:scale-105 transition-transform"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                /* Stats Grid */
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <p className="text-xl font-extrabold text-white">
                      {userProfile.stats?.secondsListened !== undefined
                        ? (userProfile.stats.secondsListened / 3600).toFixed(1)
                        : (userProfile.stats?.hoursListened ?? 0)}
                    </p>
                    <p className="text-[10px] text-zinc-400 uppercase">Hours Listened</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <p className="text-xl font-extrabold text-white">{userProfile.stats?.tracksPlayed ?? 0}</p>
                    <p className="text-[10px] text-zinc-400 uppercase">Tracks Streamed</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <p className="text-xl font-extrabold text-[#D946EF] truncate">Active Member</p>
                    <p className="text-[10px] text-zinc-400 uppercase">Account Status</p>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeSubTab === 'audioSettings' && (
            <div className="space-y-4 divide-y divide-white/10">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="text-sm font-bold text-white">24-bit FLAC Lossless Audio</h4>
                  <p className="text-xs text-zinc-400">Stream at 24-bit / 96kHz studio fidelity.</p>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.losslessAudio;
                    setSettings({ ...settings, losslessAudio: next });
                    onUpdateProfile({ ...userProfile, settings: { ...settings, losslessAudio: next } });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 ${
                    settings.losslessAudio ? 'bg-[#D946EF]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transform transition-transform ${
                      settings.losslessAudio ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Autoplay Similar Music</h4>
                  <p className="text-xs text-zinc-400">Keep playback going when queue finishes.</p>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.autoplay;
                    setSettings({ ...settings, autoplay: next });
                    onUpdateProfile({ ...userProfile, settings: { ...settings, autoplay: next } });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 ${
                    settings.autoplay ? 'bg-[#D946EF]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transform transition-transform ${
                      settings.autoplay ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Log Out / Sign In Actions */}
        <div className="p-4 border-t border-white/10 bg-[#121212] flex items-center justify-between">
          {userProfile ? (
            <button
              onClick={() => {
                onClose();
                if (onLogout) onLogout();
              }}
              className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-xs flex items-center space-x-2 transition-colors"
            >
              <span>Log out of VERTEX Music</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                if (onOpenAuthModal) onOpenAuthModal();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-bold text-xs flex items-center space-x-2 transition-colors"
            >
              <span>Sign In / Register</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
