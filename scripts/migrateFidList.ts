/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "~/lib/db.server";
import { Rule, RuleName } from "~/lib/validations.server";
import fs from "node:fs";
import { neynar } from "~/lib/neynar.server";

async function main() {
  fs.copyFileSync("../prisma/dev.db", "../prisma/dev.db.bak");
  const channels = await db.moderatedChannel.findMany({
    include: {
      ruleSets: true,
    },
    where: {
      OR: [
        {
          inclusionRuleSet: {
            contains: "userDoesNotFollow",
          },
        },
        {
          exclusionRuleSet: {
            contains: "userDoesNotFollow",
          },
        },
        {
          inclusionRuleSet: {
            contains: "userIsNotFollowedBy",
          },
        },
        {
          exclusionRuleSet: {
            contains: "userIsNotFollowedBy",
          },
        },
      ],
    },
  });

  for (const channel of channels) {
    for (const condition of channel.inclusionRuleSetParsed?.ruleParsed?.conditions ?? []) {
      if (condition.name === "userDoesNotFollow" || condition.name === "userIsNotFollowedBy") {
        if (typeof condition.args.username !== "string") {
          continue;
        }

        if (!condition.args.username && !condition.args.users) {
          console.log(`[${channel.id}] username is blank`);
          continue;
        }

        const resp = await neynar.lookupUserByUsername(condition.args.username).catch(() => null);
        if (resp === null) {
          console.log(`[${channel.id}] Failed to find user ${condition.args.username}`);
          continue;
        }

        condition.args.users = [
          {
            value: resp.result.user.fid,
            icon: resp.result.user.pfp.url,
            label: resp.result.user.username,
          },
        ];
      }
    }

    for (const condition of channel.exclusionRuleSetParsed?.ruleParsed?.conditions ?? []) {
      if (condition.name === "userDoesNotFollow" || condition.name === "userIsNotFollowedBy") {
        if (typeof condition.args.username !== "string") {
          continue;
        }

        if (!condition.args.username && !condition.args.users) {
          console.log(`[${channel.id}] No username or users`);
          continue;
        }

        const resp = await neynar.lookupUserByUsername(condition.args.username).catch(() => null);
        if (resp === null) {
          console.log(`[${channel.id}] Failed to find user ${condition.args.username}`);
          continue;
        }

        condition.args.users = [
          {
            value: resp.result.user.fid,
            icon: resp.result.user.pfp.url,
            label: resp.result.user.username,
          },
        ];
      }
    }

    await db.moderatedChannel.update({
      where: {
        id: channel.id,
      },
      data: {
        inclusionRuleSet: JSON.stringify({
          rule: channel.inclusionRuleSetParsed!.ruleParsed,
          actions: channel.inclusionRuleSetParsed!.actionsParsed,
        }),
        exclusionRuleSet: JSON.stringify({
          rule: channel.exclusionRuleSetParsed!.ruleParsed,
          actions: channel.exclusionRuleSetParsed!.actionsParsed,
        }),
      },
    });

    console.log(`${channel.id} updated`);
  }
}

main();
