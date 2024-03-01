/* eslint-disable no-undef */
import axios from "axios";
import fs from "node:fs";

async function main() {
  const ntoken = process.env.NEYNAR_API_KEY;
  const wtoken = process.env.WARP_TOKEN;
  const channel = process.env.CHANNEL;
  const limit = process.env.LIMIT;

  const warpcasts = [];
  let latestMainCastTimestamp = undefined;

  while (warpcasts.length < limit) {
    const res1 = await axios.post(
      "https://client.warpcast.com/v2/feed-items",
      {
        feedKey: channel,
        updateState: true,
        latestMainCastTimestamp,
        olderThan: latestMainCastTimestamp,
        excludeItemIdPrefixes: warpcasts.map((cast) =>
          cast.id.substring(2, 10)
        ),
      },
      {
        authorization: `Bearer ${wtoken}`,
      }
    );

    const items = res1.data.result.items;
    latestMainCastTimestamp = res1.data.result.latestMainCastTimestamp;
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      warpcasts.push(item);
    }
  }

  const neynarCasts = [];
  while (neynarCasts.length < limit) {
    const res2 = await axios.get(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&with_recasts=true&with_replies=false&limit=100`,
      {
        headers: {
          api_key: ntoken,
        },
      }
    );

    const items = res2.data.casts;
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      neynarCasts.push(item);

      if (neynarCasts.length >= limit) {
        break;
      }
    }
  }

  const delta = [];
  for (const neynarCast of neynarCasts) {
    const warpCast = warpcasts.find((cast) => cast.id === neynarCast.hash);

    if (!warpCast) {
      delta.push(neynarCast);
    }
  }

  fs.writeFileSync(
    `./${channel}-delta.json`,
    JSON.stringify(
      {
        warpcasts,
        neynarCasts,
        delta,
      },
      null,
      2
    )
  );
}

main();
