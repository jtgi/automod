/* eslint-disable no-undef */
import axios from "axios";
import fs from "node:fs";

async function main() {
  const ntoken = process.env.NEYNAR_API_KEY;
  const wtoken = process.env.WARPCAST_TOKEN;
  const channel = process.env.CHANNEL;
  let limit = parseInt(process.env.LIMIT);
  limit = isNaN(limit) ? Number.MAX_SAFE_INTEGER : limit;

  const warpcasts = [];
  let latestMainCastTimestamp = undefined;

  console.log("fetching casts from warpcast...");

  while (warpcasts.length < limit) {
    console.log("fetching new page...");
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
    if (!latestMainCastTimestamp) {
      latestMainCastTimestamp = res1.data.result.latestMainCastTimestamp;
    }

    for (const item of items) {
      warpcasts.push(item);
    }

    if (items.length === 0) {
      console.log("no more items");
      break;
    }
  }

  console.log("fetching casts from neynar...");

  const neynarCasts = [];
  while (neynarCasts.length < limit) {
    console.log(`fetching new page...`);
    const res2 = await axios.get(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&with_replies=false&limit=100`,
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
