import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadConfigModule() {
  vi.resetModules();
  return import("../config.js");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("config", () => {
  it("uses Supabase local Postgres defaults when database env vars are unset", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    process.env.DOTENV_CONFIG_PATH = ".env.test.missing";

    const { config } = await loadConfigModule();

    expect(config.databaseUrl).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    expect(config.directUrl).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  });

  it("reads both DATABASE_URL and DIRECT_URL from env", async () => {
    process.env.DATABASE_URL = "postgresql://app-user:secret@127.0.0.1:54322/postgres";
    process.env.DIRECT_URL = "postgresql://direct-user:secret@127.0.0.1:54322/postgres";

    const { config } = await loadConfigModule();

    expect(config.databaseUrl).toBe("postgresql://app-user:secret@127.0.0.1:54322/postgres");
    expect(config.directUrl).toBe("postgresql://direct-user:secret@127.0.0.1:54322/postgres");
  });
});
