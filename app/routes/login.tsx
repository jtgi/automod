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
        <h1 className="text-center text-5xl logo">glass</h1>
        <h2 className="text-center text-lg font-normal mb-4">
          Gate content with Farcaster Frames
        </h2>

        <video
          className="w-full my-4 rounded-lg shadow-md"
          autoPlay
          loop
          muted
          controls
          playsInline
          src="/demo-vid.mp4"
        />

        {/* play demo-vid.mp4 video here with autoplay */}

        <div className="space-y-4">
          <ul className="ml-4 list-outside list-disc space-y-2">
            <li>
              Create exclusive content for followers, ERC-20 and ERC-721 token
              holders.
            </li>
            <li>
              Boost engagement by requiring a post be liked, recasted, followed
              before visible.
            </li>
            <li>
              Reveal any text content, image, even other frames. (more soon)
            </li>
            <li>Zero code required.</li>
          </ul>

          <div className="pt-2 flex flex-col justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link
                className="no-underline"
                to="https://useglass.lemonsqueezy.com/checkout/buy/32a541af-4f35-4f7d-b1df-53d5a0ecb4ef"
                target="_blank"
                rel="noreferrer"
              >
                Preorder Now <ArrowTopRightIcon className="ml-1" />
              </Link>
            </Button>
            <span className="text-xs text-gray-500 block text-center mt-1">
              Limited quantity, ships early Feb
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
