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
            contains: "userFidInList",
          },
        },
        {
          exclusionRuleSet: {
            contains: "userFidInList",
          },
        },
      ],
    },
  });

  for (const channel of channels) {
    if (channel.inclusionRuleSet?.includes("userFidInList")) {
      const fidIndex = channel.inclusionRuleSetParsed?.ruleParsed?.conditions?.findIndex(
        (condition) => condition.name === "userFidInList"
      );

      if (fidIndex === undefined) {
        continue;
      }

      const fidRule = channel.inclusionRuleSetParsed!.ruleParsed!.conditions![fidIndex]!;

      if (typeof fidRule.args.fids !== "string") {
        continue;
      }
      const fidsArr = fidRule.args.fids.split(/\r?\n/);
      const rsp = await neynar.fetchBulkUsers(fidsArr.map(Number));
      const fids = rsp.users.map((user) => ({
        key: user.fid,
        icon: user.pfp_url ?? undefined,
        label: user.username,
      }));

      channel.inclusionRuleSetParsed!.ruleParsed!.conditions![fidIndex]!.args.fids = fids;
      await db.moderatedChannel.update({
        where: {
          id: channel.id,
        },
        data: {
          inclusionRuleSet: JSON.stringify({
            rule: channel.inclusionRuleSetParsed!.ruleParsed,
            actions: channel.inclusionRuleSetParsed!.actionsParsed,
          }),
        },
      });

      console.log(`${channel.id} updated`);
    }

    if (channel.exclusionRuleSet?.includes("userFidInList")) {
      const fidIndex = channel.exclusionRuleSetParsed?.ruleParsed?.conditions?.findIndex(
        (condition) => condition.name === "userFidInList"
      );

      if (fidIndex === undefined) {
        continue;
      }

      const fidRule = channel.exclusionRuleSetParsed!.ruleParsed!.conditions![fidIndex]!;

      const fidsArr = fidRule.args.fids.split(/\r?\n/);
      const rsp = await neynar.fetchBulkUsers(fidsArr.map(Number));
      const fids = rsp.users.map((user) => ({
        key: user.fid,
        icon: user.pfp_url ?? undefined,
        label: user.username,
      }));

      channel.exclusionRuleSetParsed!.ruleParsed!.conditions![fidIndex]!.args.fids = fids;

      await db.moderatedChannel.update({
        where: {
          id: channel.id,
        },
        data: {
          exclusionRuleSet: JSON.stringify({
            rule: channel.exclusionRuleSetParsed!.ruleParsed,
            actions: channel.exclusionRuleSetParsed!.actionsParsed,
          }),
        },
      });
      console.log(`${channel.id} updated`);
    }
  }
}

main();
