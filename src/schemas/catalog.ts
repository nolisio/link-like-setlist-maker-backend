import { z } from "@hono/zod-openapi";

export const UnitSchema = z
  .object({
    id: z.string().openapi({ example: "hasunosora" }),
    name: z.string().openapi({ example: "Hasunosora Girls' High School Idol Club" }),
    sortOrder: z.number().int().openapi({ example: 1 })
  })
  .openapi("Unit");

export const UnitsResponseSchema = z
  .object({
    units: z.array(UnitSchema)
  })
  .openapi("UnitsResponse");

export const SongSchema = z
  .object({
    id: z.string().openapi({ example: "dream-believers" }),
    title: z.string().openapi({ example: "Dream Believers" }),
    titleJa: z.string().openapi({ example: "Dream Believers" }),
    unitId: z.string().openapi({ example: "hasunosora" }),
    sortOrder: z.number().int().openapi({ example: 1 }),
    releaseDate: z.string().nullable().openapi({ example: "2023-03-29" }),
    unit: UnitSchema
  })
  .openapi("Song");

export const SongsQuerySchema = z.object({
  q: z.string().optional().openapi({ example: "holiday" }),
  unitId: z.string().optional().openapi({ example: "cerise-bouquet" })
});

export const SongParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: {
      name: "id",
      in: "path"
    },
    example: "dream-believers"
  })
});

export const SongsResponseSchema = z
  .object({
    songs: z.array(SongSchema)
  })
  .openapi("SongsResponse");

export const SongResponseSchema = z
  .object({
    song: SongSchema
  })
  .openapi("SongResponse");
