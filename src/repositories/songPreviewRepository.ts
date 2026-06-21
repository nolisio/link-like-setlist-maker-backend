import { prisma } from "../db/client.js";

export type SongPreviewCacheInput = {
  songId: string;
  status: string;
  deezerTrackId?: number | bigint | null;
  deezerTrackTitle?: string | null;
  deezerArtistName?: string | null;
  deezerAlbumTitle?: string | null;
  duration?: number | null;
  previewUrl?: string | null;
  trackLink?: string | null;
  isrc?: string | null;
  rank?: number | null;
  fetchedAt?: Date;
};

export async function findSongPreview(songId: string) {
  return prisma.songPreview.findUnique({
    where: { songId }
  });
}

export async function upsertSongPreview(input: SongPreviewCacheInput) {
  const data = {
    status: input.status,
    deezerTrackId: input.deezerTrackId === undefined || input.deezerTrackId === null ? null : BigInt(input.deezerTrackId),
    deezerTrackTitle: input.deezerTrackTitle ?? null,
    deezerArtistName: input.deezerArtistName ?? null,
    deezerAlbumTitle: input.deezerAlbumTitle ?? null,
    duration: input.duration ?? null,
    previewUrl: input.previewUrl ?? null,
    trackLink: input.trackLink ?? null,
    isrc: input.isrc ?? null,
    rank: input.rank ?? null,
    fetchedAt: input.fetchedAt ?? new Date()
  };

  return prisma.songPreview.upsert({
    where: { songId: input.songId },
    update: data,
    create: {
      songId: input.songId,
      ...data
    }
  });
}
