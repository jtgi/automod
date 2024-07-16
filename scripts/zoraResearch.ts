/* eslint-disable @typescript-eslint/no-unused-vars */
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { neynar } from "~/lib/neynar.server";

async function main() {
  let cursor: string | null | undefined = undefined;
  const results: CastWithInteractions[] = [];
  while (results.length < 1000) {
    const response = await neynar.fetchFeedByChannelIds(["zora"], {
      limit: 100,
      cursor: cursor ?? undefined,
      shouldModerate: true,
    });

    results.push(...response.casts);

    if (response.next.cursor === cursor) {
      break;
    } else {
      cursor = response.next.cursor;
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
