import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { redirect } from "remix-typedjson";
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
  return (
    <div className="px-8 h-full w-full flex flex-col items-center justify-center min-h-screen">
      <div className="max-w-xl">
        <h1 className="text-6xl logo">glass</h1>
        <h2 className="font-normal mb-8">Gate content with Farcaster Frames</h2>

        <div className="space-y-4">
          <ul className="ml-4 list-outside list-disc space-y-2">
            <li>
              Create exclusive content for followers, ERC-20 and ERC-721 token
              holders. Require minimum token balances or even specific tokens.
            </li>
            <li>
              Boost engagement by requiring a post be liked, recasted, followed
              before visible.
            </li>
            <li>
              Reveal any text content, image, even other frames with more
              redemption formats coming soon.
            </li>
            <li>Zero code required.</li>
          </ul>

          <p className="text-xs text-gray-600 ml-4">
            Available on Mainnet, Base, Optimism, and Zora
          </p>

          <div className="pt-6">
            <Button asChild className="w-full sm:w-auto">
              <Link
                className="no-underline"
                to="https://useglass.lemonsqueezy.com/checkout/buy/32a541af-4f35-4f7d-b1df-53d5a0ecb4ef"
                target="_blank"
                rel="noreferrer"
              >
                Preorder <ArrowTopRightIcon className="ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
