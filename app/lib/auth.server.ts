import type { User } from "@prisma/client";
import * as Sentry from "@sentry/remix";
import { Authenticator } from "remix-auth";
import { db } from "~/lib/db.server";
import { createCookie, createCookieSessionStorage } from "@remix-run/node";
import { FarcasterStrategy } from "./farcaster-strategy";
import { OtpStrategy } from "./otp-strategy";
import { GodStrategy } from "./god-strategy";
import { getSubscriptionPlan } from "./subscription.server";

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

export const redirectCookie = createCookie("redirectTo", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60,
  secure: process.env.NODE_ENV === "production",
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
            plan: subscription.plan,
          },
        });

        if (existingUser) {
          Sentry.captureMessage(
            `Token ${subscription.tokenId} for ${subscription.plan} already in use by ${existingUser.name}.`
          );
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
