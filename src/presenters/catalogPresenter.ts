import type { SongWithUnit } from "../repositories/catalogRepository.js";

export function presentUnit(unit: { id: string; name: string; sortOrder: number }) {
  return {
    id: unit.id,
    name: unit.name,
    sortOrder: unit.sortOrder
  };
}

export function presentSong(song: SongWithUnit) {
  return {
    id: song.id,
    title: song.title,
    titleJa: song.titleJa,
    unitId: song.unitId,
    sortOrder: song.sortOrder,
    releaseDate: song.releaseDate ? song.releaseDate.toISOString().slice(0, 10) : null,
    unit: presentUnit(song.unit)
  };
}
