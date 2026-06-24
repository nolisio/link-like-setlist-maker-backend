import { assertSafeTestDatabaseUrls } from "../testDatabaseGuard.js";

process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.BACKEND_API_TOKEN = process.env.BACKEND_API_TOKEN ?? "test-backend-token";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_example";
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "sb_secret_example";
process.env.SUPABASE_JWKS_URL =
  process.env.SUPABASE_JWKS_URL ?? "https://example.supabase.co/auth/v1/.well-known/jwks.json";

if (process.env.TEST_DATABASE_URL) {
  assertSafeTestDatabaseUrls(process.env);
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL;
}
