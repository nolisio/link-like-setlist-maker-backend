import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  responses: {
    200: {
      description: "Health status",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok")
          })
        }
      }
    }
  }
});

export function registerHealthRoutes(app: OpenAPIHono) {
  app.openapi(healthRoute, (c) => c.json({ status: "ok" as const }, 200));
}
