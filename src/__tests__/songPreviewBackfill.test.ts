import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/client.js";
import { seedCatalog } from "../../prisma/seed.js";
import { findSongPreview } from "../repositories/songPreviewRepository.js";
import { backfillSongPreviews } from "../services/songPreviewBackfillService.js";

async function resetDatabase() {
  await (
    prisma as unknown as {
      songPreview?: {
        deleteMany: () => Promise<unknown>;
      };
    }
  ).songPreview?.deleteMany();
  await prisma.setlistItem.deleteMany();
  await prisma.setlist.deleteMany();
  await prisma.song.deleteMany();
  await prisma.unit.deleteMany();
  await seedCatalog();
}

async function forceSearchPreviewLookup(songId: string) {
  await prisma.song.update({
    where: { id: songId },
    data: { deezerTrackId: null }
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("song preview backfill", () => {
  it("stores found previews for track-id and search-based songs", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/track/2967993121")) {
        return Response.json({
          id: 2967993121,
          readable: true,
          title: "Dream Believers",
          isrc: "JPI102300001",
          link: "https://www.deezer.com/track/2967993121",
          duration: 284,
          rank: 111,
          preview: "https://cdnt-preview.dzcdn.net/dream.mp3",
          artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ", type: "artist" },
          album: { id: 1, title: "Dream Believers", type: "album" },
          type: "track"
        });
      }

      return Response.json({
        data: [
          {
            id: 2967994891,
            readable: true,
            title: "Holiday∞Holiday",
            title_short: "Holiday∞Holiday",
            title_version: "",
            isrc: "JPI102300074",
            link: "https://www.deezer.com/track/2967994891",
            duration: 256,
            rank: 222,
            preview: "https://cdnt-preview.dzcdn.net/holiday.mp3",
            artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
            album: { id: 2, title: "Holiday∞Holiday", type: "album" },
            type: "track"
          }
        ],
        total: 1
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const summary = await backfillSongPreviews({
      songIds: ["dream-believers", "holiday-holiday"],
      refresh: true
    });

    expect(summary).toMatchObject({
      total: 2,
      found: 2,
      notFound: 0,
      unavailable: 0,
      skipped: 0
    });

    await expect(findSongPreview("dream-believers")).resolves.toMatchObject({
      status: "found",
      previewUrl: "https://cdnt-preview.dzcdn.net/dream.mp3"
    });
    await expect(findSongPreview("holiday-holiday")).resolves.toMatchObject({
      status: "found",
      previewUrl: "https://cdnt-preview.dzcdn.net/holiday.mp3"
    });
  });

  it("skips fresh cached previews unless refresh is requested", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 2967994891,
              readable: true,
              title: "Holiday∞Holiday",
              title_short: "Holiday∞Holiday",
              title_version: "",
              isrc: "JPI102300074",
              link: "https://www.deezer.com/track/2967994891",
              duration: 256,
              rank: 222,
              preview: "https://cdnt-preview.dzcdn.net/holiday.mp3",
              artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
              album: { id: 2, title: "Holiday∞Holiday", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      )
    );

    await backfillSongPreviews({
      songIds: ["holiday-holiday"],
      refresh: true
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const summary = await backfillSongPreviews({
      songIds: ["holiday-holiday"]
    });

    expect(summary).toMatchObject({
      total: 1,
      found: 0,
      notFound: 0,
      unavailable: 0,
      skipped: 1
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores not_found when Deezer has no usable match", async () => {
    await forceSearchPreviewLookup("on-your-mark");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [],
          total: 0
        })
      )
    );

    const summary = await backfillSongPreviews({
      songIds: ["on-your-mark"],
      refresh: true
    });

    expect(summary).toMatchObject({
      total: 1,
      found: 0,
      notFound: 1,
      unavailable: 0,
      skipped: 0
    });
    await expect(findSongPreview("on-your-mark")).resolves.toMatchObject({
      status: "not_found"
    });
  });

  it("stores unavailable and continues processing later songs", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/track/2967993121")) {
        throw new Error("deezer down");
      }

      return Response.json({
        data: [
          {
            id: 2967994891,
            readable: true,
            title: "Holiday∞Holiday",
            title_short: "Holiday∞Holiday",
            title_version: "",
            isrc: "JPI102300074",
            link: "https://www.deezer.com/track/2967994891",
            duration: 256,
            rank: 222,
            preview: "https://cdnt-preview.dzcdn.net/holiday.mp3",
            artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
            album: { id: 2, title: "Holiday∞Holiday", type: "album" },
            type: "track"
          }
        ],
        total: 1
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const summary = await backfillSongPreviews({
      songIds: ["dream-believers", "holiday-holiday"],
      refresh: true
    });

    expect(summary).toMatchObject({
      total: 2,
      found: 1,
      notFound: 0,
      unavailable: 1,
      skipped: 0
    });
    await expect(findSongPreview("dream-believers")).resolves.toMatchObject({
      status: "unavailable"
    });
    await expect(findSongPreview("holiday-holiday")).resolves.toMatchObject({
      status: "found"
    });
  });
});
