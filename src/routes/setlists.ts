import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { presentSetlist } from "../presenters/setlistPresenter.js";
import { ErrorResponseSchema } from "../schemas/error.js";
import {
  SetlistCreateRequestSchema,
  SetlistParamsSchema,
  SetlistResponseSchema,
  SetlistsResponseSchema,
  SetlistUpdateRequestSchema
} from "../schemas/setlist.js";
import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  listSetlists,
  updateSetlist
} from "../services/setlistService.js";

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

const listSetlistsRoute = createRoute({
  method: "get",
  path: "/api/setlists",
  tags: ["Setlists"],
  responses: {
    200: {
      description: "Setlists",
      content: {
        "application/json": {
          schema: SetlistsResponseSchema
        }
      }
    }
  }
});

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

const updateSetlistRoute = createRoute({
  method: "put",
  path: "/api/setlists/{id}",
  tags: ["Setlists"],
  request: {
    params: SetlistParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: SetlistUpdateRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Updated setlist",
      content: {
        "application/json": {
          schema: SetlistResponseSchema
        }
      }
    },
    400: commonSetlistErrors[400],
    404: commonSetlistErrors[404]
  }
});

const deleteSetlistRoute = createRoute({
  method: "delete",
  path: "/api/setlists/{id}",
  tags: ["Setlists"],
  request: {
    params: SetlistParamsSchema
  },
  responses: {
    204: {
      description: "Deleted setlist"
    },
    404: commonSetlistErrors[404]
  }
});

export function registerSetlistRoutes(app: OpenAPIHono) {
  app.openapi(listSetlistsRoute, async (c) => {
    const setlists = await listSetlists();
    return c.json({ setlists: setlists.map(presentSetlist) }, 200);
  });

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

  app.openapi(updateSetlistRoute, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const setlist = await updateSetlist(id, input);
    return c.json({ setlist: presentSetlist(setlist) }, 200);
  });

  app.openapi(deleteSetlistRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteSetlist(id);
    return c.body(null, 204);
  });
}
