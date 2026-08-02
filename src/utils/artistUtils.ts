import { Artist, UserProfile, Track } from '../types';

export interface ReleaseGroup {
  /** Stable key: shared releaseId, or album name, or the track id for standalone singles */
  key: string;
  /** The track used to represent the release (cover art, title fallback, etc.) */
  representative: Track;
  /** All tracks that belong to this release, in track-number order */
  tracks: Track[];
  releaseType: string;
  title: string;
  coverUrl: string;
  isMultiTrack: boolean;
}

/**
 * Groups a flat track list into releases (albums/EPs/singles) so that an
 * 11-track album uploaded together renders as ONE card instead of 11
 * separate ones. Tracks uploaded as part of the same album/EP share a
 * `releaseId` (and, for older data, a common non-"Single" `album` name) —
 * both are used as grouping keys so this works for freshly uploaded and
 * legacy mock data alike.
 */
export function groupTracksByRelease(tracks: Track[]): ReleaseGroup[] {
  const groups = new Map<string, Track[]>();
  const order: string[] = [];

  for (const track of tracks) {
    const key = track.releaseId
      ? `rel:${track.releaseId}`
      : track.album && track.album !== 'Single'
        ? `alb:${track.artist}:${track.album}`
        : `trk:${track.id}`;

    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(track);
  }

  return order.map((key) => {
    const groupTracks = [...groups.get(key)!].sort(
      (a, b) => (a.trackNumber || 0) - (b.trackNumber || 0)
    );
    const representative = groupTracks[0];
    const isMultiTrack = groupTracks.length > 1;
    const releaseType =
      representative.releaseType ||
      (isMultiTrack ? 'Album' : representative.album === 'Single' || !representative.album ? 'Single' : 'Album');

    return {
      key,
      representative,
      tracks: groupTracks,
      releaseType,
      title: representative.releaseTitle || (representative.album && representative.album !== 'Single' ? representative.album : representative.title),
      coverUrl: representative.coverUrl,
      isMultiTrack,
    };
  });
}

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
