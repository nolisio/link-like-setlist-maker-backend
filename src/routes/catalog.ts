import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { AppError } from "../errors.js";
import { presentSong, presentUnit } from "../presenters/catalogPresenter.js";
import {
  SongParamsSchema,
  SongResponseSchema,
  SongsQuerySchema,
  SongsResponseSchema,
  UnitsResponseSchema
} from "../schemas/catalog.js";
import { ErrorResponseSchema } from "../schemas/error.js";
import { SongPreviewQuerySchema, SongPreviewResponseSchema } from "../schemas/songPreview.js";
import { getSong, listSongs, listUnits } from "../services/catalogService.js";
import { getSongPreview } from "../services/songPreviewService.js";
import { createCatalogSupabaseMiddleware, getSupabaseContext, type AppEnv } from "../supabaseServer.js";

const listUnitsRoute = createRoute({
  method: "get",
  path: "/api/units",
  tags: ["Catalog"],
  responses: {
    200: {
      description: "Seeded units",
      content: {
        "application/json": {
          schema: UnitsResponseSchema
        }
      }
    }
  }
});

const listSongsRoute = createRoute({
  method: "get",
  path: "/api/songs",
  tags: ["Catalog"],
  request: {
    query: SongsQuerySchema
  },
  responses: {
    200: {
      description: "Seeded songs",
      content: {
        "application/json": {
          schema: SongsResponseSchema
        }
      }
    }
  }
});

const getSongRoute = createRoute({
  method: "get",
  path: "/api/songs/{id}",
  tags: ["Catalog"],
  request: {
    params: SongParamsSchema
  },
  responses: {
    200: {
      description: "Song by id",
      content: {
        "application/json": {
          schema: SongResponseSchema
        }
      }
    },
    404: {
      description: "Song not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

const getSongPreviewRoute = createRoute({
  method: "get",
  path: "/api/songs/{id}/preview",
  tags: ["Catalog"],
  request: {
    params: SongParamsSchema,
    query: SongPreviewQuerySchema
  },
  responses: {
    200: {
      description: "Deezer 30-second preview lookup for a seeded song",
      content: {
        "application/json": {
          schema: SongPreviewResponseSchema
        }
      }
    },
    404: {
      description: "Song not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

export function registerCatalogRoutes(app: OpenAPIHono<AppEnv>) {
  const catalogSupabase = createCatalogSupabaseMiddleware();

  app.use("/api/units", catalogSupabase);
  app.use("/api/songs", catalogSupabase);
  app.use("/api/songs/*", catalogSupabase);

  app.openapi(listUnitsRoute, async (c) => {
    getSupabaseContext(c);
    const units = await listUnits();
    return c.json({ units: units.map(presentUnit) }, 200);
  });

  app.openapi(listSongsRoute, async (c) => {
    getSupabaseContext(c);
    const query = c.req.valid("query");
    const songs = await listSongs(query);
    return c.json({ songs: songs.map(presentSong) }, 200);
  });

  app.openapi(getSongPreviewRoute, async (c) => {
    getSupabaseContext(c);
    const { id } = c.req.valid("param");
    const { refresh } = c.req.valid("query");
    const preview = await getSongPreview(id, { refresh: refresh === "true" });

    return c.json(preview, 200);
  });

  app.openapi(getSongRoute, async (c) => {
    getSupabaseContext(c);
    const { id } = c.req.valid("param");
    const song = await getSong(id).catch((error: unknown) => {
      if (error instanceof AppError) {
        throw error;
      }
      throw error;
    });

    return c.json({ song: presentSong(song) }, 200);
  });
}
