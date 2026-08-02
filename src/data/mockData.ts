import { Track, Album, Playlist, Artist } from '../types';

export const TRACKS: Track[] = [];

export const ALBUMS: Album[] = [];

export const PLAYLISTS: Playlist[] = [];

export const ARTISTS: Artist[] = [];

export const BROWSE_CATEGORIES = [
  { name: 'Synthwave & Retro', gradient: 'from-purple-600 via-pink-600 to-fuchsia-500', icon: 'Zap' },
  { name: 'Ambient & Spatial', gradient: 'from-indigo-600 via-purple-600 to-pink-500', icon: 'Sparkles' },
  { name: 'Cyberpunk & EDM', gradient: 'from-fuchsia-600 via-purple-700 to-violet-600', icon: 'Flame' },
  { name: 'Lofi & Chill Beats', gradient: 'from-purple-700 via-pink-600 to-rose-500', icon: 'Disc' },
  { name: 'Acoustic & Unplugged', gradient: 'from-violet-600 via-fuchsia-600 to-pink-500', icon: 'Radio' },
  { name: 'Top Charts Global', gradient: 'from-fuchsia-600 via-purple-700 to-pink-600', icon: 'Compass' },
];

export const DESIGN_TOKENS = [
  { category: 'Colors' as const, name: 'Glass Canvas Base', value: '#09090C', description: 'Deep near-black OLED backdrop background' },
  { category: 'Colors' as const, name: 'System Purple Accent', value: '#A855F7', description: 'Primary playback active & highlight purple' },
  { category: 'Colors' as const, name: 'Neon Pink Glow', value: '#D946EF', description: 'Secondary spatial audio & focus accent' },
  { category: 'Colors' as const, name: 'Apple Pink Accent', value: '#FF375F', description: 'Liked songs & favorite heart pulse color' },
  { category: 'Colors' as const, name: 'Frosted Glass Card', value: 'rgba(255, 255, 255, 0.04)', description: '24px backdrop-blur glass card container fill' },
  { category: 'Colors' as const, name: 'Glass Border Hairline', value: 'rgba(255, 255, 255, 0.08)', description: '1px clean subtle component edge highlight' },
  { category: 'Typography' as const, name: 'Display Title', value: '32px / 700 bold', description: 'Page & Hero titles with tight tracking' },
  { category: 'Typography' as const, name: 'Section Heading', value: '20px / 600 semibold', description: 'Section headers & track modal titles' },
  { category: 'Typography' as const, name: 'Body Medium', value: '15px / 500 medium', description: 'Track titles, artist names, tab labels' },
  { category: 'Typography' as const, name: 'Caption Light', value: '12px / 400 regular', description: 'Timestamps, subtexts, badge counts' },
  { category: 'Spacing' as const, name: 'Glass Radius Outer', value: '20px / 24px', description: 'Main card & modal container rounded radius' },
  { category: 'Spacing' as const, name: 'Button Pill Radius', value: '9999px', description: 'iOS system pills, tags, & floating player dock' },
  { category: 'Effects' as const, name: 'Glass Blur Level', value: '24px (backdrop-blur-2xl)', description: 'Subtle light refraction for iOS 27 glass' },
  { category: 'Effects' as const, name: 'Ambient Ambient Ring', value: 'blur(80px) opacity-40', description: 'Dynamic color halo matching current track artwork' },
];
