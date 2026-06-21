import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";

process.env.DATABASE_URL ??= config.databaseUrl;
process.env.DIRECT_URL ??= config.directUrl;

export const prisma = new PrismaClient();
