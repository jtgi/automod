import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return await authenticator.authenticate("farcaster", request, {
    successRedirect: "/~",
    failureRedirect: "/login?error=no-access",
  });
}

export default function Screen() {
  return (
    <div className="flex h-screen flex-row items-center justify-center">
      Whops! You should have already been redirected.
    </div>
  );
}
