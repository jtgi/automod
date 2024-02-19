import axios, { AxiosResponse } from "axios";
import { Action, ActionFunction } from "./validations.server";
import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";

const token = process.env.WARPCAST_TOKEN!;

export async function coolDown({
  channel,
  cast,
}: {
  channel: string;
  cast: Cast;
}) {
  throw new Error("Not implemented");
}

export function hideQuietly({
  channel,
  cast,
}: {
  channel: string;
  cast: Cast;
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

export function ban({ channel, cast }: { channel: string; cast: Cast }) {
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

export function unban({ channel, cast }: { channel: string; cast: Cast }) {
  const channelKey = channel;
  const fid = cast.author.fid;
  return axios.put(
    `https://client.warpcast.com/v1/user-channel-ban`,
    {
      channelKey,
      fid,
      banned: false,
    },
    {
      headers: headers(),
    }
  );
}

export function warnAndHide({
  channel,
  cast,
}: {
  channel: string;
  cast: Cast;
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
