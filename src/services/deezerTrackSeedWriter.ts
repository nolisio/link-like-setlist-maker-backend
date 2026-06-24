import { readFile, writeFile } from "node:fs/promises";

type SongSeedRecord = {
  id: string;
  deezerTrackId?: number;
  [key: string]: unknown;
};

export async function writeResolvedTrackIdsToSeedFile(filePath: string, resolvedTrackIds: Record<string, number>) {
  const songs = JSON.parse(await readFile(filePath, "utf8")) as SongSeedRecord[];

  const nextSongs = songs.map((song) =>
    Object.prototype.hasOwnProperty.call(resolvedTrackIds, song.id)
      ? {
          ...song,
          deezerTrackId: resolvedTrackIds[song.id]
        }
      : song
  );

  await writeFile(filePath, `${JSON.stringify(nextSongs, null, 2)}\n`);
}
