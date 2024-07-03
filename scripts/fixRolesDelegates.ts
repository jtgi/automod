/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import { db } from "~/lib/db.server";

async function main() {
  const roles = JSON.parse(fs.readFileSync("./scripts/lostroles.json", "utf-8")) as any[];
  const delegates = JSON.parse(fs.readFileSync("./scripts/lostdelegates.json", "utf-8")) as any[];

  const three60 = {
    id: "360",
    createdAt: new Date(),
    updatedAt: new Date(),
    active: true,
    imageUrl: "https://i.imgur.com/uzVXzkV.gif",
    url: "https://warpcast.com/~/channel/360",
    userId: "14351",
    banThreshold: null,
    slowModeHours: 0,
    excludeCohosts: true,
    excludeUsernames: "[]",
    inclusionRuleSet:
      '{"rule":{"type":"LOGICAL","name":"and","conditions":[{"name":"requiresErc1155","type":"CONDITION","args":{"searchText":"","contractAddress":"0x4f072c88a9144a490aee53bda2af5798e3ea3548","tokenId":"","chainId":"8453"}}],"operation":"AND","args":{}},"actions":[{"type":"like"}]}',
    exclusionRuleSet:
      '{"rule":{"type":"LOGICAL","name":"or","operation":"OR","conditions":[{"name":"containsEmbeds","type":"CONDITION","args":{"searchText":"","domain":"","images":false,"videos":false,"frames":true,"links":true,"casts":true}}],"args":{}},"actions":[{"type":"hideQuietly"}]}',
  };

  await db.moderatedChannel.upsert({
    where: {
      id: "360",
    },
    update: three60,
    create: three60,
  });

  const updatedRoles = roles.map((role) => ({
    ...role,
    isCohostRole: role.isCohostRole === 1,
    isEveryoneRole: role.isEveryoneRole === 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const updatedDelegates = delegates.map((delegate) => ({
    ...delegate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  console.log(`Updating ${updatedRoles.length} roles`);
  for (const role of updatedRoles) {
    console.log(`Updating role ${role.id} for ${role.channelId}`);
    await db.role
      .upsert({
        where: {
          id: role.id,
        },
        update: role,
        create: role,
      })
      .catch((e) => console.error(`Error updating role ${role.id}: ${e.message}`));
  }

  console.log(`Updating ${updatedRoles.length} delegates`);
  for (const delegate of updatedDelegates) {
    console.log(`Updating delegate ${delegate.id} for ${delegate.channelId}`);
    await db.delegate
      .upsert({
        where: {
          id: delegate.id,
        },
        update: delegate,
        create: delegate,
      })
      .catch((e) => console.error(`Error updating delegate ${delegate.id}: ${e.message}`));
  }
}

main();
