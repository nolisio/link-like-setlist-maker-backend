import type { DeezerTrack } from "../clients/deezerClient.js";
import { deezerArtistDefaults } from "./deezerArtistDefaults.js";

export type ResolverSongSeed = {
  id: string;
  title: string;
  titleJa?: string;
  unitId: string;
  sortOrder: number;
  deezerSearchTitle?: string;
  deezerArtistName?: string;
  deezerArtistId?: number;
  deezerTrackId?: number;
};

type ResolverTrack = Pick<DeezerTrack, "id" | "title" | "artist" | "album" | "preview">;

type SearchTracks = (query: string) => Promise<ResolverTrack[]>;
type ListArtistTopTracks = (artistId: number) => Promise<ResolverTrack[]>;
type ListAlbumTracks = (albumId: number) => Promise<ResolverTrack[]>;

export type ResolvedTrackResult = {
  status: "resolved";
  songId: string;
  deezerTrackId: number;
  matchedBy: "override" | "artist_id" | "artist_name" | "title";
};

export type SkippedTrackResult = {
  status: "skipped";
  songId: string;
};

export type ConfirmationCandidate = {
  deezerTrackId: number;
  title: string;
  artistName: string;
  albumTitle: string | null;
};

export type UnresolvedTrackResult = {
  status: "needs_confirmation";
  songId: string;
  reason: "no_candidates" | "multiple_candidates";
  candidates: ConfirmationCandidate[];
};

export type ResolveSongDeezerTrackIdResult = ResolvedTrackResult | UnresolvedTrackResult | SkippedTrackResult;

export async function resolveSongDeezerTrackId(
  song: ResolverSongSeed,
  options: {
    searchTracks: SearchTracks;
    listArtistTopTracks?: ListArtistTopTracks;
    listAlbumTracks?: ListAlbumTracks;
    overrides: Record<string, number | null>;
  }
): Promise<ResolveSongDeezerTrackIdResult> {
  const expectedArtist = deezerArtistDefaults[song.unitId];
  const expectedArtistName = song.deezerArtistName ?? expectedArtist?.name;
  const expectedArtistId = song.deezerArtistId ?? expectedArtist?.id;
  const override = options.overrides[song.id];
  if (override === null) {
    return {
      status: "skipped",
      songId: song.id
    };
  }
  if (typeof override === "number") {
    return {
      status: "resolved",
      songId: song.id,
      deezerTrackId: override,
      matchedBy: "override"
    };
  }

  let tracks = await searchCandidateTracks(song, options.searchTracks, expectedArtistName);
  if (expectedArtistId && needsArtistFallback(song, tracks) && options.listArtistTopTracks) {
    const topTracks = await options.listArtistTopTracks(expectedArtistId);
    tracks = uniqueTracks([...tracks, ...topTracks]);
  }
  if (expectedArtistId && needsArtistFallback(song, tracks) && options.listAlbumTracks) {
    const albumTracks = await listCandidateAlbumTracks(tracks, options.listAlbumTracks);
    tracks = uniqueTracks([...tracks, ...albumTracks]);
  }
  if (tracks.length === 0) {
    return unresolved(song.id, "no_candidates", []);
  }

  const artistIdMatches = expectedArtistId
    ? uniqueTracks(tracks.filter((track) => track.artist.id === expectedArtistId))
    : [];
  const exactArtistIdTitleMatches = artistIdMatches.filter((track) => isPrimaryTitleMatch(song, track.title));
  if (exactArtistIdTitleMatches.length === 1) {
    return resolved(song.id, exactArtistIdTitleMatches[0].id, "artist_id");
  }
  if (exactArtistIdTitleMatches.length > 1) {
    return unresolved(song.id, "multiple_candidates", exactArtistIdTitleMatches);
  }

  const artistNameMatches = expectedArtistName
    ? uniqueTracks(tracks.filter((track) => normalize(track.artist.name) === normalize(expectedArtistName)))
    : [];
  const exactArtistNameTitleMatches = artistNameMatches.filter((track) => isPrimaryTitleMatch(song, track.title));
  if (exactArtistNameTitleMatches.length === 1) {
    return resolved(song.id, exactArtistNameTitleMatches[0].id, expectedArtistId ? "artist_id" : "artist_name");
  }
  if (exactArtistNameTitleMatches.length > 1) {
    return unresolved(song.id, "multiple_candidates", exactArtistNameTitleMatches);
  }

  const exactTitleMatches = uniqueTracks(tracks.filter((track) => isPrimaryTitleMatch(song, track.title)));
  if (exactTitleMatches.length === 1) {
    return resolved(song.id, exactTitleMatches[0].id, "title");
  }
  if (exactTitleMatches.length > 1) {
    return unresolved(song.id, "multiple_candidates", exactTitleMatches);
  }

  const titleMatches = uniqueTracks(tracks.filter((track) => matchesAnyExpectedTitle(song, track.title)));
  if (titleMatches.length === 0) {
    return unresolved(song.id, "no_candidates", []);
  }
  if (expectedArtistId || expectedArtistName) {
    const expectedArtistTitleMatches = uniqueTracks(
      titleMatches.filter((track) => {
        if (expectedArtistId && track.artist.id === expectedArtistId) {
          return true;
        }

        return expectedArtistName ? normalize(track.artist.name) === normalize(expectedArtistName) : false;
      })
    );

    if (expectedArtistTitleMatches.length === 0) {
      return unresolved(song.id, "no_candidates", []);
    }
  }

  if (artistIdMatches.length === 1) {
    return resolved(song.id, artistIdMatches[0].id, "artist_id");
  }
  if (artistIdMatches.length > 1) {
    return unresolved(song.id, "multiple_candidates", artistIdMatches);
  }
  if (artistNameMatches.length === 1) {
    return resolved(song.id, artistNameMatches[0].id, expectedArtistId ? "artist_id" : "artist_name");
  }
  if (artistNameMatches.length > 1) {
    return unresolved(song.id, "multiple_candidates", artistNameMatches);
  }
  if (titleMatches.length === 1) {
    return resolved(song.id, titleMatches[0].id, "title");
  }

  return unresolved(song.id, "multiple_candidates", titleMatches);
}

