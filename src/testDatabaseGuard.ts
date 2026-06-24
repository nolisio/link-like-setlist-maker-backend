const EXPLICIT_TEST_DATABASE_NAME = /(^test$|^test[-_].+|.+[-_]test$|.+[-_]test[-_].+)/i;

function parseDatabaseName(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

function isSafeDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const databaseName = parseDatabaseName(url);

  return EXPLICIT_TEST_DATABASE_NAME.test(databaseName);
}

export function assertSafeTestDatabaseUrls(env: NodeJS.ProcessEnv) {
  const urls = [
    ["TEST_DATABASE_URL", env.TEST_DATABASE_URL],
    ["TEST_DIRECT_URL", env.TEST_DIRECT_URL ?? env.TEST_DATABASE_URL]
  ] as const;

  for (const [name, value] of urls) {
    if (!value) {
      throw new Error(`${name} must be set before running destructive test database commands.`);
    }

    if (!isSafeDatabaseUrl(value)) {
      throw new Error(
        `${name} points at an unsafe database URL. Tests may only reset a database whose name is explicitly marked as test.`
      );
    }
  }
}
