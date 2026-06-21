import { prisma } from "../src/db/client.js";
import { backfillSongPreviews } from "../src/services/songPreviewBackfillService.js";

const refresh = process.argv.includes("--refresh");

try {
  await backfillSongPreviews({
    refresh,
    logger: console
  });
  await prisma.$disconnect();
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
