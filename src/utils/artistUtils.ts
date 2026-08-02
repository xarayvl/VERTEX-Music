import { Artist, UserProfile, Track } from '../types';

export function getArtistStats(artist: Artist | UserProfile | null | undefined, allTracks: Track[]) {
  if (!artist) return { totalPlays: 0, monthlyListenersStr: '0 monthly listeners', artistName: '', artistTracks: [] };

  const isUserProfile = 'email' in artist;
  
  let artistName = '';
  if (!isUserProfile) {
    artistName = (artist as Artist).name;
  } else {
    const p = artist as UserProfile;
    artistName = p.artistName || p.displayName || p.username || (p.email ? p.email.split('@')[0] : 'Unknown Artist');
  }

  const artistTracks = allTracks.filter((t) => {
    if (isUserProfile) {
      if (t.userId) {
        return t.userId === artist.id;
      }
      return Boolean(artistName && t.artist && t.artist.toLowerCase() === artistName.toLowerCase());
    } else {
      if (t.userId) {
        if (t.userId === artist.id) return true;
        return false;
      }
      return Boolean(artistName && t.artist && t.artist.toLowerCase() === artistName.toLowerCase());
    }
  });

  const totalArtistPlays = artistTracks.reduce(
    (acc, t) => acc + (parseInt(t.plays || '0', 10) || 0),
    0
  );

  const calculatedListenersStr = `${totalArtistPlays.toLocaleString()} monthly listeners`;

  const rawMonthlyListeners = isUserProfile
    ? (artist as UserProfile).monthlyListeners
    : (artist as Artist).monthlyListeners;

  const monthlyListenersStr = rawMonthlyListeners || (totalArtistPlays > 0 ? calculatedListenersStr : '0 monthly listeners');

  return {
    totalPlays: totalArtistPlays,
    monthlyListenersStr,
    artistName,
    artistTracks
  };
}
