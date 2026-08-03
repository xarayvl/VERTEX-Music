import { Artist, UserProfile, Track } from '../types';

export interface ReleaseGroup {
  /** Stable key: shared releaseId, or album name, or the track id for standalone singles */
  key: string;
  /** The track used to represent the release (cover art, title fallback, etc.) */
  representative: Track;
  /** All tracks that belong to this release, in track-number order */
  tracks: Track[];
  releaseType: 'Single' | 'EP' | 'Album';
  title: string;
  coverUrl: string;
  isMultiTrack: boolean;
}

/**
 * The API persists release types as SINGLE/EP/ALBUM, while some older client
 * records used Single/Ep/Album. Keep that storage detail out of the views by
 * normalizing every variant in one place.
 */
function normalizeReleaseType(track: Track, isMultiTrack: boolean): ReleaseGroup['releaseType'] {
  const storedType = String(track.releaseType || '').trim().toUpperCase();
  if (storedType === 'SINGLE') return 'Single';
  if (storedType === 'EP') return 'EP';
  if (storedType === 'ALBUM') return 'Album';

  return isMultiTrack
    ? 'Album'
    : track.album === 'Single' || !track.album
      ? 'Single'
      : 'Album';
}

/**
 * Groups a flat track list into releases (albums/EPs/singles) so that an
 * 11-track album uploaded together renders as ONE card instead of 11
 * separate ones. Tracks uploaded as part of the same album/EP share a
 * `releaseId` (and, for older data, a common non-"Single" `album` name) —
 * both are used as grouping keys so this works for freshly uploaded and
 * older persisted releases alike.
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
    const releaseType = normalizeReleaseType(representative, isMultiTrack);

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
  if (!artist) return { totalPlays: 0, totalStreamsLabel: '0 total streams', artistName: '', artistTracks: [] };

  const isUserProfile = 'email' in artist;
  const artistName = isUserProfile
    ? ((artist as UserProfile).artistName || (artist as UserProfile).displayName || (artist as UserProfile).username)
    : (artist as Artist).name;
  const artistTracks = allTracks.filter((track) => track.userId === artist.id);
  const totalPlays = artistTracks.reduce(
    (total, track) => total + (Number.parseInt(track.plays || '0', 10) || 0),
    0
  );

  return {
    totalPlays,
    totalStreamsLabel: `${totalPlays.toLocaleString()} total streams`,
    artistName,
    artistTracks,
  };
}
