import { describe, expect, it, vi } from "vitest";
import { resolveSongDeezerTrackId, type ResolverSongSeed } from "../services/deezerTrackResolver.js";

function makeSong(overrides: Partial<ResolverSongSeed> = {}): ResolverSongSeed {
  return {
    id: "on-your-mark",
    title: "On your mark",
    titleJa: "On your mark",
    unitId: "dollchestra",
    sortOrder: 2,
    deezerSearchTitle: "On your mark",
    deezerArtistName: "DOLLCHESTRA",
    deezerArtistId: 205924807,
    ...overrides
  };
}

describe("resolveSongDeezerTrackId", () => {
  it("resolves automatically when a single candidate matches the song metadata", async () => {
    const searchTracks = vi.fn(async () => [
      {
        id: 2967993131,
        title: "On your mark",
        preview: "https://example.com/preview.mp3",
        artist: { id: 205924807, name: "DOLLCHESTRA" },
        album: { id: 1, title: "Dream Believers" }
      }
    ]);

    const result = await resolveSongDeezerTrackId(makeSong(), {
      searchTracks,
      overrides: {}
    });

    expect(result).toEqual({
      status: "resolved",
      songId: "on-your-mark",
      deezerTrackId: 2967993131,
      matchedBy: "artist_id"
    });
  });

  it("returns unresolved when no candidate can be matched", async () => {
    const searchTracks = vi.fn(async () => []);

    const result = await resolveSongDeezerTrackId(makeSong(), {
      searchTracks,
      overrides: {}
    });

    expect(result).toMatchObject({
      status: "needs_confirmation",
      songId: "on-your-mark",
      reason: "no_candidates",
      candidates: []
    });
  });

  it("returns unresolved with candidates when multiple matches remain", async () => {
    const searchTracks = vi.fn(async () => [
      {
        id: 1,
        title: "On your mark",
        preview: "https://example.com/1.mp3",
        artist: { id: 205924807, name: "DOLLCHESTRA" },
        album: { id: 10, title: "Album A" }
      },
      {
        id: 2,
        title: "On your mark",
        preview: "https://example.com/2.mp3",
        artist: { id: 205924807, name: "DOLLCHESTRA" },
        album: { id: 11, title: "Album B" }
      }
    ]);

    const result = await resolveSongDeezerTrackId(makeSong(), {
      searchTracks,
      overrides: {}
    });

    expect(result).toMatchObject({
      status: "needs_confirmation",
      songId: "on-your-mark",
      reason: "multiple_candidates",
      candidates: [
        { deezerTrackId: 1, title: "On your mark", artistName: "DOLLCHESTRA", albumTitle: "Album A" },
        { deezerTrackId: 2, title: "On your mark", artistName: "DOLLCHESTRA", albumTitle: "Album B" }
      ]
    });
  });

  it("uses a saved override before searching Deezer", async () => {
    const searchTracks = vi.fn();

    const result = await resolveSongDeezerTrackId(makeSong(), {
      searchTracks,
      overrides: {
        "on-your-mark": 2967993131
      }
    });

    expect(result).toEqual({
      status: "resolved",
      songId: "on-your-mark",
      deezerTrackId: 2967993131,
      matchedBy: "override"
    });
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it("treats an explicit skip override as unresolved without prompting again", async () => {
    const searchTracks = vi.fn();

    const result = await resolveSongDeezerTrackId(makeSong({ id: "ijigen-bigbang" }), {
      searchTracks,
      overrides: {
        "ijigen-bigbang": null
      }
    });

    expect(result).toEqual({
      status: "skipped",
      songId: "ijigen-bigbang"
    });
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it("falls back to the unit default Deezer artist when the seed has no explicit artist metadata", async () => {
    const searchTracks = vi.fn(async (query: string) =>
      query === "AWOKE DOLLCHESTRA"
        ? [
            {
              id: 2967993151,
              title: "AWOKE",
              preview: "https://example.com/preview.mp3",
              artist: { id: 205924807, name: "DOLLCHESTRA" },
              album: { id: 1, title: "Dream Believers" }
            }
          ]
        : []
    );
    const listArtistTopTracks = vi.fn(async () => []);

    const result = await resolveSongDeezerTrackId(
      makeSong({
        id: "awoke",
        title: "AWOKE",
        titleJa: "AWOKE",
        deezerSearchTitle: "AWOKE",
        deezerArtistName: undefined,
        deezerArtistId: undefined
      }),
      {
        searchTracks,
        listArtistTopTracks,
        overrides: {}
      }
    );

    expect(result).toEqual({
      status: "resolved",
      songId: "awoke",
      deezerTrackId: 2967993151,
      matchedBy: "artist_id"
    });
    expect(searchTracks).toHaveBeenCalledWith("AWOKE DOLLCHESTRA");
  });

  it("falls back to album tracks when search results only contain versioned or off-vocal variants", async () => {
    const searchTracks = vi.fn(async () => [
      {
        id: 3326683041,
        title: "Mix shake!! (104期Ver.)",
        preview: "https://example.com/104.mp3",
        artist: { id: 205924797, name: "スリーズブーケ" },
        album: { id: 100, title: "104th Collection" }
      },
      {
        id: 2967994111,
        title: "Mix shake!! (Off Vocal)",
        preview: "https://example.com/off.mp3",
        artist: { id: 205924797, name: "スリーズブーケ" },
        album: { id: 101, title: "Reflection in the mirror" }
      }
    ]);
    const listArtistTopTracks = vi.fn(async () => [
      {
        id: 3326683051,
        title: "Holiday∞Holiday (104期Ver.)",
        preview: "https://example.com/holiday.mp3",
        artist: { id: 205924797, name: "スリーズブーケ" },
        album: { id: 100, title: "104th Collection" }
      }
    ]);
    const listAlbumTracks = vi.fn(async (albumId: number) =>
      albumId === 101
        ? [
            {
              id: 2967994081,
              title: "Mix shake!!",
              preview: "https://example.com/main.mp3",
              artist: { id: 205924797, name: "スリーズブーケ" },
              album: { id: 101, title: "Reflection in the mirror" }
            }
          ]
        : []
    );

    const result = await resolveSongDeezerTrackId(
      makeSong({
        id: "mix-shake",
        title: "Mix shake!!",
        titleJa: "Mix shake!!",
        unitId: "cerise-bouquet",
        deezerSearchTitle: "Mix shake!!",
        deezerArtistName: undefined,
        deezerArtistId: undefined
      }),
      {
        searchTracks,
        listArtistTopTracks,
        listAlbumTracks,
        overrides: {}
      }
    );

    expect(result).toEqual({
      status: "resolved",
      songId: "mix-shake",
      deezerTrackId: 2967994081,
      matchedBy: "artist_id"
    });
    expect(listArtistTopTracks).toHaveBeenCalledWith(205924797);
    expect(listAlbumTracks).toHaveBeenCalledWith(101);
  });

  it("prefers a single exact title match before returning multiple artist-level candidates", async () => {
    const searchTracks = vi.fn(async () => [
      {
        id: 2591204472,
        title: "ツバサ・ラ・リベルテ",
        preview: "https://example.com/tsubasa.mp3",
        artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ" },
        album: { id: 525370702, title: "Link to the FUTURE" }
      },
      {
        id: 2591204482,
        title: "Link to the FUTURE",
        preview: "https://example.com/link.mp3",
        artist: { id: 205924797, name: "スリーズブーケ" },
        album: { id: 525370702, title: "Link to the FUTURE" }
      },
      {
        id: 2591204492,
        title: "Trick ＆ Cute (Off Vocal)",
        preview: "https://example.com/trick.mp3",
        artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ" },
        album: { id: 525370702, title: "Link to the FUTURE" }
      }
    ]);

    const result = await resolveSongDeezerTrackId(
      makeSong({
        id: "link-to-the-future",
        title: "Link to the FUTURE",
        titleJa: "Link to the FUTURE",
        unitId: "hasunosora",
        deezerSearchTitle: undefined,
        deezerArtistName: undefined,
        deezerArtistId: undefined
      }),
      {
        searchTracks,
        overrides: {}
      }
    );

    expect(result).toEqual({
      status: "resolved",
      songId: "link-to-the-future",
      deezerTrackId: 2591204482,
      matchedBy: "title"
    });
  });

  it("uses Deezer artist defaults for derived unit ids", async () => {
    const searchTracks = vi.fn(async () => [
      {
        id: 2680957152,
        title: "Colorfulness",
        preview: "https://example.com/colorfulness.mp3",
        artist: { id: 256178002, name: "るりのとゆかいなつづりたち" },
        album: { id: 54321, title: "Colorfulness / Happy Shijo Shugi! / Pleasure Feather" }
      },
      {
        id: 2735284671,
        title: "Colorfulness",
        preview: "https://example.com/other.mp3",
        artist: { id: 4951401, name: "Rene muenzer" },
        album: { id: 67890, title: "Kidsclub Vol.3" }
      }
    ]);

    const result = await resolveSongDeezerTrackId(
      makeSong({
        id: "colorfulness",
        title: "Colorfulness",
        titleJa: "Colorfulness",
        unitId: "rurino-to-yukai-na-tsuzuri-tachi",
        deezerSearchTitle: undefined,
        deezerArtistName: undefined,
        deezerArtistId: undefined
      }),
      {
        searchTracks,
        overrides: {}
      }
    );

    expect(result).toEqual({
      status: "resolved",
      songId: "colorfulness",
      deezerTrackId: 2680957152,
      matchedBy: "artist_id"
    });
  });

  it("returns no_candidates when only other artists have title matches and artist fallback is unrelated", async () => {
    const searchTracks = vi.fn(async (query: string) => {
      if (query === "Asterism") {
        return [
          {
            id: 3030788661,
            title: "Asterism",
            preview: "https://example.com/after-noon.mp3",
            artist: { id: 2001, name: "after noon" },
            album: { id: 20, title: "Sailboats and Constellations" }
          },
          {
            id: 708906032,
            title: "Asterism",
            preview: "https://example.com/ecepta.mp3",
            artist: { id: 2002, name: "Ecepta" },
            album: { id: 21, title: "Asterism / Nebula" }
          }
        ];
      }

      return [];
    });
    const listArtistTopTracks = vi.fn(async () => [
      {
        id: 2967993121,
        title: "Dream Believers",
        preview: "https://example.com/dream.mp3",
        artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ" },
        album: { id: 10, title: "Dream Believers" }
      },
      {
        id: 2967993131,
        title: "On your mark",
        preview: "https://example.com/on-your-mark.mp3",
        artist: { id: 205924787, name: "蓮ノ空女学院スクールアイドルクラブ" },
        album: { id: 11, title: "On your mark" }
      }
    ]);
    const listAlbumTracks = vi.fn(async () => []);

    const result = await resolveSongDeezerTrackId(
      makeSong({
        id: "asterism",
        title: "Asterism",
        titleJa: "アステリズム",
        unitId: "hasunosora",
        deezerSearchTitle: undefined,
        deezerArtistName: undefined,
        deezerArtistId: undefined
      }),
      {
        searchTracks,
        listArtistTopTracks,
        listAlbumTracks,
        overrides: {}
      }
    );

    expect(result).toEqual({
      status: "needs_confirmation",
      songId: "asterism",
      reason: "no_candidates",
      candidates: []
    });
  });
});
