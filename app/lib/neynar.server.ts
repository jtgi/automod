import { NeynarAPIClient } from "@neynar/nodejs-sdk";

import { cache } from "./cache.server";
import { FollowResponseUser, Reaction } from "@neynar/nodejs-sdk/build/neynar-api/v1";
import { CastWithInteractions, Channel, User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import axios from "axios";
import { getSetCache, getSharedEnv } from "./utils.server";
import { http } from "./http.server";

export const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!, { axiosInstance: http });

export async function registerWebhook({ rootParentUrl }: { rootParentUrl: string }) {
  const webhook = await axios.get(
    `https://api.neynar.com/v2/farcaster/webhook?webhook_id=${process.env.NEYNAR_WEBHOOK_ID!}`,
    {
      headers: {
        api_key: process.env.NEYNAR_API_KEY!,
      },
    }
  );
  const existingWebhooks = webhook.data.webhook?.subscription?.filters?.["cast.created"]
    ?.root_parent_urls as string[];
  if (!existingWebhooks || !existingWebhooks.length) {
    console.error(`No existing webhooks found for webhook ${process.env.NEYNAR_WEBHOOK_ID!}`);
    throw new Error("No existing webhooks found for webhook");
  }

  if (existingWebhooks.includes(rootParentUrl)) {
    return;
  }

  existingWebhooks.push(rootParentUrl);

  return axios
    .put(
      `https://api.neynar.com/v2/farcaster/webhook/`,
      {
        webhook_id: process.env.NEYNAR_WEBHOOK_ID!,
        name: "automod",
        url: `${getSharedEnv().hostUrl}/api/webhooks/neynar`,
        description: "automod webhook",
        subscription: {
          "cast.created": {
            author_fids: [],
            root_parent_urls: existingWebhooks,
            parent_urls: [],
            mentioned_fids: [],
          },
        },
      },
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY!,
        },
      }
    )
    .catch((e) => {
      if (e.response) {
        console.error(e.response.data);
      }
      throw e;
    });
}

export async function unregisterWebhook({ rootParentUrl }: { rootParentUrl: string }) {
  const webhook = await axios.get(
    `https://api.neynar.com/v2/farcaster/webhook?webhook_id=${process.env.NEYNAR_WEBHOOK_ID!}`,
    {
      headers: {
        api_key: process.env.NEYNAR_API_KEY!,
      },
    }
  );
  const existingWebhooks = webhook.data.webhook?.subscription?.filters?.["cast.created"]
    .root_parent_urls as string[];
  if (!existingWebhooks || !existingWebhooks.length) {
    console.error(`No existing webhooks found for webhook ${process.env.NEYNAR_WEBHOOK_ID!}`);
    throw new Error("No existing webhooks found for webhook");
  }

  if (!existingWebhooks.includes(rootParentUrl)) {
    return;
  }

  existingWebhooks.splice(existingWebhooks.indexOf(rootParentUrl), 1);

  return axios.put(
    `https://api.neynar.com/v2/farcaster/webhook/`,
    {
      webhook_id: process.env.NEYNAR_WEBHOOK_ID!,
      name: "automod",
      url: `${getSharedEnv().hostUrl}/api/webhooks/neynar`,
      description: "automod webhook",
      subscription: {
        "cast.created": {
          author_fids: [],
          root_parent_urls: existingWebhooks,
          parent_urls: [],
          mentioned_fids: [],
        },
      },
    },
    {
      headers: {
        api_key: process.env.NEYNAR_API_KEY!,
      },
    }
  );
}

export async function* pageChannelCasts(props: { id: string }) {
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const url = new URL(`https://api.neynar.com/v2/farcaster/feed/channels`);
    url.searchParams.set("channel_ids", props.id);
    url.searchParams.set("with_recasts", "false");
    url.searchParams.set("viewer_fid", "5179");
    url.searchParams.set("with_replies", "false");

    // can't use the sdk right now because should_moderate is
    // not included and node needs upgrading
    url.searchParams.set("should_moderate", "false");
    url.searchParams.set("limit", "100");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const rsp = await axios.get<{ casts: Array<CastWithInteractions>; next: { cursor: string | null } }>(
      url.toString(),
      {
        headers: {
          api_key: process.env.NEYNAR_API_KEY!,
        },
      }
    );

    yield rsp.data;
    cursor = rsp.data.next.cursor;
  }
}

export async function getChannel(props: { name: string }) {
  const cacheKey = `channel:${props.name}`;
  const cached = cache.get<Channel>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await neynar.lookupChannel(props.name);
  cache.set(cacheKey, response.channel, process.env.NODE_ENV === "development" ? 0 : 60 * 60 * 24);

  return response.channel;
}

export async function getUsername(props: { username: string }) {
  const user = getSetCache({
    key: `username:${props.username}`,
    get: async () => {
      const response = await neynar.lookupUserByUsername(props.username);
      return response.result.user;
    },
    ttlSeconds: 60 * 60 * 4,
  });

  return user;
}

export async function getUser(props: { fid: string }) {
  const cacheKey = `user:${props.fid}`;
  const cached = cache.get<User>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await neynar.fetchBulkUsers([+props.fid], {});
  cache.set(cacheKey, response.users[0], process.env.NODE_ENV === "development" ? 0 : 60 * 60);

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
      cursor: cursor || undefined,
    });

    results = results.concat(response.result.users);
    cursor = cursor !== response.result.next.cursor ? response.result.next.cursor : null;
  }

  cache.set(cacheKey, results);
  return results;
}
