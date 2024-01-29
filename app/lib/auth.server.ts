import type { User } from "@prisma/client";
import { Authenticator } from "remix-auth";
import { db } from "~/lib/db.server";
import { createCookieSessionStorage } from "@remix-run/node";
import { FarcasterStrategy } from "./farcaster-strategy";

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

export let authenticator = new Authenticator<User>(sessionStorage, {
  throwOnError: true,
});

authenticator.use(
  new FarcasterStrategy(async (args: FarcasterUser & { request: Request }) => {
    let user = await db.user.findFirst({
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
  })
);
export type FarcasterUser = {
  fid: string;
  username?: string;
  pfpUrl?: string;
};
