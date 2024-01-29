import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { cache } from "./cache.server";
import {
  FollowResponseUser,
  Reaction,
} from "@neynar/nodejs-sdk/build/neynar-api/v1";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
export const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

export async function getUser(props: { fid: string }) {
  const cacheKey = `user:${props.fid}`;
  const cached = cache.get<User>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await neynar.fetchBulkUsers([+props.fid], {});
  cache.set(
    cacheKey,
    response.users[0],
    process.env.NODE_ENV === "development" ? 0 : 60 * 60
  );

  return response.users[0];
}
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

export async function pageFollowersDeep(props: { fid: number }) {
  const cacheKey = `followers:${props.fid}`;
  const cached = cache.get<Array<FollowResponseUser>>(cacheKey);

  if (cached) {
    return cached;
  }

  let results: Array<FollowResponseUser> = [];
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const response = await neynar.fetchUserFollowers(props.fid, {
      limit: 150,
      cursor,
    });

    results = results.concat(response.result.users);
    cursor = response.result.next.cursor;
  }

  cache.set(cacheKey, results);
  return results;
}
