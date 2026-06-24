import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

const setlistInclude = {
  items: {
    include: {
      song: {
        include: {
          unit: true
        }
      }
    },
    orderBy: {
      position: "asc"
    }
  }
} satisfies Prisma.SetlistInclude;

export type SetlistWithItems = Prisma.SetlistGetPayload<{ include: typeof setlistInclude }>;

export type SetlistWriteInput = {
  title: string;
  description?: string;
  items?: Array<{
    songId: string;
    memo?: string;
  }>;
};

export async function findSetlistById(id: string) {
  return prisma.setlist.findUnique({
    where: { id },
    include: setlistInclude
  });
}

export async function createSetlist(input: SetlistWriteInput) {
  return prisma.setlist.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      items: {
        create: (input.items ?? []).map((item, index) => ({
          songId: item.songId,
          memo: item.memo ?? null,
          position: index + 1
        }))
      }
    },
    include: setlistInclude
  });
}
