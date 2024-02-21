import {
  AuthKitProvider,
  SignInButton,
  StatusAPIResponse,
} from "@farcaster/auth-kit";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { Alert } from "~/components/ui/alert";
import { authenticator } from "~/lib/auth.server";
import { getSharedEnv } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const invite = url.searchParams.get("invite");

  if (code) {
    return await authenticator.authenticate("otp", request, {
      successRedirect: "/~",
      failureRedirect: "/login?error=invalid-otp",
    });
  }

  const user = await authenticator.isAuthenticated(request);

  if (user) {
    return redirect("/~");
  }

  return typedjson({
    env: getSharedEnv(),
    invite,
    error,
  });
}

export default function Login() {
  const { env, error, invite } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  const handleSuccess = useCallback((res: StatusAPIResponse) => {
    invariant(res.message, "message is required");
    invariant(res.signature, "signature is required");
    invariant(res.nonce, "nonce is required");

    const params = new URLSearchParams();
    params.append("message", res.message);
    params.append("signature", res.signature);
    params.append("nonce", res.nonce);
    res.username && params.append("username", res.username);
    res.pfpUrl && params.append("pfpUrl", res.pfpUrl);
    invite && params.append("invite", invite);

    navigate(`/auth/farcaster?${params}`, {
      replace: true,
    });
  }, []);

  return (
    <AuthKitProvider config={farcasterConfig}>
      <div className="h-full w-full flex flex-col items-center justify-center min-h-screen">
        <div className="max-w-xl flex flex-col justify-center items-center">
          <h1 className="text-6xl logo">automod</h1>
          <h2 className="font-normal mb-8">
            get rid of channel spam with bots
          </h2>

          {error && (
            <Alert className="mb-8" variant="destructive">
              {error}
            </Alert>
          )}

          <div className="flex flex-row items-center justify-center pt-8">
            <SignInButton onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
    </AuthKitProvider>
  );
}
