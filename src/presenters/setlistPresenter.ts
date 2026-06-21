import type { SetlistWithItems } from "../repositories/setlistRepository.js";
import { presentSong } from "./catalogPresenter.js";

export function presentSetlist(setlist: SetlistWithItems) {
  return {
    id: setlist.id,
    title: setlist.title,
    description: setlist.description,
    items: setlist.items.map((item) => ({
      id: item.id,
      setlistId: item.setlistId,
      songId: item.songId,
      position: item.position,
      memo: item.memo,
      song: presentSong(item.song)
    })),
    createdAt: setlist.createdAt.toISOString(),
    updatedAt: setlist.updatedAt.toISOString()
  };
}
