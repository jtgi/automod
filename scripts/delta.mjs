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

  let page = 1;
  while (warpcasts.length < limit) {
    const res1 = await axios.post(
      "https://client.warpcast.com/v2/feed-items?limit=1000",
      {
        feedKey: channel,
        feedType: "default",
        viewedCastHashes: "",
        updateState: true,
        latestMainCastTimestamp,
        olderThan: latestMainCastTimestamp,
        excludeItemIdPrefixes: warpcasts.map((cast) => cast.id.substring(2, 10)),
      },
      {
        authorization: `Bearer ${wtoken}`,
      }
    );

    const items = res1.data.result.items;
    if (!latestMainCastTimestamp) {
      latestMainCastTimestamp = res1.data.result.latestMainCastTimestamp;
    }

    console.log(`Page ${page}: Found ${items.length} casts`);

    for (const item of items) {
      warpcasts.push(item);
    }

    if (items.length === 0) {
      console.log("no more items");
      break;
    }

    page++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`Found ${warpcasts.length}/${limit} casts on Warpcast`);

  console.log("fetching casts from neynar...");

  const neynarCasts = [];
  let lastNeynarTimestamp = Number.MAX_VALUE;
  const lastWarpcastTimestamp = warpcasts.at(-1).timestamp;
  while (lastNeynarTimestamp > lastWarpcastTimestamp) {
    console.log({
      lastWarpcastTimestamp,
      lastNeynarTimestamp,
    });
    const res2 = await axios.get(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&with_replies=false&limit=100`,
      {
        headers: {
          api_key: ntoken,
        },
      }
    );

    console.log(`Found ${res2.data.casts.length} casts on neynar`);

    const items = res2.data.casts;
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      neynarCasts.push(item);
    }

    console.log(neynarCasts.at(-1).timestamp);
    lastNeynarTimestamp = new Date(items.at(-1).timestamp).getTime();
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
