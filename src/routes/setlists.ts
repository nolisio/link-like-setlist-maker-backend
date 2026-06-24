import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { presentSetlist } from "../presenters/setlistPresenter.js";
import { ErrorResponseSchema } from "../schemas/error.js";
import {
  SetlistCreateRequestSchema,
  SetlistParamsSchema,
  SetlistResponseSchema
} from "../schemas/setlist.js";
import {
  createSetlist,
  getSetlist
} from "../services/setlistService.js";
import type { AppEnv } from "../supabaseServer.js";

const commonSetlistErrors = {
  400: {
    description: "Invalid request",
    content: {
      "application/json": {
        schema: ErrorResponseSchema
      }
    }
  },
  404: {
    description: "Setlist not found",
    content: {
      "application/json": {
        schema: ErrorResponseSchema
      }
    }
  }
};

const createSetlistRoute = createRoute({
  method: "post",
  path: "/api/setlists",
  tags: ["Setlists"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: SetlistCreateRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Created setlist",
      content: {
        "application/json": {
          schema: SetlistResponseSchema
        }
      }
    },
    400: commonSetlistErrors[400]
  }
});

const getSetlistRoute = createRoute({
  method: "get",
  path: "/api/setlists/{id}",
  tags: ["Setlists"],
  request: {
    params: SetlistParamsSchema
  },
  responses: {
    200: {
      description: "Setlist by id",
      content: {
        "application/json": {
          schema: SetlistResponseSchema
        }
      }
    },
    404: commonSetlistErrors[404]
  }
});

export function registerSetlistRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(createSetlistRoute, async (c) => {
    const input = c.req.valid("json");
    const setlist = await createSetlist(input);
    return c.json({ setlist: presentSetlist(setlist) }, 201);
  });

  app.openapi(getSetlistRoute, async (c) => {
    const { id } = c.req.valid("param");
    const setlist = await getSetlist(id);
    return c.json({ setlist: presentSetlist(setlist) }, 200);
  });
}
