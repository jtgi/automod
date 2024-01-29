import { SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import { redirect, typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";
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
      <h1>Framer</h1>
      <h3>Gate anything with Farcaster Frames</h3>
      <div className="mt-8">
        <SignInButton onSuccess={handleSuccess} hideSignOut />
      </div>
    </div>
  );
}
