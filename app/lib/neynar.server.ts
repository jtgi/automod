import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { cache } from "./cache.server";
import { Reaction } from "@neynar/nodejs-sdk/build/neynar-api/v1";
export const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

export async function pageReactionsDeep(props: { hash: string }) {
  const cacheKey = `reactions:${props.hash}`;
  const cached = cache.get<Array<Reaction>>(cacheKey);

  if (cached) {
    return cached;
  }

  let results: Array<Reaction> = [];
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const response = await neynar.fetchCastReactions(props.hash, {
      limit: 150,
      cursor,
    });

    results = results.concat(response.result.casts);
    cursor = response.result.next.cursor;
  }

  cache.set(cacheKey, results);
  return results;
}
