import { CastLog, PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { db } from "~/lib/db.server";
import { getChannel, neynar } from "~/lib/neynar.server";
import { WebhookCast } from "~/lib/types";
import { FullModeratedChannel, validateCast } from "~/routes/api.webhooks.neynar";

const prisma = new PrismaClient();

async function main() {
  await prisma.$disconnect();

  // Run migrations, ensuring no other connections are open
  execSync("npx prisma generate", {
    env: { ...process.env, DATABASE_URL: "file:./testmigrate.db" },
  });

  // Reconnect and clear data
  await prisma.$connect();
  const moderatedChannels = (await prisma.moderatedChannel.findMany({
    where: {
      id: {
        in: [
          "philosophy",
          "base",
          "dev",
          "zk",
          "fitness",
          "tabletop",
          "lp",
          "wearesoearly",
          "travel",
          "farcasther",
          "gaming",
          "nouns-animators",
          "higher",
          "light",
          "enjoy",
          "coop-recs",
          "music",
          "art",
          "lounge",
          "photography",
          "geopolitics",
          "purple",
          "base-builds",
          "basepaint",
          "philosophy",
          "framedl-pro",
          "manysuchcases",
          "memes",
        ],
      },
    },
    include: {
      ruleSets: true,
      user: true,
    },
  })) as FullModeratedChannel[];

  for (const moderatedChannel of moderatedChannels) {
    if (!moderatedChannel.inclusionRuleSet || !moderatedChannel.exclusionRuleSet) {
      console.log("skipping", moderatedChannel.id);
      continue;
    }

    const inclParsed = JSON.parse(moderatedChannel.inclusionRuleSet);
    inclParsed.ruleParsed = inclParsed.rule;
    inclParsed.actionsParsed = inclParsed.actions;

    const exclParsed = JSON.parse(moderatedChannel.exclusionRuleSet);
    exclParsed.ruleParsed = exclParsed.rule;
    exclParsed.actionsParsed = exclParsed.actions;

    moderatedChannel.inclusionRuleSetParsed = inclParsed;
    moderatedChannel.exclusionRuleSetParsed = exclParsed;

    const [curates, hides] = await Promise.all([
      prisma.moderationLog.findMany({
        where: {
          channelId: moderatedChannel.id,
          action: "like",
          actor: "system",
          createdAt: {
            gte: new Date("2024-06-01"),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 15,
      }),
      prisma.moderationLog.findMany({
        where: {
          channelId: moderatedChannel.id,
          action: "hideQuietly",
          actor: "system",
          createdAt: {
            gte: new Date("2024-06-01"),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 15,
      }),
    ]);

    const modLogs = [...curates, ...hides];

    if (!modLogs.length) {
      console.log(`[${moderatedChannel.id}] no moderations`);
      continue;
    }

    const [casts, channel] = await Promise.all([
      neynar.fetchBulkCasts(modLogs.map((l) => l.castHash!)),
      getChannel({ name: moderatedChannel.id }),
    ]).catch(() => {
      return [null, null];
    });

    if (!casts || !channel) {
      console.error(`${moderatedChannel.id} neynar req failed`);
      continue;
    }

    console.log(casts.result.casts.map((c) => c.hash));

    const results = await Promise.all(
      casts.result.casts.map((cast) =>
        validateCast({
          channel,
          moderatedChannel,
          cast: cast as WebhookCast,
          simulation: true,
        })
      )
    );

    for (const result of results) {
      if (!result.length) {
        console.log(`[${moderatedChannel.id} ${result[0]?.castHash}] no results`);
        continue;
      }

      const exists = modLogs.some((l) =>
        result.some((r) => r.castHash === l.castHash && l.action === r.action)
      );
      if (exists) {
        console.log(`[/${moderatedChannel.id} ${result[0]?.castHash}] passed (moderated)`);
      } else {
        console.log(
          `[/${moderatedChannel.id} [${result[0]?.castHash}] expected: ${
            modLogs.find((m) => m.castHash === result[0]?.castHash)?.action
          }, actual ${result[0]?.action}`
        );

        console.log(
          "inclusion",
          JSON.stringify(moderatedChannel.inclusionRuleSetParsed?.ruleParsed, null, 2)
        );
        console.log(
          "exclusion",
          JSON.stringify(moderatedChannel.exclusionRuleSetParsed?.ruleParsed, null, 2)
        );
        moderatedChannel.ruleSets.map((rs, index) => {
          console.log("ruleset" + index);
          console.log("rule", JSON.stringify(JSON.parse(rs.rule), null, 2));
        });
      }
    }

    console.log(results.flatMap((r) => r.flatMap((ra) => ra.action + ", " + ra.reason)).join("\t\n\t"));
  }

  console.log("done");
}

main().catch(console.error);
