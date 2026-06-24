import { assertSafeTestDatabaseUrls } from "../src/testDatabaseGuard.js";

assertSafeTestDatabaseUrls(process.env);
