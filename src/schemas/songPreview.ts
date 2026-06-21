import { z } from "@hono/zod-openapi";

export const SongPreviewQuerySchema = z.object({
  refresh: z.enum(["true", "false"]).optional().openapi({ example: "true" })
});

export const SongPreviewSchema = z
  .object({
    deezerTrackId: z.number().int().openapi({ example: 2967993121 }),
    title: z.string().openapi({ example: "Dream Believers" }),
    artistName: z.string().openapi({ example: "蓮ノ空女学院スクールアイドルクラブ" }),
    albumTitle: z.string().nullable().openapi({ example: "Dream Believers" }),
    duration: z.number().int().nullable().openapi({ example: 284 }),
    previewUrl: z.string().url().openapi({ example: "https://cdnt-preview.dzcdn.net/example.mp3" }),
    trackLink: z.string().url().nullable().openapi({ example: "https://www.deezer.com/track/2967993121" }),
    isrc: z.string().nullable().openapi({ example: "JPI102300038" }),
    rank: z.number().int().nullable().openapi({ example: 12345 })
  })
  .openapi("SongPreview");

export const SongPreviewResponseSchema = z
  .object({
    songId: z.string().openapi({ example: "dream-believers" }),
    status: z.enum(["found", "not_found", "unavailable"]).openapi({ example: "found" }),
    source: z.enum(["cache", "deezer"]).openapi({ example: "cache" }),
    stale: z.boolean().openapi({ example: false }),
    preview: SongPreviewSchema.nullable(),
    fetchedAt: z.string().datetime().openapi({ example: "2026-06-21T00:00:00.000Z" })
  })
  .openapi("SongPreviewResponse");
