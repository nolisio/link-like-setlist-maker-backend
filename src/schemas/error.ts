import { z } from "@hono/zod-openapi";

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "VALIDATION_ERROR" }),
      message: z.string().openapi({ example: "Request validation failed" }),
      details: z.unknown().optional()
    })
  })
  .openapi("ErrorResponse");
