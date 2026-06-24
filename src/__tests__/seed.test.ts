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
  });
});
