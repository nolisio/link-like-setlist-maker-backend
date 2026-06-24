import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeResolvedTrackIdsToSeedFile } from "../services/deezerTrackSeedWriter.js";

describe("writeResolvedTrackIdsToSeedFile", () => {
  it("writes resolved track ids without changing unrelated fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "deezer-track-seed-"));
    const filePath = join(dir, "songs.json");

    await writeFile(
      filePath,
      `${JSON.stringify(
        [
          { id: "a", title: "Song A", titleJa: "Song A", unitId: "x", sortOrder: 1 },
          { id: "b", title: "Song B", titleJa: "Song B", unitId: "y", sortOrder: 2, deezerTrackId: 22 }
        ],
        null,
        2
      )}\n`
    );

    await writeResolvedTrackIdsToSeedFile(filePath, {
      a: 11
    });

    const written = JSON.parse(await readFile(filePath, "utf8")) as Array<Record<string, unknown>>;

    expect(written).toEqual([
      { id: "a", title: "Song A", titleJa: "Song A", unitId: "x", sortOrder: 1, deezerTrackId: 11 },
      { id: "b", title: "Song B", titleJa: "Song B", unitId: "y", sortOrder: 2, deezerTrackId: 22 }
    ]);
  });

  it("preserves pretty JSON output with a trailing newline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "deezer-track-seed-"));
    const filePath = join(dir, "songs.json");

    await writeFile(filePath, '[{"id":"a","title":"Song A","titleJa":"Song A","unitId":"x","sortOrder":1}]\n');

    await writeResolvedTrackIdsToSeedFile(filePath, {
      a: 11
    });

    const raw = await readFile(filePath, "utf8");

    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  {\n');
  });
});
