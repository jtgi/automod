import { getSetCache } from "./utils.server";
import { http } from "./http.server";

const token = process.env.WARPCAST_TOKEN!;

export async function getWarpcastChannelOwner(props: { channel: string }): Promise<number> {
  const channel = await getWarpcastChannel(props);
  return channel.leadFid;
}

export type WarpcastChannel = {
  id: string;
  url: string;
  name: string;
  description: string;
  imageUrl: string;
  leadFid: number;
  hostFids: number[];
  moderatorFid: number;
  createdAt: number;
  followerCount: number;
};

export const warpcastChannelCacheKey = (channel: string) => `warpcast-channel-${channel.toLowerCase()}`;

export async function getWarpcastChannel(props: { channel: string }): Promise<WarpcastChannel> {
  return getSetCache({
    key: warpcastChannelCacheKey(props.channel),
    ttlSeconds: 60 * 5,
    get: async () => {
      const rsp = await http.get(
        `https://api.warpcast.com/v1/channel?channelId=${props.channel.toLowerCase()}`
      );
      return rsp.data.result.channel;
    },
  });
}

export async function getWarpcastChannels() {
  return getSetCache({
    key: `all-warpcast-channels`,
    get: async () => {
      const rsp = await http.get<{ result: { channels: Array<WarpcastChannel> } }>(
        `https://api.warpcast.com/v2/all-channels`
      );
      return rsp.data.result.channels;
    },
    ttlSeconds: 60 * 5,
  });
}

export async function getOwnedChannels(props: { fid: number }) {
  const channels = await getWarpcastChannels();
  return channels.filter((c) => c.leadFid === props.fid);
}

export async function getCast(props: { hash: string; username: string }) {
  return http
    .get<{ result: { casts: Array<{ text: string; timestamp: number }> } }>(
      `https://client.warpcast.com/v2/user-thread-casts?castHashPrefix=${props.hash.substring(
        0,
        10
      )}&username=${props.username}`
    )
    .then((rsp) => rsp.data.result?.casts[0]);
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
