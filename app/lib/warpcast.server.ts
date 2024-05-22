/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axiosFactory, { AxiosResponse } from "axios";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { cache } from "./cache.server";
import { db } from "./db.server";
import { Action } from "./validations.server";
import { neynar } from "./neynar.server";
import { getSetCache } from "./utils.server";

const token = process.env.WARPCAST_TOKEN!;
export const http = axiosFactory.create({
  headers: {
    "x-agent": "automod",
  },
});

http.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
  const config = err.config;

  console.error({
    status: err.response?.status,
    data: JSON.stringify(err.response?.data),
  });

  if (
    err.response?.status &&
    (err.response.status === 429 || err.response.status >= 500) &&
    !config.__retryCount
  ) {
    config.__retryCount = 0;
  }

  if (config.__retryCount < 3) {
    // Max retry limit
    config.__retryCount += 1;
    const backoffDelay = 2 ** config.__retryCount * 1000; // Exponential backoff
    console.warn(`Received HTTP ${err.response.status}, retrying in ${backoffDelay}ms`);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(http(config));
      }, backoffDelay);
    });
  }

  return Promise.reject(err);
});

type HostResult = {
  result: {
    hosts: Array<{
      fid: number;
      username: string;
      displayName: string;
      pfp: {
        url: string;
        verified: boolean;
      };
    }>;
  };
};

// create channels: owner or legacy cohosts (until removed)
// update channels: channel.userId or anyone with automod:*
// mod security check: remove

export async function isCohost(props: { fid: number; channel: string }) {
  if (process.env.NODE_ENV === "test") {
    return props.fid === 1;
  }

  const hosts = await getWarpcastChannelHosts(props);
  return hosts.some((host) => host.fid === String(props.fid));
}

export async function getChannelOwner(props: { channel: string }) {
  const channelDelegates = await getWarpcastChannelHosts(props);
  return channelDelegates.find((d) => d.role.isOwnerRole);
}

export async function getWarpcastChannelHosts(props: { channel: string }) {
  const channel = await getWarpcastChannel(props);
  return Array.from(new Set([channel.leadFid, ...channel.hostFids]));
}

export async function getWarpcastChannel(props: { channel: string }) {
  const rsp = await getSetCache({
    key: `channel:${props.channel}`,
    get: async () => http.get(`https://api.warpcast.com/v1/channel?channelId=${props.channel.toLowerCase()}`),
    ttlSeconds: 60 * 3,
  });

  return rsp.data.result.channel;
}

export async function cooldown({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { duration } = (action as any).args;

  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
  });
}

export async function mute({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}

export async function hideQuietly({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
  return http.put(
    `https://client.warpcast.com/v2/debug-cast-embeds`,
    {
      castHash: cast.hash,
      downvote: true,
      isWarning: false,
    },
    {
      headers: headers(),
    }
  );
}

export async function unhide({ castHash }: { castHash: string }) {
  return http.put(
    `https://client.warpcast.com/v2/debug-cast-embeds`,
    {
      castHash,
      downvote: false,
      isWarning: false,
    },
    {
      headers: headers(),
    }
  );
}

export async function addToBypass({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
  const moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  const username = cast.author.username;
  const uniqueNames = Array.from(new Set([...moderatedChannel.excludeUsernamesParsed, username]));

  return db.moderatedChannel.update({
    where: {
      id: channel,
    },
    data: {
      excludeUsernames: JSON.stringify(uniqueNames),
    },
  });
}

export async function downvote({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  if (action.type !== "downvote") {
    return;
  }

  const { voterFid, voterAvatarUrl, voterUsername } = action.args;
  await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  await db.downvote.upsert({
    where: {
      fid_castHash: {
        fid: String(voterFid),
        castHash: cast.hash,
      },
    },
    update: {},
    create: {
      castHash: cast.hash,
      channelId: channel,
      fid: voterFid,
      username: voterUsername,
      avatarUrl: voterAvatarUrl,
    },
  });
}

/**
 * This does not check permissions
 */
export async function grantRole({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { roleId } = (action as any).args;
  await db.role.findFirstOrThrow({
    where: {
      channelId: channel,
      id: roleId,
    },
  });

  const user = await neynar.lookupUserByUsername(cast.author.username);

  return db.delegate.upsert({
    where: {
      fid_roleId_channelId: {
        fid: String(cast.author.fid),
        roleId,
        channelId: channel,
      },
    },
    update: {},
    create: {
      fid: String(cast.author.fid),
      roleId,
      channelId: channel,
      avatarUrl: user.result.user.pfp.url,
      username: cast.author.username,
    },
  });
}

export async function warnAndHide({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
  return http.put(
    `https://client.warpcast.com/v2/debug-cast-embeds`,
    {
      castHash: cast.hash,
      downvote: true,
      isWarning: true,
    },
    {
      headers: headers(),
    }
  );
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    origin: "https://warpcast.com",
    referer: "https://warpcast.com",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  };
}
