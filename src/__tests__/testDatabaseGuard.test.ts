import { describe, expect, it } from "vitest";

describe("assertSafeTestDatabaseUrls", () => {
  it("allows explicitly test-scoped database URLs", async () => {
    const { assertSafeTestDatabaseUrls } = await import("../testDatabaseGuard.js");

    expect(() =>
      assertSafeTestDatabaseUrls({
        TEST_DATABASE_URL: "postgresql://app:secret@db.internal:5432/app_test",
        TEST_DIRECT_URL: "postgresql://admin:secret@db.internal:5432/app_test"
      })
    ).not.toThrow();
  });

  it("falls back to TEST_DATABASE_URL when TEST_DIRECT_URL is unset", async () => {
    const { assertSafeTestDatabaseUrls } = await import("../testDatabaseGuard.js");

    expect(() =>
      assertSafeTestDatabaseUrls({
        TEST_DATABASE_URL: "postgresql://app:secret@db.internal:5432/app_test"
      })
    ).not.toThrow();
  });

  it("rejects when TEST_DATABASE_URL is missing", async () => {
    const { assertSafeTestDatabaseUrls } = await import("../testDatabaseGuard.js");

    expect(() =>
      assertSafeTestDatabaseUrls({
        TEST_DIRECT_URL: "postgresql://admin:secret@db.internal:5432/app_test"
      })
    ).toThrow(/TEST_DATABASE_URL/);
  });

  it("rejects a database URL without an explicit test database name", async () => {
    const { assertSafeTestDatabaseUrls } = await import("../testDatabaseGuard.js");

    expect(() =>
      assertSafeTestDatabaseUrls({
        TEST_DATABASE_URL: "postgresql://app:secret@db.internal:5432/app",
        TEST_DIRECT_URL: "postgresql://admin:secret@db.internal:5432/app_test"
      })
    ).toThrow(/unsafe/i);
  });

  it("rejects when the configured direct URL is unsafe", async () => {
    const { assertSafeTestDatabaseUrls } = await import("../testDatabaseGuard.js");

    expect(() =>
      assertSafeTestDatabaseUrls({
        TEST_DATABASE_URL: "postgresql://app:secret@db.internal:5432/app_test",
        TEST_DIRECT_URL: "postgresql://admin:secret@db.internal:5432/app"
      })
    ).toThrow(/TEST_DIRECT_URL/i);
  });
});
