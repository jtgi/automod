/* eslint-disable @typescript-eslint/no-explicit-any */
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import * as Sentry from "@sentry/remix";
import * as crypto from "crypto";
import { authenticator, commitSession, getSession } from "./auth.server";
import { generateFrameSvg } from "./utils";
import axios from "axios";
import { MessageResponse } from "./types";
import { getChannel } from "./neynar.server";
import { redirect, typedjson } from "remix-typedjson";
import { Session, json } from "@remix-run/node";
import { db } from "./db.server";
import { ZodIssue, ZodError } from "zod";
import { getWarpcastChannelHosts, getWarpcastChannelOwner } from "./warpcast.server";
import { erc20Abi, getAddress, getContract } from "viem";
import { clientsByChainId } from "./viem.server";
import { cache } from "./cache.server";
import { ActionType } from "./validations.server";
import { actionToPermission } from "./permissions.server";

export async function convertSvgToPngBase64(svgString: string) {
  const buffer: Buffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  const base64PNG: string = buffer.toString("base64");
  return `data:image/png;base64,${base64PNG}`;
}

export async function requireUser({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: `/login`,
  });

  const refreshedUser = await db.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });

  if (user && process.env.NODE_ENV === "production") {
    Sentry.setUser({ id: user.name });
  }

  return refreshedUser;
}

export async function requireSuperAdmin({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: `/`,
  });

  if (user.role !== "superadmin") {
    throw redirect(`/`, { status: 403 });
  }
}

export async function requireValidSignature(props: {
  request: Request;
  payload: string;
  sharedSecret: string;
  incomingSignature: string;
}) {
  const computedSignature = crypto
    .createHmac("sha512", props.sharedSecret)
    .update(props.payload)
    .digest("hex");

  const isValid = computedSignature === props.incomingSignature;

  if (!isValid) {
    console.error(`Invalid signature`, props.incomingSignature, props.payload);
    throw json({}, { status: 403 });
  }
}

