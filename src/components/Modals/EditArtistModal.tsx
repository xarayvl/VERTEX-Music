import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Globe,
  Image as ImageIcon,
  Instagram,
  Music,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
  Twitter,
  Upload,
  User,
  X,
} from 'lucide-react';
import { Artist, Track, UserProfile } from '../../types';
import { getArtistStats } from '../../utils/artistUtils';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';
import { getSafeImageUrl } from '../../utils/sanitizeMediaUrl';
import { useI18n } from '../../i18n/I18nContext';

interface EditArtistModalProps {
  isOpen: boolean;
  artist: Artist | UserProfile | null;
  artistTracks?: Track[];
  onClose: () => void;
  onSave: (updatedData: {
    artistName: string;
    artistBio: string;
    avatarUrl: string;
    bannerUrl: string;
    genre: string;
    instagramUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    artistPickTrackId?: string;
    artistPickComment?: string;
  }) => void;
}

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#A855F7]/10';

const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400';

export const EditArtistModal: React.FC<EditArtistModalProps> = ({
  isOpen,
  artist,
  artistTracks = [],
  onClose,
  onSave,
}) => {
  const { t } = useI18n();
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_URL);
  const [bannerUrl, setBannerUrl] = useState('');
  const [artistBio, setArtistBio] = useState('');
  const [genre, setGenre] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [artistPickTrackId, setArtistPickTrackId] = useState('');
  const [artistPickComment, setArtistPickComment] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const isUserProfile = Boolean(artist && 'email' in artist);
  const artistName = artist
    ? isUserProfile
      ? (artist as UserProfile).artistName || (artist as UserProfile).displayName
      : (artist as Artist).name
    : '';
  const artistVerified = artist
    ? isUserProfile
      ? (artist as UserProfile).artistVerified === true
      : (artist as Artist).verified === true
    : false;

  useEffect(() => {
    if (!artist) return;

    const nextIsUserProfile = 'email' in artist;
    setAvatarUrl(
      (nextIsUserProfile ? (artist as UserProfile).avatarUrl : (artist as Artist).avatarUrl) ||
        DEFAULT_AVATAR_URL
    );
    setBannerUrl(
      (nextIsUserProfile ? (artist as UserProfile).bannerUrl : (artist as Artist).bannerUrl) || ''
    );
    setArtistBio(
      (nextIsUserProfile
        ? (artist as UserProfile).artistBio || (artist as UserProfile).bio
        : (artist as Artist).bio) || ''
    );
    setGenre(
      (nextIsUserProfile
        ? (artist as UserProfile).favoriteGenres?.[0]
        : (artist as Artist).genre) || ''
    );
    setInstagramUrl(artist.instagramUrl || '');
    setTwitterUrl(artist.twitterUrl || '');
    setWebsiteUrl(artist.websiteUrl || '');
    setArtistPickTrackId(artist.artistPickTrackId || '');
    setArtistPickComment(artist.artistPickComment || '');
    setSavedSuccess(false);
  }, [artist, isOpen]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  if (!isOpen || !artist) return null;

  const { totalPlays } = getArtistStats(artist, artistTracks);
  const selectedPick = artistTracks.find((track) => track.id === artistPickTrackId);

  const readImageFile = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (typeof loadEvent.target?.result === 'string') setter(loadEvent.target.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      artistName,
      artistBio: artistBio.trim(),
      avatarUrl: getSafeImageUrl(avatarUrl, DEFAULT_AVATAR_URL),
      bannerUrl: getSafeImageUrl(bannerUrl, ''),
      genre: genre.trim(),
      instagramUrl: instagramUrl.trim(),
      twitterUrl: twitterUrl.trim(),
      websiteUrl: websiteUrl.trim(),
      artistPickTrackId,
      artistPickComment: artistPickComment.trim(),
    });

    setSavedSuccess(true);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <section className="workspace-screen no-button-lift min-h-full w-full bg-[#121212] text-white select-none">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
        <header className="workspace-header flex min-w-0 items-start justify-between gap-3 border-b border-white/10 pb-5 sm:gap-5 sm:pb-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)] sm:h-12 sm:w-12">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#D8B4FE] sm:gap-2 sm:text-[10px] sm:tracking-[0.24em]">
                <Sparkles className="h-3.5 w-3.5" /> {t('Artist workspace')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black tracking-tight sm:text-3xl">{t('Edit artist profile')}</h1>
                {artistVerified && (
                  <span className="flex items-center gap-1 rounded-full border border-blue-400/25 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-blue-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> {t('Verified')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-zinc-400 sm:text-sm">{t('Shape how listeners see your identity, story and featured release.')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="control-press shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label={t('Close artist profile editor')}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 grid items-start gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <aside className="space-y-6 lg:sticky lg:top-6">
            <div className="workspace-card section-reveal overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#24182d] to-[#181818] p-4 sm:p-5">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-[#312e81] via-[#581c87] to-[#111827] shadow-2xl">
                {getSafeImageUrl(bannerUrl, '') && (
                  <img
                    key={bannerUrl}
                    src={getSafeImageUrl(bannerUrl, '')}
                    alt={t('Artist banner preview')}
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    className="media-fade absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5">
                  <div className="relative">
                    <img
                      key={avatarUrl}
                      src={getSafeImageUrl(avatarUrl, DEFAULT_AVATAR_URL)}
                      alt={artistName}
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR_URL;
                      }}
                      className="media-fade h-20 w-20 rounded-2xl border-2 border-white/40 object-cover shadow-xl sm:h-24 sm:w-24"
                    />
                    {artistVerified && (
                      <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#181818] bg-blue-500">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E9D5FF]">{t('Live preview')}</p>
                    <h2 className="mt-1 truncate text-2xl font-black sm:text-3xl">{artistName}</h2>
                    <p className="mt-1 truncate text-xs font-semibold text-zinc-300">{genre.trim() || t('Add your primary genre')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Radio className="h-4 w-4 text-[#D946EF]" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{t('Total streams')}</span>
                  </div>
                  <p className="mt-2 text-xl font-black">{totalPlays.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Music className="h-4 w-4 text-[#D946EF]" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{t('Releases')}</span>
                  </div>
                  <p className="mt-2 text-xl font-black">{artistTracks.length.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                  <Star className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{t('Artist pick preview')}</p>
                  <h3 className="mt-1 truncate text-sm font-black text-white">{selectedPick?.title || t('No featured track selected')}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {artistPickComment.trim() || t('Choose a release and add a short note for your listeners.')}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{t('Visual identity')}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">{t('Profile artwork')}</h2>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#A855F7]/15 text-[#D8B4FE]">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{t('Artist / stage name')}</p>
                      <p className="truncate text-sm font-black text-white">{artistName}</p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-400">{t('Synced to account')}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('Avatar image')}</label>
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="control-press flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                    >
                      <Upload className="h-3.5 w-3.5" /> {t('Upload')}
                    </button>
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => readImageFile(event, setAvatarUrl)}
                    />
                  </div>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder={t('Paste avatar image URL')}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('Header banner')}</label>
                    <button
                      type="button"
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="control-press flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> {t('Upload')}
                    </button>
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => readImageFile(event, setBannerUrl)}
                    />
                  </div>
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(event) => setBannerUrl(event.target.value)}
                    placeholder={t('Paste banner image URL')}
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>

            <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f1728] to-[#181818] p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{t('Profile story')}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">{t('About your sound')}</h2>
              </div>

              <div>
                <label className={labelClass}>{t('Primary genre / style')}</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(event) => setGenre(event.target.value)}
                  placeholder={t('e.g. Synthwave / Cyberpunk')}
                  className={fieldClass}
                />
              </div>

              <div className="mt-5">
                <label className={labelClass}>{t('Artist bio')}</label>
                <textarea
                  rows={5}
                  value={artistBio}
                  onChange={(event) => setArtistBio(event.target.value)}
                  placeholder={t('Tell listeners about your story, influences and releases...')}
                  className={`${fieldClass} resize-none`}
                />
                <div className="mt-2 flex justify-end text-[10px] font-semibold text-zinc-600">{t('{{count}} characters', { count: artistBio.length })}</div>
              </div>
            </section>

            <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{t('Artist pick')}</p>
                  <h2 className="mt-0.5 text-lg font-black">{t('Feature a release')}</h2>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('Featured track')}</label>
                  {artistTracks.length > 0 ? (
                    <select
                      value={artistPickTrackId}
                      onChange={(event) => setArtistPickTrackId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">{t('No featured track')}</option>
                      {artistTracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title} ({track.releaseTitle || (track.album === 'Single' ? track.title : track.album) || 'Single'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-3.5 text-sm text-zinc-500">{t('Upload a release before choosing an artist pick.')}</div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t('Pick note')}</label>
                  <input
                    type="text"
                    value={artistPickComment}
                    onChange={(event) => setArtistPickComment(event.target.value)}
                    placeholder={t('e.g. Listen to my latest single')}
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>

            <section className="workspace-card section-reveal rounded-3xl border border-white/10 bg-[#181818] p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{t('Social presence')}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">{t('Links listeners can visit')}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 transition-all focus-within:border-pink-400/50 focus-within:bg-white/[0.06] focus-within:ring-4 focus-within:ring-pink-400/10">
                  <Instagram className="h-4 w-4 shrink-0 text-pink-400" />
                  <input
                    type="text"
                    value={instagramUrl}
                    onChange={(event) => setInstagramUrl(event.target.value)}
                    placeholder="Instagram"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </label>
                <label className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 transition-all focus-within:border-sky-400/50 focus-within:bg-white/[0.06] focus-within:ring-4 focus-within:ring-sky-400/10">
                  <Twitter className="h-4 w-4 shrink-0 text-sky-400" />
                  <input
                    type="text"
                    value={twitterUrl}
                    onChange={(event) => setTwitterUrl(event.target.value)}
                    placeholder="Twitter / X"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </label>
                <label className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 transition-all focus-within:border-[#C084FC]/50 focus-within:bg-white/[0.06] focus-within:ring-4 focus-within:ring-[#A855F7]/10">
                  <Globe className="h-4 w-4 shrink-0 text-[#D8B4FE]" />
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="Website"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </label>
              </div>
            </section>

            <div className="workspace-card section-reveal flex flex-col-reverse gap-3 rounded-3xl border border-white/10 bg-[#181818] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <button
                type="button"
                onClick={onClose}
                className="control-press rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={savedSuccess}
                className="control-press flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-6 py-3 text-sm font-black shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savedSuccess ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {t(savedSuccess ? 'Profile saved' : 'Save profile')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
