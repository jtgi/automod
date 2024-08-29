/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import axios from "axios";
import { db } from "~/lib/db.server";
import { registerWebhook } from "~/lib/neynar.server";
import { getWarpcastChannels } from "~/lib/warpcast.server";
import { automodFid } from "~/routes/~.channels.$id";

export async function main() {
  const wcChannels = await getWarpcastChannels();
  const webhookUrls = await axios
    .get<any>(`https://api.neynar.com/v2/farcaster/webhook?webhook_id=01HRAVJP0RZG21SKH3VQCVGJ9X`, {
      headers: {
        api_key: process.env.NEYNAR_API_KEY!,
      },
    })
    .then((res) => res.data.webhook.subscription.filters["cast.created"].root_parent_urls);

  console.log(`${webhookUrls.length} webhook urls registered`);
  const channels = await db.moderatedChannel.findMany({
    where: {
      active: true,
      url: {
        notIn: webhookUrls,
      },
    },
  });

  console.log(`${channels.length} active channels without webhooks`);

  for (const channel of channels) {
    const wcChannel = wcChannels.find((wc) => wc.id === channel.id);
    if (wcChannel?.moderatorFid !== automodFid) {
      continue;
    }

    console.log(`${channel.id}`);
    await registerWebhook({
      rootParentUrl: channel.url!,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
