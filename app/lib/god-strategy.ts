/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "@prisma/client";
import { AuthenticateOptions, Strategy } from "remix-auth";
import { SessionStorage } from "@remix-run/node";
import { authenticator, getSession } from "./auth.server";

export class GodStrategy extends Strategy<User, { username: string }> {
  name = "god";

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions
  ): Promise<User> {
    const session = await getSession(request.headers.get("Cookie"));
    const username = session.get("impersonateAs");

    if (!username) {
      return await this.failure("not allowed", request, sessionStorage, options);
    }

    const user = await authenticator.isAuthenticated(request);
    if (!user) {
      return await this.failure("not authenticated", request, sessionStorage, options);
    }

    if (user.role !== "superadmin") {
      return await this.failure("unauthorized", request, sessionStorage, options);
    }

    const impersonatedUser = await this.verify({ username });

    if (!impersonatedUser) {
      return await this.failure(`${username} not found`, request, sessionStorage, options);
    }

    console.warn(`${user.name} is impersonating as ${impersonatedUser.name}`);

    return this.success(impersonatedUser, request, sessionStorage, options);
  }
}
