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
    },
    update: {
      id: "5179",
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

  const containsHotChocolate: Rule = {
    name: "containsText",
    type: "CONDITION",
    args: {
      searchText: "hot chocolate",
      caseSensitive: true,
    },
  };

  const orRule: Rule = {
    name: "and",
    type: "LOGICAL",
    args: {},
    operation: "OR",
    conditions: [containsHotChocolate, containsSpam],
  };

  const actions: Array<Action> = [
    {
      type: "warnAndHide",
    },
  ];

  const fields = {
    id: "jtgi",
    banThreshold: 3,
    userId: user.id,
  };

  const modChannel = await db.moderatedChannel.upsert({
    where: {
      id: "jtgi",
    },
    create: fields,
    update: fields,
  });

  const rules = await db.ruleSet.upsert({
    where: {
      id: "seededRules",
    },
    update: {
      rule: JSON.stringify(orRule),
      actions: JSON.stringify(actions),
    },
    create: {
      id: "seededRules",
      rule: JSON.stringify(orRule),
      actions: JSON.stringify(actions),
      channelId: modChannel.id,
    },
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
