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
    },
    update: {
      id: "5179",
    },
  });

  const rule: Rule = {
    name: "containsText",
    type: "CONDITION",
    args: {
      searchText: "spam",
      ignoreCase: true,
    },
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
    ruleSets: {
      create: [
        {
          rule: JSON.stringify(rule),
          actions: JSON.stringify(actions),
        },
      ],
    },
  };

  const modChannel = await db.moderatedChannel.upsert({
    where: {
      id: "jtgi",
    },
    create: fields,
    update: fields,
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