export async function requireUserOwnsChannel(props: { userId: string; channelId: string }) {
  const channel = await db.moderatedChannel.findUnique({
    where: {
      id: props.channelId,
      userId: props.userId,
    },
    include: {
      ruleSets: true,
      moderationLogs: {
        take: 25,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!channel) {
    throw redirect(`/`, { status: 403 });
  }

  return channel;
}

/**
 *
 * Can moderate if they created the channel (lead) or are a
 * a comod. This is a local check, not remotely.
 */
export async function requireUserCanModerateChannel(props: { userId: string; channelId: string }) {
  const { result, channel } = await canUserModerateChannel({
    userId: props.userId,
    channelId: props.channelId,
  });

  if (!result || !channel) {
    throw redirect(`/`, { status: 403 });
  }

  return channel;
}

export async function canUserExecuteAction(props: { userId: string; channelId: string; action: ActionType }) {
  const [moderation] = await Promise.all([canUserModerateChannel(props)]);

  if (moderation.result) {
    return true;
  }

  const actionPermission = actionToPermission(props.action);

  // this is dangerous
  // const everyoneRole = moderatedChannel.roles.find((role) => role.isEveryoneRole);
  // if (everyoneRole?.permissions.includes(actionPermission)) {
  //   return true;
  // }

  const isDelegate = await db.delegate.findFirst({
    where: {
      channelId: props.channelId,
      fid: props.userId,
      role: {
        permissions: {
          contains: actionPermission,
        },
      },
    },
  });

  return isDelegate !== null;
}

export async function canUserModerateChannel(props: { userId: string; channelId: string }) {
  const channel = await db.moderatedChannel.findUnique({
    where: {
      id: props.channelId,
      OR: [
        {
          comods: {
            some: {
              fid: props.userId,
            },
          },
        },
        {
          userId: props.userId,
        },
      ],
    },
    include: {
      ruleSets: true,
      user: true,
      roles: {
        include: {
          delegates: true,
        },
      },
      comods: true,
    },
  });

  if (channel) {
    return {
      result: true,
      channel,
    };
  } else {
    return {
      result: false,
    };
  }
}

export async function requireUserIsCohost(props: { fid: number; channelId: string }) {
  const hosts = await getWarpcastChannelHosts({
    channel: props.channelId,
  });

  const cohost = hosts.find((fid) => fid === props.fid);

  if (!cohost) {
    throw redirect(`/`, { status: 403 });
  }

  return cohost;
}

export async function generateSystemFrame(message: string) {
  const svg = await generateFrameSvg(message, getSharedEnv().hostUrl, {
    scale: 1,
  });
  const imgSrc = await convertSvgToPngBase64(svg);
  return imgSrc;
}

export function getSharedEnv() {
  return {
    infuraProjectId: process.env.INFURA_PROJECT_ID!,
    postHogApiKey: process.env.POSTHOG_API_KEY!,
    neynarClientId: process.env.NEYNAR_CLIENT_ID!,
    nodeEnv: process.env.NODE_ENV!,
    hostUrl: process.env.NODE_ENV === "production" ? process.env.PROD_URL! : process.env.DEV_URL!,
  };
}

export async function parseMessage(payload: any) {
  const res = await axios.post(
    `https://api.neynar.com/v2/farcaster/frame/validate`,
    {
      message_bytes_in_hex: payload.trustedData.messageBytes,
      follow_context: true,
    },
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
        "content-type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const message = res.data as MessageResponse;
  if (!message.valid) {
    throw new Error("Invalid message");
  }

  if (process.env.NODE_ENV === "production") {
    const host = new URL(message.action.url).host;
    if (host !== new URL(getSharedEnv().hostUrl).host && host !== "automod.sh") {
      throw new Error("No spoofs sir");
    }
  }

  return message;
}

export async function successResponse<T>({
  request,
  message,
  session: passedSession,
  data,
  status,
}: {
  request: Request;
  session?: Session;
  message: string;
  data?: T;
  status?: number;
}) {
  const session = passedSession || (await getSession(request.headers.get("Cookie")));
  session.flash("message", {
    id: uuid(),
    type: "success",
    message,
  });

  return typedjson(
    {
      message,
      data,
    },
    {
      status: status || 200,
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export async function errorResponse(props: { request: Request; message: string; status?: number }) {
  const session = await getSession(props.request.headers.get("Cookie"));
  session.flash("message", {
    id: uuid(),
    type: "error",
    message: props.message,
  });

  return json(
    {
      message: props.message,
    },
    {
      status: props.status || 400,
      headers: { "Set-Cookie": await commitSession(session) },
    }
  );
}

export function formatZodIssue(issue: ZodIssue): string {
  const { path, message } = issue;
  const pathString = path.join(".");

  return `${pathString}: ${message}`;
}

// Format the Zod error message with only the current error
export function formatZodError(error: ZodError): string {
  const { issues } = error;

  if (issues.length) {
    const currentIssue = issues[0];

    return formatZodIssue(currentIssue);
  }

  return "";
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function validateErc1155(props: {
  chainId?: string;
  contractAddress?: string;
  tokenId?: string;
}) {
  if (!props.chainId || !props.contractAddress) {
    return false;
  }

  const client = clientsByChainId[props.chainId];
  const contract = getContract({
    address: getAddress(props.contractAddress),
    abi: [
      {
        constant: true,
        inputs: [{ name: "interfaceId", type: "bytes4" }],
        name: "supportsInterface",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    ],
    client,
  });

  const supportsInterface = await contract.read
    .supportsInterface(["0xd9b67a26" as `0x${string}`])
    .catch(() => false);

  return supportsInterface;
}

export async function validateErc721(props: { chainId?: string; contractAddress?: string }) {
  // @deployers 721a is a special case heh
  if (props.contractAddress?.toLowerCase() === "0x8ce608ce2b5004397faef1556bfe33bdfbe4696d".toLowerCase()) {
    return true;
  }

  if (!props.chainId || !props.contractAddress) {
    return false;
  }

  const client = clientsByChainId[props.chainId];
  const contract = getContract({
    address: getAddress(props.contractAddress),
    abi: [
      {
        constant: true,
        inputs: [{ name: "interfaceId", type: "bytes4" }],
        name: "supportsInterface",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    ],
    client,
  });

  const supportsInterface = await contract.read
    .supportsInterface(["0x80ac58cd" as `0x${string}`])
    .catch(() => false);

  return supportsInterface;
}

export async function validateErc20({
  chainId,
  contractAddress,
}: {
  chainId?: string;
  contractAddress?: string;
}) {
  if (!chainId || !contractAddress) {
    return false;
  }

  const client = clientsByChainId[chainId];
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: erc20Abi,
    client,
  });

  const anyAllowance = await contract.read
    .allowance([`0x704CF202792341d79A9Fd6DD97046aa7eF3F4319`, `0x704CF202792341d79A9Fd6DD97046aa7eF3F4319`])
    .catch(() => {
      return false;
    });

  return anyAllowance !== false;
}

export function formatHash(hash: string) {
  return `${hash.slice(0, 3)}...${hash.slice(-3)}`;
}

export function isCastHash(value: string): boolean {
  return value.match(/0x[a-fA-F0-9]{40}/) !== null;
}

export function isWarpcastCastUrl(value: string): boolean {
  return value.match(/https:\/\/warpcast.com\/[a-zA-Z0-9]+\/0x[a-fA-F0-9]{8}/) !== null;
}

export async function getSetCache<T>(props: {
  key: string;
  ttlSeconds?: number;
  get: () => Promise<T>;
}): Promise<T> {
  const { key, ttlSeconds, get } = props;
  const cachedValue = await cache.get<T>(key);

  if (cachedValue) {
    return cachedValue;
  }

  const freshValue = await get();
  cache.set(key, freshValue, ttlSeconds ?? 0);
  return freshValue;
}

type FrameResponseArgs = {
  title?: string;
  input?: string;
  state?: string;
  aspectRatio?: string;
  description?: string;
  version?: string;
  image: string;
  buttons?: Array<{
    text: string;
    tx?: string;
    link?: string;
    target?: string;
    isRedirect?: boolean;
    postUrl?: string;
  }>;
  postUrl?: string;
  cacheTtlSeconds?: number;
};

export function frameResponse(params: FrameResponseArgs) {
  const version = params.version || "vNext";
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      ${params.title ? `<title>${params.title}</title>` : ""}
      ${params.title ? `<meta property="og:title" content="${params.title}">` : ""}
      ${
        params.description
          ? `<meta property="description" content="${params.description}">
      <meta property="og:description" content="${params.description}">`
          : ""
      }
      ${`<meta property="fc:frame:image:aspect_ratio" content="${params.aspectRatio ?? "1.91:1"}">`}
      ${params.input ? `<meta property="fc:frame:input:text" content="${params.input}">` : ""}
      <meta property="fc:frame" content="${version}">
      <meta property="fc:frame:image" content="${params.image}">
      ${params.postUrl ? `<meta property="fc:frame:post_url" content="${params.postUrl}">` : ""}
      ${params.state ? `<meta property="fc:frame:state" content="${params.state}">` : ""}
      ${
        params.buttons
          ? params.buttons
              .map((b, index) => {
                let out = `<meta property="fc:frame:button:${index + 1}" content="${b.text}">`;

                if (b.link) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:action" content="link">`;
                  out += `\n<meta property="fc:frame:button:${index + 1}:target" content="${b.link}">`;
                } else if (b.tx) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:action" content="tx">`;
                  out += `\n<meta property="fc:frame:button:${index + 1}:target" content="${b.tx}">`;
                } else if (b.isRedirect) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:action" content="post_redirect">`;
                }

                if (b.postUrl) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:post_url" content="${b.postUrl}">`;
                }

                if (b.target) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:target" content="${b.target}">`;
                }

                return out;
              })
              .join("\n")
          : ""
      }
    </head>
    <body>
      <h1>${params.title}</h1>
      <p>${params.description}</p>
      <div>
      <img src="${params.image}" />
      </div>
      ${params.buttons?.map((b, index) => `<button name="button-${index}">${b.text}</button>`).join("\n")}
    </body>
  </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": `no-store, max-age=${params.cacheTtlSeconds ?? 60 * 15}`,
    },
  });
}

export async function getModerators(props: { channel: string }) {
  const channelDelegates = await db.delegate.findMany({
    where: {
      channelId: props.channel,
    },
    include: {
      role: true,
    },
  });

  return channelDelegates.filter((d) => d.role.isCohostRole);
}
