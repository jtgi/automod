import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import { redirect, typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (user) {
    throw redirect("/");
  }

  return json({});
}

export default function Login() {
  const navigate = useNavigate();

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

    navigate(`/auth/farcaster?${params}`, {
      replace: true,
    });
  }, []);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center min-h-screen">
      <div className="max-w-xl flex flex-col justify-center items-center">
        <h1 className="text-6xl logo">glass</h1>
        <h2 className="font-normal mb-8">Gate content with Farcaster Frames</h2>

        <div className="space-y-4">
          <p>
            Glass is currently in private beta.
            <br />
            Reach out to <a href="https://warpcast.com/jtgi">@jtgi</a> for
            access.
          </p>
          <div className="flex flex-row items-center justify-center pt-8">
            <SignInButton onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
    </div>
  );
}
