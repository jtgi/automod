import { User } from "@prisma/client";
import { FarcasterUser } from "./auth.server";
import { AuthenticateOptions, Strategy } from "remix-auth";
import { SessionStorage } from "@remix-run/node";
import { createAppClient, viemConnector } from "@farcaster/auth-kit";

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

    const appClient = createAppClient({
      ethereum: viemConnector(),
    });

    const verifyResponse = await appClient.verifySignInMessage({
      message: credentials.message,
      signature: credentials.signature as `0x${string}`,
      domain: new URL(process.env.HOST_URL!).host.split(":")[0],
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

    const user = await this.verify({
      fid: fid.toString(),
      username: credentials.username,
      pfpUrl: credentials.pfpUrl,
      request,
    });

    return this.success(user, request, sessionStorage, options);
  }
}
