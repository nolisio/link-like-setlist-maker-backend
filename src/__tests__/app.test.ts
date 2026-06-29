import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { prisma } from "../db/client.js";
import { seedCatalog } from "../../prisma/seed.js";
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

async function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

const serviceAuthHeaders = {
  authorization: `Bearer ${process.env.BACKEND_API_TOKEN ?? "test-backend-token"}`
};

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health and docs", () => {
  it("returns health status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ status: "ok" });
  });

  it("serves OpenAPI JSON and Swagger UI", async () => {
    const openApiResponse = await app.request("/openapi.json");
    const docsResponse = await app.request("/docs");

    expect(openApiResponse.status).toBe(200);
    expect(docsResponse.status).toBe(200);
    expect(openApiResponse.headers.get("content-type")).toContain("application/json");
    expect(docsResponse.headers.get("content-type")).toContain("text/html");
  });
});

describe("catalog API", () => {
  it("returns seeded units and songs", async () => {
    const unitsResponse = await app.request("/api/units");
    const songsResponse = await app.request("/api/songs");

    expect(unitsResponse.status).toBe(200);
    expect(songsResponse.status).toBe(200);

    const units = (await unitsResponse.json()) as { units: Array<{ id: string; name: string }> };
    const songs = (await songsResponse.json()) as {
      songs: Array<{ id: string; title: string; unitId: string }>;
    };

    expect(units.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "hasunosora", name: "蓮ノ空女学院スクールアイドルクラブ" })
      ])
    );
    expect(songs.songs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dream-believers", title: "Dream Believers" }),
        expect.objectContaining({ id: "eien-no-euphoria", title: "永遠のEuphoria" }),
        expect.objectContaining({ id: "holiday-holiday", title: "Holiday∞Holiday" })
      ])
    );
  });

  it("filters songs by query and unit", async () => {
    const response = await app.request("/api/songs?q=holiday&unitId=cerise-bouquet");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { songs: Array<{ id: string; title: string; unitId: string }> };

    expect(body.songs).toHaveLength(1);
    expect(body.songs[0]).toMatchObject({
      id: "holiday-holiday",
      title: "Holiday∞Holiday",
      unitId: "cerise-bouquet"
    });
  });

  it("returns a single song by id", async () => {
    const response = await app.request("/api/songs/dream-believers");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      song: { id: "dream-believers", title: "Dream Believers" }
    });
  });

  it("returns titleJa for songs without an explicit Japanese seed title", async () => {
    const response = await app.request("/api/songs/awoke");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      song: { id: "awoke", title: "AWOKE", titleJa: "AWOKE" }
    });
  });

  it("returns corrected katakana titleJa when the official title differs from the romanized title", async () => {
    const response = await app.request("/api/songs/scapegoat");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      song: { id: "scapegoat", title: "Scapegoat", titleJa: "スケイプゴート" }
    });
  });
});

