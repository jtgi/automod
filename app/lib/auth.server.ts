import type { User } from "@prisma/client";
import * as Sentry from "@sentry/remix";
import { Authenticator } from "remix-auth";
import { db } from "~/lib/db.server";
import { createCookieSessionStorage } from "@remix-run/node";
import { FarcasterStrategy } from "./farcaster-strategy";
import { OtpStrategy } from "./otp-strategy";
import { GodStrategy } from "./god-strategy";
import { clientsByChainId } from "./viem.server";
import { base } from "viem/chains";
import { getAddress, getContract } from "viem";
import { hypersubAbi721 } from "./abis";
import { neynar } from "./neynar.server";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    secrets: [process.env.SESSION_SECRET || "STRONG_SECRET"],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export const authenticator = new Authenticator<User>(sessionStorage, {
  throwOnError: true,
});

authenticator.use(
  new GodStrategy(async ({ username }) => {
    return db.user.findFirstOrThrow({
      where: {
        name: username,
      },
    });
  })
);

authenticator.use(
  new OtpStrategy(async ({ code }) => {
    const otp = await db.otp.findFirst({
      where: {
        code,
        active: true,
      },
    });

    if (!otp) {
      throw new Error("Invalid code");
    }

    await db.otp.update({
      where: {
        id: otp.id,
      },
      data: {
        active: false,
      },
    });

    const user = await db.user.findFirstOrThrow({
      where: {
        id: otp.userId,
      },
    });

    return user;
  })
);

export type FarcasterUser = {
  inviteCodeId?: string;
  fid: string;
  username?: string;
  pfpUrl?: string;
};

authenticator.use(new FarcasterStrategy(verifyFarcasterUser));

export async function verifyFarcasterUser(args: FarcasterUser & { request: Request }) {
  const user = await db.user.findFirst({
    where: {
      id: args.fid,
    },
  });

  if (!user) {
    const order = await db.order.findFirst({
      where: {
        fid: args.fid,
      },
    });

    let subscription: Awaited<ReturnType<typeof getSubscriptionPlan>> | undefined;
    if (!order) {
      subscription = await getSubscriptionPlan({ fid: args.fid });

      if (subscription.tokenId) {
        const existingUser = await db.user.findFirst({
          where: {
            planTokenId: subscription.tokenId,
          },
        });

        if (existingUser) {
          Sentry.captureMessage(`Token ${subscription.tokenId} already in use.`);
          throw new Error(`Token already in use. Contact support.`);
        }
      }
    }

    return await db.user.create({
      data: {
        id: args.fid,
        plan: subscription?.plan || "basic",
        planExpiry: subscription?.expiresAt,
        planTokenId: subscription?.tokenId,
        name: args.username || args.fid,
        avatarUrl: args.pfpUrl,
        inviteCodeId: args.inviteCodeId,
      },
    });
  }

  return user;
}

export const planTypes = ["basic", "prime", "ultra", "vip"] as const;
export type PlanType = (typeof planTypes)[number];

export const userPlans = {
  basic: {
    maxChannels: 3,
    maxCasts: 1_000,
  },
  prime: {
    maxChannels: 5,
    maxCasts: 100_000,
  },
  ultra: {
    maxChannels: Infinity,
    maxCasts: 1_000_000,
  },
  vip: {
    maxChannels: Infinity,
    maxCasts: Infinity,
  },
} as const satisfies {
  [key in PlanType]: {
    maxChannels: number;
    maxCasts: number;
  };
};

async function getSubscriptionPlan(args: { fid: string }): Promise<{
  plan: PlanType;
  tokenId: string | null;
  expiresAt: Date | null;
}> {
  const client = clientsByChainId[base.id];
  const powerContractAddress = process.env.PRIME_CONTRACT_ADDRESS!;
  const ultraContractAddress = process.env.ULTRA_CONTRACT_ADDRESS!;

  const powerContract = getContract({
    address: getAddress(powerContractAddress),
    abi: hypersubAbi721,
    client,
  });

  const ultraContract = getContract({
    address: getAddress(ultraContractAddress),
    abi: hypersubAbi721,
    client,
  });

  const rsp = await neynar.fetchBulkUsers([+args.fid]);

  if (rsp.users.length === 0) {
    throw new Error(`User not found: ${args.fid}`);
  }

  const user = rsp.users[0];
  for (const address of user.verified_addresses.eth_addresses) {
    const [powerSecondsRemaining, ultraSecondsRemaining] = await Promise.all([
      powerContract.read.balanceOf([getAddress(address)]),
      ultraContract.read.balanceOf([getAddress(address)]),
    ]);

    if (ultraSecondsRemaining > 0) {
      const subInfo = await ultraContract.read.subscriptionOf([getAddress(address)]);
      const tokenId = subInfo[0];

      return {
        plan: "ultra",
        tokenId: tokenId.toString(),
        expiresAt: new Date(Date.now() + Number(ultraSecondsRemaining * 1000n)),
      };
    } else if (powerSecondsRemaining > 0) {
      const subInfo = await ultraContract.read.subscriptionOf([getAddress(address)]);
      const tokenId = subInfo[0];

      return {
        plan: "prime",
        tokenId: tokenId.toString(),
        expiresAt: new Date(Date.now() + Number(powerSecondsRemaining * 1000n)),
      };
    }
  }

  return {
    plan: "basic",
    expiresAt: null,
    tokenId: null,
  };
}
