import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  CalendarDays,
  Camera,
  Clock3,
  Edit3,
  Headphones,
  LogOut,
  Play,
  Save,
  Sparkles,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Track, UserProfile } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';
import { useI18n } from '../../i18n/I18nContext';

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
  const { locale, t } = useI18n();
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

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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
      avatarUrl,
    });
    setIsEditing(false);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  if (!userProfile) {
    return (
      <div
        className="no-button-lift fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 px-0 pt-[max(4rem,env(safe-area-inset-top))] animate-in fade-in duration-200 sm:p-4"
        onMouseDown={handleBackdropClick}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-auth-title"
          className="w-full max-w-xl rounded-t-[2rem] border border-white/10 bg-gradient-to-b from-[#25142d] to-[#141416] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.65)] animate-in slide-in-from-bottom-8 duration-300 sm:rounded-[2rem] sm:p-6"
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D946EF]/25 bg-[#D946EF]/15 text-[#F0ABFC]">
              <UserRound className="h-6 w-6" />
            </div>
            <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label={t('Close profile panel')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE]">{t('Your profile')}</p>
          <h2 id="profile-auth-title" className="mt-2 text-2xl font-black tracking-tight text-white">{t('Sign in to make it yours')}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{t('View your listening activity, update your photo and personalize how other people see you.')}</p>
          <button
            onClick={() => {
              onClose();
              onOpenAuthModal?.();
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] py-3.5 text-sm font-black text-white shadow-lg shadow-[#A855F7]/20 transition-colors hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            {t('Sign In / Register')}
          </button>
        </section>
      </div>
    );
  }

  const recent = recentTracks.filter((track) => Boolean(track?.id)).slice(0, 5);
  const accountType = t(userProfile.isArtist ? 'Artist' : 'Listener');
  const joinedDate = userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString(locale) : t('Unavailable');
  const stats = [
    { label: 'Hours', value: ((userProfile.stats?.secondsListened || 0) / 3600).toFixed(1), icon: Clock3 },
    { label: 'Plays', value: userProfile.stats?.tracksPlayed || 0, icon: Headphones },
    { label: 'Followers', value: userProfile.stats?.followersCount || 0, icon: Users },
    { label: 'Following', value: userProfile.stats?.followingCount || 0, icon: UserRound },
  ];

  return (
    <div
      className="no-button-lift fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 px-0 pt-[max(2.5rem,env(safe-area-inset-top))] animate-in fade-in duration-200 sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-panel-title"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-gradient-to-b from-[#24142c] via-[#18181b] to-[#111113] shadow-[0_-28px_100px_rgba(0,0,0,0.78)] animate-in slide-in-from-bottom-8 duration-300 sm:max-h-[90dvh] sm:rounded-[2rem]"
      >
        <div className="relative border-b border-white/[0.08] px-5 pb-4 pt-3 sm:px-7 sm:pt-5">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-[#D8B4FE]">{t('Personal space')}</p>
              <h2 id="profile-panel-title" className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">{t('Profile & account')}</h2>
            </div>
            <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label={t('Close profile panel')}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="space-y-5">
            <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#D946EF]/20 blur-3xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative shrink-0 self-center sm:self-start">
                  <img
                    src={avatarUrl || DEFAULT_AVATAR_URL}
                    onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR_URL; }}
                    alt={displayName}
                    className="h-24 w-24 rounded-[1.75rem] border-2 border-[#D946EF]/70 object-cover shadow-2xl shadow-[#D946EF]/15 sm:h-28 sm:w-28"
                  />
                  <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-[#19131c] bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white">
                    <Camera className="h-4 w-4" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <h3 className="max-w-full break-words text-2xl font-black tracking-tight text-white [overflow-wrap:anywhere] sm:text-3xl">{displayName}</h3>
                    <span className="rounded-full border border-[#D946EF]/25 bg-[#D946EF]/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#F0ABFC]">{accountType}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-400 sm:justify-start">
                    <span className="flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" />{username}</span>
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Joined {joinedDate}</span>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{bio || 'Add a short bio so listeners know a little more about you.'}</p>
                </div>

                <button
                  onClick={() => setIsEditing((value) => !value)}
                  className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition-all sm:w-auto ${isEditing ? 'border-white/10 bg-white/10 text-white hover:bg-white/15' : 'border-[#D946EF]/25 bg-[#D946EF]/15 text-[#F5D0FE] hover:bg-[#D946EF]/25'}`}
                >
                  <Edit3 className="h-4 w-4" />
                  {isEditing ? 'Cancel editing' : 'Edit profile'}
                </button>
              </div>
            </section>

            {isEditing && (
              <form onSubmit={handleSave} className="rounded-[1.75rem] border border-[#D946EF]/25 bg-black/25 p-5 animate-in fade-in slide-in-from-top-2 duration-200 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#D8B4FE]">{t('Make it personal')}</p>
                    <h3 className="mt-1 text-base font-black text-white">{t('Edit profile details')}</h3>
                  </div>
                  <span className="hidden rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold text-zinc-400 sm:inline">{t('Changes save to your account')}</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{t('Display name')}</span>
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} className="w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#D946EF]/60 focus:bg-white/[0.08]" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{t('Username')}</span>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={32} className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3 pl-10 pr-4 text-sm font-semibold text-white outline-none transition-colors focus:border-[#D946EF]/60 focus:bg-white/[0.08]" />
                    </div>
                  </label>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    <span>{t('Bio')}</span>
                    <span className="font-semibold normal-case tracking-normal text-zinc-600">{bio.length}/500</span>
                  </span>
                  <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#D946EF]/60 focus:bg-white/[0.08]" placeholder={t('Tell people about yourself...')} />
                </label>

                <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => avatarFileInputRef.current?.click()} disabled={isReadingAvatarFile} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/10 disabled:opacity-50">
                      <Upload className="h-4 w-4" />
                      {isReadingAvatarFile ? 'Reading photo…' : 'Choose photo'}
                    </button>
                    <button type="button" onClick={() => setAvatarUrl('')} className="rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white">{t('Remove photo')}</button>
                    <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileUpload} className="hidden" />
                  </div>
                  <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-[#A855F7]/20 transition-colors hover:brightness-110">
                    <Save className="h-4 w-4" />
                    Save changes
                  </button>
                </div>
              </form>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="group rounded-2xl border border-white/[0.07] bg-white/[0.045] p-4 transition-colors hover:border-[#D946EF]/20 hover:bg-white/[0.07]">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#D946EF]/12 text-[#E879F9] transition-transform group-hover:scale-105"><Icon className="h-4 w-4" /></div>
                  <p className="text-xl font-black tracking-tight text-white">{value}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                </div>
              ))}
            </section>

            <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D8B4FE]">{t('Listening activity')}</p>
                  <h3 className="mt-1 text-base font-black text-white">{t('Recently played')}</h3>
                </div>
                <Headphones className="h-5 w-5 text-zinc-600" />
              </div>

              {recent.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <p className="text-sm font-bold text-zinc-400">{t('Your listening history is quiet')}</p>
                  <p className="mt-1 text-xs text-zinc-600">{t('Played songs will appear here.')}</p>
                </div>
              ) : (
                <div className="mt-3 grid gap-1 sm:grid-cols-2">
                  {recent.map((track) => (
                    <button key={track.id} onClick={() => onPlayTrack?.(track)} className="group flex min-w-0 items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-white/[0.07]">
                      <img src={track.coverUrl || DEFAULT_AVATAR_URL} onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR_URL; }} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover shadow" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white transition-colors group-hover:text-[#F0ABFC]">{track.title}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{track.artist}</p>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[#E879F9] transition-colors group-hover:bg-[#D946EF] group-hover:text-white">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="mobile-safe-footer flex items-center justify-between gap-3 border-t border-white/[0.08] bg-black/20 px-5 py-4 sm:px-7">
          <button onClick={() => { onClose(); onLogout?.(); }} className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-black text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.07] px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/15">{t('Done')}</button>
        </footer>
      </section>
    </div>
  );
};
