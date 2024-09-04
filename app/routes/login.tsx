import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { Alert } from "~/components/ui/alert";
import { authenticator, redirectCookie } from "~/lib/auth.server";
import { getSharedEnv } from "~/lib/utils.server";
import { LoginButton } from "./_index";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const invite = url.searchParams.get("invite");
  const redirectTo = url.searchParams.get("redirectTo");

  if (code) {
    return await authenticator.authenticate("otp", request, {
      successRedirect: redirectTo || "/~",
      failureRedirect: "/login?error=invalid-otp",
    });
  }

  const user = await authenticator.isAuthenticated(request);

  if (user) {
    return redirect(redirectTo || "/~");
  }

  const headers = redirectTo ? { "Set-Cookie": await redirectCookie.serialize(redirectTo) } : undefined;

  return typedjson(
    {
      env: getSharedEnv(),
      invite,
      error,
    },
    {
      headers,
    }
  );
}

export default function Login() {
  const { env, error, invite } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center min-h-screen"
      style={{
        backgroundImage:
          "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
      }}
    >
      <div className="max-w-xl flex flex-col justify-center items-center p-12 bg-white/10 rounded-md">
        <h1 className="text-3xl logo text-white mb-2">automod</h1>
        <p className="text-lg text-center text-[#f9ffd9] max-w-sm tracking-tighter leading-1">
          25+ composable rules to automatically moderate channel content.
        </p>

        {error && (
          <Alert className="mb-8" variant="destructive">
            {error}
          </Alert>
        )}

        <div className="flex flex-row items-center justify-center">
          <LoginButton user={null} error={error} env={env} />
        </div>
      </div>
    </div>
  );
}
