import { listSongs } from "../repositories/catalogRepository.js";
import { refreshSongPreview } from "./songPreviewService.js";

export type SongPreviewBackfillOptions = {
  refresh?: boolean;
  songIds?: string[];
  logger?: Pick<Console, "log" | "error">;
};

export type SongPreviewBackfillSummary = {
  total: number;
  found: number;
  notFound: number;
  unavailable: number;
  skipped: number;
};

export async function backfillSongPreviews(
  options: SongPreviewBackfillOptions = {}
): Promise<SongPreviewBackfillSummary> {
  const summary: SongPreviewBackfillSummary = {
    total: 0,
    found: 0,
    notFound: 0,
    unavailable: 0,
    skipped: 0
  };
  const requestedSongIds = options.songIds ? new Set(options.songIds) : null;
  const songs = (await listSongs({})).filter((song) => (requestedSongIds ? requestedSongIds.has(song.id) : true));

  for (const song of songs) {
    summary.total += 1;

    try {
      const result = await refreshSongPreview(song.id, { refresh: options.refresh });

      if (result.skipped) {
        summary.skipped += 1;
        options.logger?.log(`[skip] ${song.id}`);
        continue;
      }

      if (result.status === "found") {
        summary.found += 1;
      } else if (result.status === "not_found") {
        summary.notFound += 1;
      } else {
        summary.unavailable += 1;
      }

      options.logger?.log(`[${result.status}] ${song.id}`);
    } catch (error) {
      summary.unavailable += 1;
      options.logger?.error(`[unavailable] ${song.id}`, error);
    }
  }

  options.logger?.log(
    `summary total=${summary.total} found=${summary.found} not_found=${summary.notFound} unavailable=${summary.unavailable} skipped=${summary.skipped}`
  );

  return summary;
}
