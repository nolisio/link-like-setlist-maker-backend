import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSongPreviewForSong } from "../services/songPreviewService.js";
import { searchDeezerTracks } from "../clients/deezerClient.js";
import { findSongPreview, upsertSongPreview } from "../repositories/songPreviewRepository.js";
import type { SongWithUnit } from "../repositories/catalogRepository.js";

vi.mock("../clients/deezerClient.js", () => ({
  getDeezerTrack: vi.fn(),
  searchDeezerTracks: vi.fn()
}));

vi.mock("../repositories/songPreviewRepository.js", () => ({
  findSongPreview: vi.fn(),
  upsertSongPreview: vi.fn()
}));

const findSongPreviewMock = vi.mocked(findSongPreview);
const searchDeezerTracksMock = vi.mocked(searchDeezerTracks);
const upsertSongPreviewMock = vi.mocked(upsertSongPreview);

function createSong(input: Partial<SongWithUnit>): SongWithUnit {
  return {
    id: "perenial",
    title: "Perenial",
    titleJa: "ペレニアル",
    unitId: "hasu-no-sanrenka",
    sortOrder: 189,
    releaseDate: new Date("2026-06-03T00:00:00.000Z"),
    deezerSearchTitle: null,
    deezerArtistName: null,
    deezerArtistId: null,
    deezerTrackId: null,
    unit: {
      id: "hasu-no-sanrenka",
      name: "蓮ノ三連花",
      sortOrder: 10
    },
    ...input
  };
}

describe("song preview service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSongPreviewMock.mockResolvedValue(null);
    upsertSongPreviewMock.mockImplementation(async (input) => ({
      songId: input.songId,
      status: input.status,
      deezerTrackId: input.deezerTrackId ? BigInt(input.deezerTrackId) : null,
      deezerTrackTitle: input.deezerTrackTitle ?? null,
      deezerArtistName: input.deezerArtistName ?? null,
      deezerAlbumTitle: input.deezerAlbumTitle ?? null,
      duration: input.duration ?? null,
      previewUrl: input.previewUrl ?? null,
      trackLink: input.trackLink ?? null,
      isrc: input.isrc ?? null,
      rank: input.rank ?? null,
      fetchedAt: new Date("2026-06-29T00:00:00.000Z")
    }));
  });

  it("does not use an exact-title Deezer result from an unrelated artist when the seeded song has no artist hint", async () => {
    searchDeezerTracksMock.mockResolvedValue([
      {
        id: 2189790907,
        readable: true,
        title: "ペレニアル",
        link: "https://www.deezer.com/track/2189790907",
        duration: 148,
        rank: 100000,
        preview: "https://cdnt-preview.dzcdn.net/perenial.mp3",
        artist: {
          id: 123456789,
          name: "リラクゼーション Club 自然",
          type: "artist"
        },
        album: {
          id: 987654321,
          title: "フロントガラス越しに",
          type: "album"
        },
        type: "track"
      }
    ]);

    const result = await refreshSongPreviewForSong(createSong());

    expect(result).toMatchObject({
      songId: "perenial",
      status: "not_found",
      source: "deezer",
      stale: false,
      preview: null,
      skipped: false
    });
    expect(upsertSongPreviewMock).toHaveBeenCalledWith({
      songId: "perenial",
      status: "not_found"
    });
  });
});
