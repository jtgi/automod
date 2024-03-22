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
import { getChannelHosts } from "./warpcast.server";
import { erc20Abi, erc721Abi, getAddress, getContract } from "viem";
import { clientsByChainId } from "./viem.server";
import { cache } from "./cache.server";

export async function convertSvgToPngBase64(svgString: string) {
  const buffer: Buffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  const base64PNG: string = buffer.toString("base64");
  return `data:image/png;base64,${base64PNG}`;
}

export async function requireUser({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: `/login`,
  });

  if (user && process.env.NODE_ENV === "production") {
    Sentry.setUser({ id: user.name });
  }

  return user;
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

export async function requireUserIsChannelLead(props: { userId: string; channelId: string }) {
  const result = await isChannelLead({
    userId: props.userId,
    channelId: props.channelId,
  });

  if (!result.isLead || !result.channel) {
    throw redirect(`/`, { status: 403 });
  }

  return result.channel;
}

/**
 *
 * Can moderate if they created the channel (lead) or are a
 * a comod. This is a local check, not remotely.
 */
export async function requireUserCanModerateChannel(props: { userId: string; channelId: string }) {
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
      comods: true,
    },
  });

  if (!channel) {
    throw redirect(`/`, { status: 403 });
  }

  return channel;
}

export async function requireUserIsCohost(props: { fid: number; channelId: string }) {
  const results = await getChannelHosts({
    channel: props.channelId,
  });

  const cohost = results.result.hosts.find((h) => h.fid === props.fid);

  if (!cohost) {
    throw redirect(`/`, { status: 403 });
  }

  return cohost;
}

export async function isChannelLead(props: { userId: string; channelId: string }) {
  const channel = await getChannel({ name: props.channelId }).catch(() => {
    return null;
  });

  if (!channel) {
    return {
      lead: null,
      isLead: false,
      channel: null,
    };
  }

  if (!channel.lead) {
    const cohosts = await getChannelHosts({ channel: props.channelId });

    if (cohosts.result.hosts.length === 0) {
      return {
        isLead: false,
        channel,
      };
    }

    const firstCohost = cohosts.result.hosts[0];
    return {
      lead: {
        fid: firstCohost.fid,
        username: firstCohost.username,
        avatarUrl: firstCohost.pfp.url,
      },
      isLead: firstCohost.fid === +props.userId,
      channel,
    };
  }

  return {
    lead: {
      fid: channel.lead.fid,
      username: channel.lead.username,
      avatarUrl: channel.lead.pfp_url,
    },
    isLead: channel.lead?.fid === +props.userId,
    channel,
  };
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
    nodeEnv: process.env.NODE_ENV!,
    hostUrl: process.env.NODE_ENV === "production" ? process.env.PROD_URL! : process.env.DEV_URL!,
  };
}

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
      ${params.input ? `<meta property="fc:frame:input:text" content="${params.input}">` : ""}
      <meta property="fc:frame" content="${version}">
      <meta property="fc:frame:image" content="${params.image}">
      ${params.postUrl ? `<meta property="fc:frame:post_url" content="${params.postUrl}">` : ""}
      ${
        params.buttons
          ? params.buttons
              .map((b, index) => {
                let out = `<meta property="fc:frame:button:${index + 1}" content="${b.text}">`;
                if (b.link) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:action" content="link">`;
                  out += `\n<meta property="fc:frame:button:${index + 1}:target" content="${b.link}">`;
                } else if (b.isRedirect) {
                  out += `\n<meta property="fc:frame:button:${index + 1}:action" content="post_redirect">`;
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
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

type FrameResponseArgs = {
  title?: string;
  input?: string;
  description?: string;
  version?: string;
  image: string;
  buttons?: Array<{
    text: string;
    link?: string;
    isRedirect?: boolean;
  }>;
  postUrl?: string;
};

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

  const host = new URL(message.action.url).host;
  if (host !== new URL(getSharedEnv().hostUrl).host && host !== "automod.sh") {
    throw new Error("No spoofs sir");
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

export async function validateErc721(props: { chainId?: string; contractAddress?: string }) {
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