describe("song preview API", () => {
  async function forceSearchPreviewLookup(songId: string) {
    await prisma.song.update({
      where: { id: songId },
      data: { deezerTrackId: null }
    });
  }

  function stubDeezerSearchResponse(track: {
    id: number;
    title: string;
    artistName: string;
    albumTitle: string;
    preview: string;
    duration?: number;
    isrc?: string;
    rank?: number;
  }) {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: track.id,
            readable: true,
            title: track.title,
            title_short: track.title,
            title_version: "",
            isrc: track.isrc ?? "JPI102300074",
            link: `https://www.deezer.com/track/${track.id}`,
            duration: track.duration ?? 256,
            rank: track.rank ?? 41585,
            preview: track.preview,
            artist: {
              id: 205924797,
              name: track.artistName,
              type: "artist"
            },
            album: {
              id: 635338091,
              title: track.albumTitle,
              type: "album"
            },
            type: "track"
          }
        ],
        total: 1
      })
    );

    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fetches a Deezer preview through search and then serves it from cache", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    const fetchMock = stubDeezerSearchResponse({
      id: 2967994891,
      title: "Holiday∞Holiday",
      artistName: "スリーズブーケ",
      albumTitle: "Holiday∞Holiday / Tragic Drops【スリーズブーケ盤】",
      preview: "https://cdnt-preview.dzcdn.net/holiday.mp3"
    });

    const firstResponse = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });
    const secondResponse = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "found",
      source: "deezer",
      stale: false,
      preview: {
        deezerTrackId: 2967994891,
        title: "Holiday∞Holiday",
        artistName: "スリーズブーケ",
        albumTitle: "Holiday∞Holiday / Tragic Drops【スリーズブーケ盤】",
        duration: 256,
        previewUrl: "https://cdnt-preview.dzcdn.net/holiday.mp3",
        trackLink: "https://www.deezer.com/track/2967994891",
        isrc: "JPI102300074"
      }
    });

    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "found",
      source: "cache",
      stale: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes Deezer preview cache when refresh=true is provided", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: 2967994891,
              readable: true,
              title: "Holiday∞Holiday",
              link: "https://www.deezer.com/track/2967994891",
              duration: 256,
              rank: 100,
              preview: "https://cdnt-preview.dzcdn.net/holiday-old.mp3",
              artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
              album: { id: 635338091, title: "Holiday∞Holiday", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: 2967994891,
              readable: true,
              title: "Holiday∞Holiday",
              link: "https://www.deezer.com/track/2967994891",
              duration: 256,
              rank: 101,
              preview: "https://cdnt-preview.dzcdn.net/holiday-new.mp3",
              artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
              album: { id: 635338091, title: "Holiday∞Holiday", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });
    const response = await app.request("/api/songs/holiday-holiday/preview?refresh=true", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "deezer",
      preview: {
        previewUrl: "https://cdnt-preview.dzcdn.net/holiday-new.mp3",
        rank: 101
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses Deezer track lookup when a seeded Deezer track id exists", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("/track/2967993121");
      return Response.json({
        id: 2967993121,
        readable: true,
        title: "Dream Believers",
        isrc: "JPI102300038",
        link: "https://www.deezer.com/track/2967993121",
        duration: 284,
        rank: 12345,
        preview: "https://cdnt-preview.dzcdn.net/dream.mp3",
        artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ", type: "artist" },
        album: { id: 635336921, title: "Dream Believers", type: "album" },
        type: "track"
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/songs/dream-believers/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "dream-believers",
      status: "found",
      preview: {
        deezerTrackId: 2967993121,
        artistName: "蓮ノ空女学院スクールアイドルクラブ"
      }
    });
  });

  it("returns not_found when Deezer has no matching preview result", async () => {
    await forceSearchPreviewLookup("on-your-mark");
    const fetchMock = vi.fn(async () => Response.json({ data: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/songs/on-your-mark/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "on-your-mark",
      status: "not_found",
      source: "deezer",
      stale: false,
      preview: null
    });
  });

  it("does not play a different Deezer track from the same artist when the requested song is missing", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 4000000001,
              readable: true,
              title: "Perennial",
              link: "https://www.deezer.com/track/4000000001",
              duration: 240,
              rank: 100,
              preview: "https://cdnt-preview.dzcdn.net/perennial.mp3",
              artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
              album: { id: 700000000, title: "Perennial", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      )
    );

    const response = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "not_found",
      source: "deezer",
      stale: false,
      preview: null
    });
  });

  it("does not use an exact-title Deezer result from an unrelated artist when the seeded song has no artist hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 2189790907,
              readable: true,
              title: "ペレニアル",
              link: "https://www.deezer.com/track/2189790907",
              duration: 148,
              rank: 100000,
              preview: "https://cdnt-preview.dzcdn.net/perenial.mp3",
              artist: { id: 123456789, name: "リラクゼーション Club 自然", type: "artist" },
              album: { id: 987654321, title: "フロントガラス越しに", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      )
    );

    const response = await app.request("/api/songs/perenial/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "perenial",
      status: "not_found",
      source: "deezer",
      stale: false,
      preview: null
    });
  });

  it("does not treat a shorter same-artist title as the requested versioned song", async () => {
    await prisma.song.update({
      where: { id: "holiday-holiday" },
      data: {
        deezerTrackId: null,
        deezerSearchTitle: "Holiday∞Holiday 104期Ver.",
        titleJa: "Holiday∞Holiday (104期Ver.)"
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 2967994891,
              readable: true,
              title: "Holiday∞Holiday",
              link: "https://www.deezer.com/track/2967994891",
              duration: 256,
              rank: 100,
              preview: "https://cdnt-preview.dzcdn.net/holiday.mp3",
              artist: { id: 205924797, name: "スリーズブーケ", type: "artist" },
              album: { id: 635338091, title: "Holiday∞Holiday", type: "album" },
              type: "track"
            }
          ],
          total: 1
        })
      )
    );

    const response = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "not_found",
      preview: null
    });
  });

  it("ignores a fresh cached preview when it belongs to a different Deezer track", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    await prisma.songPreview.create({
      data: {
        songId: "holiday-holiday",
        status: "found",
        deezerTrackId: BigInt(4000000001),
        deezerTrackTitle: "Perennial",
        deezerArtistName: "スリーズブーケ",
        deezerAlbumTitle: "Perennial",
        duration: 240,
        previewUrl: "https://cdnt-preview.dzcdn.net/perennial.mp3",
        trackLink: "https://www.deezer.com/track/4000000001",
        rank: 100
      }
    });
    const fetchMock = vi.fn(async () => Response.json({ data: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "not_found",
      source: "deezer",
      stale: false,
      preview: null
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(prisma.songPreview.findUnique({ where: { songId: "holiday-holiday" } })).resolves.toMatchObject({
      status: "not_found",
      previewUrl: null
    });
  });

  it("returns unavailable with stale preview when Deezer fails after cache expiry", async () => {
    await forceSearchPreviewLookup("holiday-holiday");
    const fetchMock = stubDeezerSearchResponse({
      id: 2967994891,
      title: "Holiday∞Holiday",
      artistName: "スリーズブーケ",
      albumTitle: "Holiday∞Holiday",
      preview: "https://cdnt-preview.dzcdn.net/holiday.mp3"
    });
    await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    const staleFetchedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await prisma.songPreview.update({
      where: { songId: "holiday-holiday" },
      data: { fetchedAt: new Date(staleFetchedAt) }
    });

    fetchMock.mockRejectedValueOnce(new Error("Deezer is unavailable"));
    const response = await app.request("/api/songs/holiday-holiday/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "holiday-holiday",
      status: "unavailable",
      source: "cache",
      stale: true,
      preview: {
        previewUrl: "https://cdnt-preview.dzcdn.net/holiday.mp3"
      }
    });
  });

  it("returns 404 for preview lookup on an unknown song", async () => {
    const response = await app.request("/api/songs/missing-song/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Song not found" }
    });
  });

  it("serves a backfilled preview from cache without calling Deezer again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: 2967993121,
          readable: true,
          title: "Dream Believers",
          isrc: "JPI102300001",
          link: "https://www.deezer.com/track/2967993121",
          duration: 284,
          rank: 41585,
          preview: "https://cdnt-preview.dzcdn.net/dream.mp3",
          artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ", type: "artist" },
          album: { id: 635338091, title: "Dream Believers", type: "album" },
          type: "track"
        })
      )
    );

    await backfillSongPreviews({
      songIds: ["dream-believers"],
      refresh: true
    });

    const fetchMock = vi.fn(async () => {
      throw new Error("should not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request("/api/songs/dream-believers/preview", { headers: serviceAuthHeaders });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      songId: "dream-believers",
      status: "found",
      source: "cache",
      stale: false,
      preview: {
        previewUrl: "https://cdnt-preview.dzcdn.net/dream.mp3"
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("setlist API", () => {
  it("creates and reads a setlist", async () => {
    const createResponse = await app.request("/api/setlists", {
      method: "POST",
      headers: { ...serviceAuthHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Opening block",
        description: "Two song flow",
        items: [
          { songId: "dream-believers", memo: "Start" },
          { songId: "holiday-holiday", memo: "Follow" }
        ]
      })
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      setlist: { id: string; title: string; items: Array<{ position: number; songId: string; memo: string | null }> };
    };
    expect(created.setlist.title).toBe("Opening block");
    expect(created.setlist.items).toEqual([
      expect.objectContaining({ position: 1, songId: "dream-believers", memo: "Start" }),
      expect.objectContaining({ position: 2, songId: "holiday-holiday", memo: "Follow" })
    ]);

    const getResponse = await app.request(`/api/setlists/${created.setlist.id}`);
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      setlist: { id: created.setlist.id, title: "Opening block" }
    });
  });

  it("rejects invalid setlist payloads and unknown song ids", async () => {
    const blankTitleResponse = await app.request("/api/setlists", {
      method: "POST",
      headers: { ...serviceAuthHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "   ", items: [] })
    });
    expect(blankTitleResponse.status).toBe(400);

    const malformedItemsResponse = await app.request("/api/setlists", {
      method: "POST",
      headers: { ...serviceAuthHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "Bad items", items: [{ memo: "missing song" }] })
    });
    expect(malformedItemsResponse.status).toBe(400);

    const unknownSongResponse = await app.request("/api/setlists", {
      method: "POST",
      headers: { ...serviceAuthHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "Unknown song", items: [{ songId: "missing-song" }] })
    });
    expect(unknownSongResponse.status).toBe(400);
    await expect(unknownSongResponse.json()).resolves.toEqual({
      error: { code: "INVALID_SONG", message: "One or more songs do not exist", details: { songIds: ["missing-song"] } }
    });
  });

  it("returns 404 for an unknown setlist id", async () => {
    const response = await app.request("/api/setlists/missing-setlist");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Setlist not found" }
    });
  });
});
