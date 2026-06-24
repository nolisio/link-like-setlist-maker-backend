import type { SupabaseContext, SupabaseEnv } from "@supabase/server";
import { withSupabase } from "@supabase/server/adapters/hono";
import { resolveEnv } from "@supabase/server/core";
import type { Context } from "hono";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export type AppEnv = {
  Variables: {
    supabaseContext: SupabaseContext;
  };
};

export function getSupabaseServerEnv(): SupabaseEnv {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  const { data, error } = resolveEnv({
    url: requireEnv("SUPABASE_URL"),
    publishableKeys: {
      default: requireEnv("SUPABASE_PUBLISHABLE_KEY")
    },
    secretKeys: {
      default: requireEnv("SUPABASE_SECRET_KEY")
    },
    jwks: jwksUrl ? new URL(jwksUrl) : undefined
  });

  if (error) {
    throw error;
  }

  return data;
}

export function createCatalogSupabaseMiddleware() {
  return withSupabase({
    auth: "none",
    env: getSupabaseServerEnv()
  });
}

export function getSupabaseContext(c: Context<AppEnv>) {
  return c.var.supabaseContext;
}
