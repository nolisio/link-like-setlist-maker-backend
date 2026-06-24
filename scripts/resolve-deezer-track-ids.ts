import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDeezerAlbumTracks, getDeezerArtistTopTracks, searchDeezerTracks } from "../src/clients/deezerClient.js";
import { resolveSongDeezerTrackId, type ResolverSongSeed } from "../src/services/deezerTrackResolver.js";
import { writeResolvedTrackIdsToSeedFile } from "../src/services/deezerTrackSeedWriter.js";

const songsPath = join(process.cwd(), "prisma", "seed-data", "songs.json");
const overridesPath = join(process.cwd(), "prisma", "seed-data", "deezer-track-overrides.json");

async function main() {
  const songs = JSON.parse(await readFile(songsPath, "utf8")) as ResolverSongSeed[];
  const overrides = JSON.parse(await readFile(overridesPath, "utf8")) as Record<string, number | null>;
  const resolvedTrackIds: Record<string, number> = {};

  for (const song of songs) {
    if (song.deezerTrackId !== undefined) {
      continue;
    }

    const result = await resolveSongDeezerTrackId(song, {
      searchTracks: (query) => searchDeezerTracks(query, 10),
      listArtistTopTracks: (artistId) => getDeezerArtistTopTracks(artistId, 50),
      listAlbumTracks: (albumId) => getDeezerAlbumTracks(albumId),
      overrides
    });

    if (result.status === "resolved") {
      resolvedTrackIds[song.id] = result.deezerTrackId;
      console.log(`[resolved:${result.matchedBy}] ${song.id} -> ${result.deezerTrackId}`);
      continue;
    }

    if (result.status === "skipped") {
      console.log(`[skipped] ${song.id}`);
      continue;
    }

    await writeResolvedTrackIdsToSeedFile(songsPath, resolvedTrackIds);
    console.log(`[needs_confirmation:${result.reason}] ${song.id} / ${song.titleJa ?? song.title}`);
    if (result.candidates.length === 0) {
      console.log("No candidates found.");
    } else {
      for (const candidate of result.candidates) {
        console.log(
          `${candidate.deezerTrackId} | ${candidate.title} | ${candidate.artistName} | ${candidate.albumTitle ?? "-"}`
        );
      }
    }
    console.log(`Add the confirmed track id to ${overridesPath} and rerun this script.`);
    process.exit(1);
  }

  await writeResolvedTrackIdsToSeedFile(songsPath, resolvedTrackIds);
  console.log(`Resolved ${Object.keys(resolvedTrackIds).length} songs.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
