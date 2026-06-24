import "dotenv/config";

function numberFromEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const databaseUrl = stringFromEnv("DATABASE_URL");
const backendApiToken = process.env.BACKEND_API_TOKEN ?? "";

if (process.env.NODE_ENV === "production" && !backendApiToken) {
  throw new Error("BACKEND_API_TOKEN is required in production.");
}

export const config = {
  port: numberFromEnv("PORT", 3000),
  backendApiToken,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl,
  directUrl: process.env.DIRECT_URL ?? databaseUrl,
  deezerApiBaseUrl: process.env.DEEZER_API_BASE_URL ?? "https://api.deezer.com",
  deezerPreviewCacheTtlSeconds: numberFromEnv("DEEZER_PREVIEW_CACHE_TTL_SECONDS", 21600),
  deezerRequestTimeoutMs: numberFromEnv("DEEZER_REQUEST_TIMEOUT_MS", 5000),
  deezerSearchLimit: numberFromEnv("DEEZER_SEARCH_LIMIT", 5),
  maxJsonBodyBytes: numberFromEnv("MAX_JSON_BODY_BYTES", 16 * 1024),
  previewRefreshRateLimitMax: numberFromEnv("PREVIEW_REFRESH_RATE_LIMIT_MAX", 20),
  previewRefreshRateLimitWindowMs: numberFromEnv("PREVIEW_REFRESH_RATE_LIMIT_WINDOW_MS", 60 * 1000),
  setlistCreateRateLimitMax: numberFromEnv("SETLIST_CREATE_RATE_LIMIT_MAX", 20),
  setlistCreateRateLimitWindowMs: numberFromEnv("SETLIST_CREATE_RATE_LIMIT_WINDOW_MS", 60 * 1000)
};
