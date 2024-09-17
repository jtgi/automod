import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll } from "vitest";

export const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$disconnect();

  execSync("npx prisma migrate deploy --preview-feature", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });

  await prisma.$connect();
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

async function clearDatabase() {
  await prisma.moderationLog.deleteMany();
  await prisma.ruleSet.deleteMany();
  await prisma.moderatedChannel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.inviteCode.deleteMany();
}
