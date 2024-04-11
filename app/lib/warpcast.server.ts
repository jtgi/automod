/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axiosFactory, { AxiosResponse } from "axios";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { cache } from "./cache.server";
import { db } from "./db.server";
import { Action } from "./validations.server";
import { neynar } from "./neynar.server";

const token = process.env.WARPCAST_TOKEN!;
const http = axiosFactory.create();

http.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
  const config = err.config;

  console.error({
    status: err.response?.status,
    data: err.response?.data,
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

export async function isCohost(props: { fid: number; channel: string }) {
  if (process.env.NODE_ENV === "test") {
    return props.fid === 1;
  }

  const rsp = await getChannelHosts(props);
  return rsp.result.hosts.some((host) => host.fid == props.fid);
}

export async function getChannelHosts(props: { channel: string }): Promise<HostResult> {
  const cacheKey = `getChannelHosts-${props.channel}`;
  const cached = cache.get<HostResult>(cacheKey);

  if (cached) {
    return cached;
  }

  if (process.env.NODE_ENV === "test") {
    return {
      result: {
        hosts: [],
      },
    };
  }
  const result = await http.get(
    `https://client.warpcast.com/v2/get-channel-hosts?channelKey=${props.channel}`
  );

  cache.set(cacheKey, result.data, 60 * 60 * 5);
  return result.data;
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

/**
 * This does not check permissions
 */
export async function grantRole({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  try {
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
  } catch (e) {
    console.error(e);

    throw e;
  }
}

export async function ban({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const isCohostCheck = await isCohost({ fid: cast.author.fid, channel });

  if (isCohostCheck) {
    console.log(`user ${cast.author.fid} is cohost of ${channel}, not banning`);
    return Promise.resolve({} as AxiosResponse);
  }

  const channelKey = channel;
  const fid = cast.author.fid;
  return http.put(
    `https://client.warpcast.com/v1/user-channel-ban`,
    {
      channelKey,
      fid,
      banned: true,
    },
    {
      headers: headers(),
    }
  );
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
