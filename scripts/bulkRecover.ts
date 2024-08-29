import { recoverQueue } from "~/lib/bullish.server";
import { db } from "~/lib/db.server";

async function main() {
  const channels = [
    "mcon",
    "jazz",
    "localfirst",
    "aesthetic",
    "sales",
    "basecamp001",
    "weareone",
    "tmp",
    "undrgrndsounds",
    "gettingstarted",
    "doc",
    "fc-devs",
    "recovery",
    "goodbread",
    "rromd",
    "eulerlagrange",
    "euphoria",
    "billzh",
    "quality",
    "long",
    "artreply",
    "starcaster",
    "based-noobs",
    "castrology",
    "pool",
    "covenclassics",
    "ky",
    "dot",
    "syed",
    "the-new-future",
    "nexus",
    "energyorder",
    "fartcaster",
    "impact-reef",
    "plants",
    "brand3",
    "chess",
    "wellness",
    "news",
    "architecture",
  ];

  for (const c of channels) {
    const modChannel = await db.moderatedChannel.findFirstOrThrow({
      where: {
        id: c,
      },
    });

    console.log(`Recovering ${c}`);
    await recoverQueue.add("recover", {
      channelId: modChannel.id,
      moderatedChannel: modChannel,
      // last 30 days
      untilTimeUtc: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
