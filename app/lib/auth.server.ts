import type { User } from "@prisma/client";
import { Authenticator } from "remix-auth";
import { db } from "~/lib/db.server";
import { createCookieSessionStorage } from "@remix-run/node";
import { FarcasterStrategy } from "./farcaster-strategy";
import { OtpStrategy } from "./otp-strategy";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.SESSION_SECRET || "STRONG_SECRET"],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export const authenticator = new Authenticator<User>(sessionStorage, {
  throwOnError: true,
});

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
  fid: string;
  username?: string;
  pfpUrl?: string;
};

authenticator.use(new FarcasterStrategy(verifyFarcasterUser));

export async function verifyFarcasterUser(
  args: FarcasterUser & { request: Request }
) {
  const user = await db.user.findFirst({
    where: {
      providerId: args.fid,
    },
  });

  if (!user) {
    return await db.user.create({
      data: {
        name: args.username || args.fid,
        avatarUrl: args.pfpUrl,
        providerId: args.fid,
      },
    });
  }

  return user;
}
