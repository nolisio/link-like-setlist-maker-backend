import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = vi.fn();
const unitUpsertMock = vi.fn(async () => undefined);
const songUpsertMock = vi.fn(async () => undefined);

vi.mock("../db/client.js", () => ({
  prisma: {
    $transaction: transactionMock
  }
}));

beforeEach(() => {
  transactionMock.mockReset();
  unitUpsertMock.mockClear();
  songUpsertMock.mockClear();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>, options?: unknown) => {
    await callback({
      unit: { upsert: unitUpsertMock },
      song: { upsert: songUpsertMock }
    });

    return options;
  });
});

describe("seedCatalog", () => {
  it("only references seeded unit ids from songs", async () => {
    const [units, songs] = await Promise.all([
      readSeedJson<Array<{ id: string }>>("units.json"),
      readSeedJson<Array<{ id: string; unitId: string }>>("songs.json")
    ]);
    const unitIds = new Set(units.map((unit) => unit.id));
    const missingUnitIds = Array.from(
      new Set(songs.filter((song) => !unitIds.has(song.unitId)).map((song) => song.unitId))
    );

    expect(missingUnitIds).toEqual([]);
  });

  it("uses an extended interactive transaction timeout for the shared Supabase seed run", async () => {
    const { seedCatalog } = await import("../../prisma/seed.js");

    await seedCatalog();

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][1]).toMatchObject({
      maxWait: 10_000,
      timeout: 60_000
    });
    expect(unitUpsertMock).toHaveBeenCalled();
    expect(songUpsertMock).toHaveBeenCalled();
    expect(songUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "perenial" },
        update: expect.objectContaining({ deezerTrackId: null }),
        create: expect.objectContaining({ deezerTrackId: null })
      })
    );
  });
});

async function readSeedJson<T>(fileName: string) {
  return JSON.parse(await readFile(join(process.cwd(), "prisma", "seed-data", fileName), "utf8")) as T;
}
