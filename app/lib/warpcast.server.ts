import axios, { AxiosResponse } from "axios";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { cache } from "./cache.server";
import { db } from "./db.server";
import { Action } from "./validations.server";

const token = process.env.WARPCAST_TOKEN!;

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

export async function getChannelHosts(props: {
  channel: string;
}): Promise<HostResult> {
  const cacheKey = `getChannelHosts-${props.channel}`;
  const cached = cache.get<HostResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await axios.get(
    `https://client.warpcast.com/v2/get-channel-hosts?channelKey=${props.channel}`
  );

  cache.set(cacheKey, result.data, 60 * 60 * 5);
  return result.data;
}

export async function cooldown({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
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

export async function mute({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
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
  return axios.put(
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

export async function ban({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
  const isCohostCheck = await isCohost({ fid: cast.author.fid, channel });

  if (isCohostCheck) {
    console.log(`user ${cast.author.fid} is cohost of ${channel}, not banning`);
    return Promise.resolve({} as AxiosResponse);
  }

  const channelKey = channel;
  const fid = cast.author.fid;
  return axios.put(
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
  return axios.put(
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
