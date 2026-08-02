import { getArtistStats } from "../../utils/artistUtils";
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Sparkles,
  Upload,
  Check,
  Music,
  Globe,
  Instagram,
  Twitter,
  Radio,
  Image as ImageIcon,
  User,
  Zap,
  Star,
  MessageSquare,
} from 'lucide-react';
import { Artist, UserProfile, Track } from '../../types';

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
    artistVerified: boolean;
    monthlyListeners: string;
    instagramUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    artistPickTrackId?: string;
    artistPickComment?: string;
  }) => void;
}

export const EditArtistModal: React.FC<EditArtistModalProps> = ({
  isOpen,
  artist,
  artistTracks = [],
  onClose,
  onSave,
}) => {
  if (!isOpen || !artist) return null;

  const isUserProfile = 'email' in artist;

  const initialName = isUserProfile
    ? (artist as UserProfile).artistName || (artist as UserProfile).displayName
    : (artist as Artist).name;

  const initialAvatar = isUserProfile
    ? (artist as UserProfile).avatarUrl
    : (artist as Artist).avatarUrl;

  const initialBanner = (isUserProfile && (artist as UserProfile).bannerUrl)
    ? (artist as UserProfile).bannerUrl!
    : (artist as Artist).bannerUrl || initialAvatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';

  const initialBio = isUserProfile
    ? (artist as UserProfile).artistBio || (artist as UserProfile).bio || ''
    : (artist as Artist).bio || '';

  const initialVerified = isUserProfile
    ? (artist as UserProfile).artistVerified !== false
    : (artist as Artist).verified !== false;

  const initialGenre = isUserProfile
    ? (artist as UserProfile).favoriteGenres?.[0] || 'Synthwave / Electronic'
    : (artist as Artist).genre || 'Synthwave / Electronic';

  // Get unified stats from global helper
  const { totalPlays: totalCalculatedPlays, monthlyListenersStr: initialListeners } = getArtistStats(artist, artistTracks);
  const calculatedListenersStr = `${totalCalculatedPlays.toLocaleString()} monthly listeners`;

  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [bannerUrl, setBannerUrl] = useState(initialBanner);
  const [artistBio, setArtistBio] = useState(initialBio);
  const [genre, setGenre] = useState(initialGenre);
  const [artistVerified, setArtistVerified] = useState(initialVerified);
  const [monthlyListeners, setMonthlyListeners] = useState(initialListeners);
  const [useCalculatedListeners, setUseCalculatedListeners] = useState(false);

  const [instagramUrl, setInstagramUrl] = useState(artist.instagramUrl || '');
  const [twitterUrl, setTwitterUrl] = useState(artist.twitterUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(artist.websiteUrl || '');

  const [artistPickTrackId, setArtistPickTrackId] = useState(artist.artistPickTrackId || (artistTracks[0]?.id || ''));
  const [artistPickComment, setArtistPickComment] = useState(artist.artistPickComment || 'Check out my featured release!');

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (artist) {
      setAvatarUrl(initialAvatar);
      setBannerUrl(initialBanner);
      setArtistBio(initialBio);
      setGenre(initialGenre);
      setArtistVerified(initialVerified);
      setMonthlyListeners(initialListeners);
      setInstagramUrl(artist.instagramUrl || '');
      setTwitterUrl(artist.twitterUrl || '');
      setWebsiteUrl(artist.websiteUrl || '');
      setArtistPickTrackId(artist.artistPickTrackId || (artistTracks[0]?.id || ''));
      setArtistPickComment(artist.artistPickComment || 'Check out my featured release!');
    }
  }, [artist]);

  const presetBanners = [
    { name: 'Neon Cyberpunk', url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Studio Console', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Live Concert Stage', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Synth Wave Sunset', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80' },
    { name: 'Vinyl Station', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80' },
  ];

  const presetAvatars = [
    { name: 'Producer Avatar', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' },
    { name: 'DJ Cyber Head', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80' },
    { name: 'Neon Artist', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80' },
  ];

  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setBannerUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalListeners = useCalculatedListeners ? calculatedListenersStr : monthlyListeners;
    onSave({
      artistName: initialName, // Default account username, read-only
      artistBio: artistBio.trim(),
      avatarUrl: avatarUrl.trim() || initialAvatar,
      bannerUrl: bannerUrl.trim() || initialBanner,
      genre: genre.trim() || 'Electronic',
      artistVerified,
      monthlyListeners: finalListeners,
      instagramUrl: instagramUrl.trim(),
      twitterUrl: twitterUrl.trim(),
      websiteUrl: websiteUrl.trim(),
      artistPickTrackId,
      artistPickComment: artistPickComment.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-[#181818] border border-white/10 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#222222] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-[#D946EF]" />
            <h2 className="text-lg font-black text-white tracking-tight">Edit Artist Profile</h2>
            {artistVerified && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Default Account Username Badge (Non-editable as requested) */}
          <div className="p-3.5 rounded-xl bg-[#222222] border border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Artist / Stage Name
                </p>
                <p className="text-sm font-black text-white">{initialName}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
              Synced to Account
            </span>
          </div>

          {/* Banner Image Editor & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#D946EF]" />
                <span>Artist Header Banner</span>
              </label>
              <button
                type="button"
                onClick={() => bannerFileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-[#D946EF]" />
                <span>Upload Banner</span>
              </button>
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerFileUpload}
              />
            </div>

            {/* Live Banner Preview */}
            <div
              className="relative h-36 rounded-xl bg-cover bg-center overflow-hidden border border-white/10 flex items-end p-3 group shadow-inner"
              style={{ backgroundImage: `url(${bannerUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 flex items-center space-x-3">
                <img
                  src={avatarUrl}
                  alt={initialName}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white/50 shadow-md"
                />
                <div>
                  <p className="text-sm font-black text-white drop-shadow">{initialName}</p>
                  <p className="text-[10px] text-zinc-300 drop-shadow">{genre}</p>
                </div>
              </div>
            </div>

            <input
              type="text"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="Or paste custom Banner Image URL..."
              className="w-full bg-[#242424] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
            />

            {/* Banner Presets */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex-shrink-0">Presets:</span>
              {presetBanners.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setBannerUrl(preset.url)}
                  className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap border transition-all ${
                    bannerUrl === preset.url
                      ? 'bg-[#D946EF] border-[#D946EF] text-white font-bold'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* ARTIST PICK EDIT SECTION */}
          <div className="p-4 rounded-xl bg-[#222222] border border-white/10 space-y-3">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Artist Pick Showcase</h3>
            </div>
            <p className="text-[11px] text-zinc-400">
              Highlight your favorite track or latest release at the top of your artist profile.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                  Select Featured Track
                </label>
                {artistTracks.length > 0 ? (
                  <select
                    value={artistPickTrackId}
                    onChange={(e) => setArtistPickTrackId(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D946EF]"
                  >
                    {artistTracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.title} ({track.releaseTitle || (track.album === 'Single' ? track.title : track.album) || 'Single'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-zinc-500 italic p-2 bg-[#181818] rounded-xl border border-white/5">
                    No custom tracks uploaded yet.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                  Pick Headline / Note
                </label>
                <input
                  type="text"
                  value={artistPickComment}
                  onChange={(e) => setArtistPickComment(e.target.value)}
                  placeholder="e.g. Check out my new single!"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
            </div>
          </div>

          {/* Primary Genre & Avatar Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Primary Genre / Style
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Synthwave / Cyberpunk"
                className="w-full bg-[#242424] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-300">
                  Avatar Image URL
                </label>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="text-[10px] text-[#D946EF] hover:underline font-bold"
                >
                  Upload File
                </button>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileUpload}
                />
              </div>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Paste Avatar image URL..."
                className="w-full bg-[#242424] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
              />
              <div className="flex items-center gap-2 pt-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Presets:</span>
                {presetAvatars.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setAvatarUrl(preset.url)}
                    className="w-6 h-6 rounded-full overflow-hidden border border-white/20 hover:scale-110 transition-transform"
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Artist Bio */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Artist Bio / About Story
            </label>
            <textarea
              rows={3}
              value={artistBio}
              onChange={(e) => setArtistBio(e.target.value)}
              placeholder="Tell your listeners about your story, instruments, and music releases..."
              className="w-full bg-[#242424] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] resize-none"
            />
          </div>

          {/* Monthly Listeners Stats */}
          <div className="p-4 rounded-xl bg-[#222222] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-[#D946EF]" />
                <span className="text-xs font-bold text-white">Monthly Listeners Stats</span>
              </div>
              <button
                type="button"
                onClick={() => setUseCalculatedListeners(!useCalculatedListeners)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                  useCalculatedListeners
                    ? 'bg-[#D946EF] text-white font-bold'
                    : 'bg-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {useCalculatedListeners ? 'Auto-Calculate from Plays' : 'Custom Display'}
              </button>
            </div>

            {useCalculatedListeners ? (
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Calculated from total track streams:</span>
                <span className="font-mono font-bold text-[#D946EF]">{calculatedListenersStr}</span>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={monthlyListeners}
                  onChange={(e) => setMonthlyListeners(e.target.value)}
                  placeholder="e.g. 48,500 monthly listeners"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                />
              </div>
            )}
          </div>

          {/* Verified Badge Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#222222] border border-white/10">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-xs font-bold text-white">Verified Artist Status</p>
                <p className="text-[10px] text-zinc-400">Display blue verified shield on artist profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setArtistVerified(!artistVerified)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                artistVerified ? 'bg-blue-500 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300">Social Links & Web</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2 bg-[#242424] border border-white/10 rounded-xl px-3 py-2">
                <Instagram className="w-4 h-4 text-pink-400 flex-shrink-0" />
                <input
                  type="text"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="@instagram"
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 bg-[#242424] border border-white/10 rounded-xl px-3 py-2">
                <Twitter className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <input
                  type="text"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="@twitter"
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 bg-[#242424] border border-white/10 rounded-xl px-3 py-2">
                <Globe className="w-4 h-4 text-[#D946EF] flex-shrink-0" />
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={savedSuccess}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 text-white text-xs font-extrabold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
