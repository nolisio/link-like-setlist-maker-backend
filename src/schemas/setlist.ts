import { z } from "@hono/zod-openapi";
import { SongSchema } from "./catalog.js";

export const SetlistItemInputSchema = z
  .object({
    songId: z.string().min(1).openapi({ example: "dream-believers" }),
    memo: z.string().trim().max(500).optional().openapi({ example: "Start with full chorus" })
  })
  .openapi("SetlistItemInput");

export const SetlistCreateRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120).openapi({ example: "Opening block" }),
    description: z.string().trim().max(1000).optional().openapi({ example: "Two song flow" }),
    items: z.array(SetlistItemInputSchema).max(100).optional()
  })
  .openapi("SetlistCreateRequest");

export const SetlistUpdateRequestSchema = SetlistCreateRequestSchema.openapi("SetlistUpdateRequest");

export const SetlistParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: {
      name: "id",
      in: "path"
    },
    example: "clx0000000000000000000000"
  })
});

export const SetlistItemSchema = z
  .object({
    id: z.string(),
    setlistId: z.string(),
    songId: z.string(),
    position: z.number().int().positive(),
    memo: z.string().nullable(),
    song: SongSchema
  })
  .openapi("SetlistItem");

export const SetlistSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    items: z.array(SetlistItemSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .openapi("Setlist");

export const SetlistsResponseSchema = z
  .object({
    setlists: z.array(SetlistSchema)
  })
  .openapi("SetlistsResponse");

export const SetlistResponseSchema = z
  .object({
    setlist: SetlistSchema
  })
  .openapi("SetlistResponse");
