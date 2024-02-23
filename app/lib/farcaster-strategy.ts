import { InviteCode, User } from "@prisma/client";
import { FarcasterUser } from "./auth.server";
import { AuthenticateOptions, Strategy } from "remix-auth";
import { SessionStorage } from "@remix-run/node";
import { createAppClient, viemConnector } from "@farcaster/auth-kit";
import { db } from "./db.server";
import { getSharedEnv } from "./utils.server";

export class FarcasterStrategy extends Strategy<
  User,
  FarcasterUser & { request: Request }
> {
  name = "farcaster";

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions
  ): Promise<User> {
    const url = new URL(request.url);
    const credentials = Object.fromEntries(url.searchParams.entries());

    if (!credentials.message || !credentials.signature || !credentials.nonce) {
      return await this.failure(
        "Missing message, signature or nonce",
        request,
        sessionStorage,
        options
      );
    }

    const env = getSharedEnv();

    const appClient = createAppClient({
      ethereum: viemConnector(),
    });

    const verifyResponse = await appClient.verifySignInMessage({
      message: credentials.message,
      signature: credentials.signature as `0x${string}`,
      domain: new URL(env.hostUrl).host.split(":")[0],
      nonce: credentials.nonce,
    });
    const { success, fid, error } = verifyResponse;

    if (!success) {
      return await this.failure(
        "Invalid signature",
        request,
        sessionStorage,
        options,
        error
      );
    }

    const inviteCode = url.searchParams.get("invite");
    let invite: InviteCode | null = null;
    if (inviteCode) {
      invite = await db.inviteCode.findUnique({
        where: {
          id: inviteCode,
        },
      });

      if (!invite) {
        return await this.failure(
          "Invalid invite code",
          request,
          sessionStorage,
          options
        );
      }

      await db.order.upsert({
        where: {
          fid: fid.toString(),
        },
        create: {
          fid: fid.toString(),
        },
        update: {
          fid: fid.toString(),
        },
      });
    } else {
      const order = await db.order.findFirst({
        where: {
          fid: fid.toString(),
        },
      });

      if (!order) {
        return await this.failure(
          "No access",
          request,
          sessionStorage,
          options
        );
      }
    }

    const user = await this.verify({
      fid: fid.toString(),
      username: credentials.username,
      pfpUrl: credentials.pfpUrl,
      request,
    });

    if (invite && !user.inviteCodeId) {
      await db.user.update({
        where: {
          id: user.id,
        },
        data: {
          inviteCodeId: invite.id,
        },
      });
    }

    return this.success(user, request, sessionStorage, options);
  }
}
