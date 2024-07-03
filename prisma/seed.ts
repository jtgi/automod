// cryptoadz: 0x1cb1a5e65610aeff2551a50f76a87a7d3fb649c6

import { Prisma } from "@prisma/client";
import { db } from "~/lib/db.server";
import { Action, Rule } from "~/lib/validations.server";

async function seed() {
  const user = await db.user.upsert({
    where: {
      id: "5179",
    },
    create: {
      id: "5179",
      name: "jtgi",
      role: "superadmin",
    },
    update: {
      id: "5179",
      role: "superadmin",
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

  const fields = {
    banThreshold: 3,
    userId: user.id,
    imageUrl: `/icons/automod.png`,
    inclusionRuleSet: JSON.stringify({
      rule: orRule,
      actions: actions,
    }),
    url: "https://warpcast.com/~/channel/jtgi",
  };

  [
    "jtgi",
    "samantha",
    "base",
    "coop-recs",
    "rainbow",
    "seaport",
    "farcasther",
    "degen",
    "fitness",
    "higher",
    "zk",
    "replyguys",
    "ogs",
    "wake",
  ].forEach(async (id) => {
    await db.moderatedChannel.upsert({
      where: {
        id: id,
      },
      create: {
        id,
        ...fields,
      },
      update: fields,
    });
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