async function searchCandidateTracks(song: ResolverSongSeed, searchTracks: SearchTracks, expectedArtistName?: string) {
  const seen = new Set<number>();
  const tracks: ResolverTrack[] = [];

  for (const query of buildQueries(song, expectedArtistName)) {
    const results = await searchTracks(query);
    for (const track of results) {
      if (seen.has(track.id)) {
        continue;
      }

      seen.add(track.id);
      tracks.push(track);
    }
  }

  return tracks;
}

async function listCandidateAlbumTracks(tracks: ResolverTrack[], listAlbumTracks: ListAlbumTracks) {
  const albumIds = Array.from(new Set(tracks.map((track) => track.album?.id).filter((id): id is number => typeof id === "number")));
  const albumTracks: ResolverTrack[] = [];

  for (const albumId of albumIds) {
    albumTracks.push(...(await listAlbumTracks(albumId)));
  }

  return albumTracks;
}

function buildQueries(song: ResolverSongSeed, expectedArtistName?: string) {
  return Array.from(
    new Set(
      [song.deezerSearchTitle, song.titleJa, song.title]
        .flatMap((title) => {
          if (!title) {
            return [];
          }

          return expectedArtistName ? [`${title} ${expectedArtistName}`, title] : [title];
        })
        .map((query) => query.trim())
        .filter((query) => query.length > 0)
    )
  );
}

function matchesAnyExpectedTitle(song: ResolverSongSeed, candidateTitle: string) {
  const candidate = normalize(candidateTitle);
  return Array.from(new Set([song.deezerSearchTitle, song.titleJa, song.title].filter(Boolean))).some((title) => {
    const expected = normalize(title!);
    return candidate === expected || candidate.includes(expected) || expected.includes(candidate);
  });
}

function needsArtistFallback(song: ResolverSongSeed, tracks: ResolverTrack[]) {
  if (tracks.length === 0) {
    return true;
  }

  return tracks.every((track) => !isPrimaryTitleMatch(song, track.title));
}

function isPrimaryTitleMatch(song: ResolverSongSeed, candidateTitle: string) {
  const primaryTitle = song.deezerSearchTitle ?? song.titleJa ?? song.title;
  const normalizedPrimaryTitle = normalize(primaryTitle);
  const normalizedCandidateTitle = normalize(candidateTitle);
  return normalizedPrimaryTitle === normalizedCandidateTitle;
}

function uniqueTracks(tracks: ResolverTrack[]) {
  const seen = new Set<number>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) {
      return false;
    }

    seen.add(track.id);
    return true;
  });
}

function resolved(songId: string, deezerTrackId: number, matchedBy: ResolvedTrackResult["matchedBy"]): ResolvedTrackResult {
  return {
    status: "resolved",
    songId,
    deezerTrackId,
    matchedBy
  };
}

function unresolved(
  songId: string,
  reason: UnresolvedTrackResult["reason"],
  candidates: ResolverTrack[]
): UnresolvedTrackResult {
  return {
    status: "needs_confirmation",
    songId,
    reason,
    candidates: candidates.map((candidate) => ({
      deezerTrackId: candidate.id,
      title: candidate.title,
      artistName: candidate.artist.name,
      albumTitle: candidate.album?.title ?? null
    }))
  };
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}
