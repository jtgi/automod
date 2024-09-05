import { ModeratedChannel, Prisma } from "@prisma/client";
import { db } from "~/lib/db.server";
import { Action, Rule } from "~/lib/validations.server";

async function seed() {
  const jtgi = await db.user.upsert({
    where: {
      id: "5179",
    },
    create: {
      id: "5179",
      name: "jtgi",
      role: "superadmin",
      plan: "prime",
    },
    update: {
      id: "5179",
      role: "superadmin",
      plan: "prime",
    },
  });

  const nonlinear = await db.user.upsert({
    where: {
      id: "576",
    },
    create: {
      id: "576",
      name: "nonlinear.eth",
      role: "user",
    },
    update: {
      id: "576",
      role: "user",
    },
  });

  const containsSpam: Rule = {
    name: "containsText",
    type: "CONDITION",
    args: {
      searchText: "spam",
      caseSensitive: true,
    },
  };

  const orRule: Rule = {
    name: "and",
    type: "LOGICAL",
    args: {},
    operation: "OR",
    conditions: [containsSpam],
  };

  const actions: Array<Action> = [
    {
      type: "warnAndHide",
    },
  ];

  const jtgiChannels = ["tmp", "automod", "jtgi", "samantha", "base", "coop-recs", "rainbow"];
  const nonlinearChannels = ["memes", "manysuchcases", "hypermod"];

  function createChannel(userId: string, channelId: string): Promise<ModeratedChannel> {
    return db.moderatedChannel.upsert({
      where: {
        id: channelId,
      },
      create: {
        id: channelId,
        userId,
        url: `https://warpcast.com/~/channel/${channelId}`,
      },
      update: {
        id: channelId,
        userId,
        url: `https://warpcast.com/~/channel/${channelId}`,
        inclusionRuleSet: JSON.stringify({
          rule: orRule,
          actions: actions,
        }),
      },
    });
  }

  await Promise.all(jtgiChannels.map((channelId) => createChannel(jtgi.id, channelId)));
  await Promise.all(nonlinearChannels.map((channelId) => createChannel(nonlinear.id, channelId)));

  await db.cooldown.deleteMany({});
  await db.cooldown.createMany({
    data: [
      {
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: undefined, // ban
        active: true,
        affectedUserId: "3",
        channelId: "tmp",
      },
      {
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        active: true,
        affectedUserId: "2",
        channelId: "tmp",
      },
    ],
  });
}

seed()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
