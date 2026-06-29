import type { SongPreview } from "@prisma/client";
import { getDeezerTrack, searchDeezerTracks, type DeezerTrack } from "../clients/deezerClient.js";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import { findSongById, type SongWithUnit } from "../repositories/catalogRepository.js";
import { findSongPreview, upsertSongPreview } from "../repositories/songPreviewRepository.js";

type PreviewStatus = "found" | "not_found" | "unavailable";
type PreviewSource = "cache" | "deezer";

type PreviewPayload = {
  deezerTrackId: number;
  title: string;
  artistName: string;
  albumTitle: string | null;
  duration: number | null;
  previewUrl: string;
  trackLink: string | null;
  isrc: string | null;
  rank: number | null;
};

export type SongPreviewResult = {
  songId: string;
  status: PreviewStatus;
  source: PreviewSource;
  stale: boolean;
  preview: PreviewPayload | null;
  fetchedAt: string;
};

export type SongPreviewRefreshResult = SongPreviewResult & {
  skipped: boolean;
};

export async function getSongPreview(songId: string, options: { refresh?: boolean } = {}): Promise<SongPreviewResult> {
  const { skipped: _skipped, ...result } = await refreshSongPreview(songId, options);
  return result;
}

export async function refreshSongPreview(
  songId: string,
  options: { refresh?: boolean } = {}
): Promise<SongPreviewRefreshResult> {
  const song = await findSongById(songId);
  if (!song) {
    throw new AppError(404, "NOT_FOUND", "Song not found");
  }

  return refreshSongPreviewForSong(song, options);
}

export async function refreshSongPreviewForSong(
  song: SongWithUnit,
  options: { refresh?: boolean } = {}
): Promise<SongPreviewRefreshResult> {
  const cache = await findSongPreview(song.id);
  const cacheMatchesSong = cache ? cachedPreviewMatchesSong(song, cache) : false;
  if (!options.refresh && cache && isFresh(cache.fetchedAt) && cacheMatchesSong) {
    return {
      ...resultFromCache(cache, "cache", false),
      skipped: true
    };
  }

  try {
    const preview = await lookupPreview(song);
    const cached = preview
      ? await upsertSongPreview({
          songId: song.id,
          status: "found",
          deezerTrackId: preview.deezerTrackId,
          deezerTrackTitle: preview.title,
          deezerArtistName: preview.artistName,
          deezerAlbumTitle: preview.albumTitle,
          duration: preview.duration,
          previewUrl: preview.previewUrl,
          trackLink: preview.trackLink,
          isrc: preview.isrc,
          rank: preview.rank
        })
      : await upsertSongPreview({
          songId: song.id,
          status: "not_found"
        });

    return {
      ...resultFromCache(cached, "deezer", false),
      skipped: false
    };
  } catch (error) {
    if (cacheMatchesSong && cache?.status === "found" && cache.previewUrl) {
      return {
        ...resultFromCache(cache, "cache", true, "unavailable"),
        skipped: false
      };
    }

    const unavailable = await upsertSongPreview({
      songId: song.id,
      status: "unavailable"
    });

    return {
      ...resultFromCache(unavailable, "deezer", false),
      skipped: false
    };
  }
}

function isFresh(fetchedAt: Date) {
  const ageMs = Date.now() - fetchedAt.getTime();
  return ageMs <= config.deezerPreviewCacheTtlSeconds * 1000;
}

function cachedPreviewMatchesSong(song: SongWithUnit, cache: SongPreview) {
  if (cache.status !== "found") {
    return true;
  }

  if (!cache.previewUrl || !cache.deezerTrackTitle) {
    return false;
  }

  if (song.deezerTrackId) {
    return cache.deezerTrackId ? Number(cache.deezerTrackId) === Number(song.deezerTrackId) : false;
  }

  const expectedTitle = normalize(song.deezerSearchTitle ?? song.titleJa ?? song.title);
  if (!titleMatches(expectedTitle, cache.deezerTrackTitle)) {
    return false;
  }

  if (!song.deezerArtistName) {
    return true;
  }

  return cache.deezerArtistName ? normalize(cache.deezerArtistName) === normalize(song.deezerArtistName) : false;
}

async function lookupPreview(song: SongWithUnit) {
  if (song.deezerTrackId) {
    return previewFromTrack(await getDeezerTrack(Number(song.deezerTrackId)));
  }

  if (!hasDeezerSearchHint(song)) {
    return null;
  }

  const title = song.deezerSearchTitle ?? song.titleJa ?? song.title;
  const query = [title, song.deezerArtistName].filter(Boolean).join(" ");
  const tracks = await searchDeezerTracks(query);
  const match = chooseBestCandidate(song, tracks);

  return match ? previewFromTrack(match) : null;
}

function hasDeezerSearchHint(song: SongWithUnit) {
  return Boolean(
    song.deezerSearchTitle || song.deezerArtistName || song.deezerArtistId
  );
}

function chooseBestCandidate(song: SongWithUnit, tracks: DeezerTrack[]) {
  const candidates = tracks.filter((track) => hasPreview(track));
  if (candidates.length === 0) {
    return null;
  }

  const expectedTitle = normalize(song.deezerSearchTitle ?? song.titleJa ?? song.title);
  const expectedArtist = song.deezerArtistName ? normalize(song.deezerArtistName) : null;

  if (song.deezerArtistId) {
    const artistMatches = candidates.filter((track) => track.artist.id === song.deezerArtistId);
    return artistMatches.find((track) => titleMatches(expectedTitle, track.title)) ?? null;
  }

  return (
    candidates.find((track) => {
      const titleOk = titleMatches(expectedTitle, track.title);
      const artistOk = expectedArtist ? normalize(track.artist.name) === expectedArtist : true;
      return titleOk && artistOk;
    }) ?? null
  );
}

function hasPreview(track: DeezerTrack) {
  return typeof track.preview === "string" && track.preview.trim().length > 0;
}

function titleMatches(expectedTitle: string, candidateTitle: string) {
  const expected = normalize(expectedTitle);
  const candidate = normalize(candidateTitle);
  return candidate === expected;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function previewFromTrack(track: DeezerTrack): PreviewPayload | null {
  if (!hasPreview(track)) {
    return null;
  }

  return {
    deezerTrackId: track.id,
    title: track.title,
    artistName: track.artist.name,
    albumTitle: track.album?.title ?? null,
    duration: track.duration ?? null,
    previewUrl: track.preview!.trim(),
    trackLink: track.link ?? null,
    isrc: track.isrc ?? null,
    rank: track.rank ?? null
  };
}

function resultFromCache(
  cache: SongPreview,
  source: PreviewSource,
  stale: boolean,
  statusOverride?: PreviewStatus
): SongPreviewResult {
  const status = statusOverride ?? cacheStatus(cache.status);

  return {
    songId: cache.songId,
    status,
    source,
    stale,
    preview:
      cache.status === "found" && cache.deezerTrackId && cache.deezerTrackTitle && cache.deezerArtistName && cache.previewUrl
        ? {
            deezerTrackId: Number(cache.deezerTrackId),
            title: cache.deezerTrackTitle,
            artistName: cache.deezerArtistName,
            albumTitle: cache.deezerAlbumTitle,
            duration: cache.duration,
            previewUrl: cache.previewUrl,
            trackLink: cache.trackLink,
            isrc: cache.isrc,
            rank: cache.rank
          }
        : null,
    fetchedAt: cache.fetchedAt.toISOString()
  };
}

function cacheStatus(status: string): PreviewStatus {
  if (status === "found" || status === "not_found" || status === "unavailable") {
    return status;
  }

  return "unavailable";
}
