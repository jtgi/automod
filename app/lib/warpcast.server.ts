import { getSetCache } from "./utils.server";
import { http } from "./http.server";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";

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

export async function publishCast(props: { text: string; token: string }) {
  return http
    .post<{ result: { cast: { hash: string } } }>(
      "https://client.warpcast.com/v2/casts",
      {
        text: props.text,
      },
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9,ja;q=0.8",
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json; charset=utf-8",
          "fc-amplitude-device-id": "yOEdRh1gmzkV6rTo6GnDlB",
          "fc-amplitude-session-id": "1725341913933",
          priority: "u=1, i",
          "sec-ch-ua": '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          Referer: "https://warpcast.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        method: "POST",
      }
    )
    .then((rsp) => rsp.data);
}

export async function getMembersForChannel(props: { channelId: string }): Promise<Array<{ fid: number }>> {
  console.log(`Fetching members for channel ${props.channelId}`);
  return [{ fid: 5179 }];
}

export async function removeUserFromChannel(props: { channelId: string; fid: number }) {
  console.log(`Removing user ${props.fid} from channel ${props.channelId}`);
  return;
}
