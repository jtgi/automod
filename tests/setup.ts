import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll } from "vitest";

export const prisma = new PrismaClient();

beforeAll(async () => {
  // Close any existing connections before running migrations
  await prisma.$disconnect();

  // Run migrations, ensuring no other connections are open
  execSync("npx prisma migrate deploy --preview-feature", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });

  // Reconnect and clear data
  await prisma.$connect();
  await clearDatabase();
});

afterAll(async () => {
  // Clean up and close connection
  await clearDatabase();
  await prisma.$disconnect();
});

async function clearDatabase() {
  await prisma.moderationLog.deleteMany();
  await prisma.ruleSet.deleteMany();
  await prisma.moderatedChannel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.inviteCode.deleteMany();
  // Include other cleanup operations as needed
}
