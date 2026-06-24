import { AppError } from "../errors.js";
import { findExistingSongIds } from "../repositories/catalogRepository.js";
import {
  createSetlist as createSetlistInRepository,
  findSetlistById,
  type SetlistWriteInput,
} from "../repositories/setlistRepository.js";

async function assertSongsExist(items: SetlistWriteInput["items"] = []) {
  const requestedSongIds = items.map((item) => item.songId);
  const existingSongIds = await findExistingSongIds(requestedSongIds);
  const missingSongIds = Array.from(new Set(requestedSongIds.filter((songId) => !existingSongIds.has(songId))));

  if (missingSongIds.length > 0) {
    throw new AppError(400, "INVALID_SONG", "One or more songs do not exist", { songIds: missingSongIds });
  }
}

export async function getSetlist(id: string) {
  const setlist = await findSetlistById(id);

  if (!setlist) {
    throw new AppError(404, "NOT_FOUND", "Setlist not found");
  }

  return setlist;
}

export async function createSetlist(input: SetlistWriteInput) {
  await assertSongsExist(input.items);
  return createSetlistInRepository(input);
}
