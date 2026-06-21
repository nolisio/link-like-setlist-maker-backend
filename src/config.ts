import "dotenv/config";

const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function numberFromEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: numberFromEnv("PORT", 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? defaultDatabaseUrl,
  deezerApiBaseUrl: process.env.DEEZER_API_BASE_URL ?? "https://api.deezer.com",
  deezerPreviewCacheTtlSeconds: numberFromEnv("DEEZER_PREVIEW_CACHE_TTL_SECONDS", 21600),
  deezerRequestTimeoutMs: numberFromEnv("DEEZER_REQUEST_TIMEOUT_MS", 5000),
  deezerSearchLimit: numberFromEnv("DEEZER_SEARCH_LIMIT", 5)
};
