import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import { Link, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";

export default function Marketing() {
  const location = useLocation();

  return (
    <div className="px-8 h-full w-full flex flex-col items-center justify-center min-h-screen">
      <div className="max-w-xl">
        {location.search.includes("error=invalid_invite_code") && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 my-8 rounded relative">
            <strong className="font-bold">
              Damn. That invite has expired.
              <br />
              Purchase the presale for priority access.
            </strong>
          </div>
        )}
        <h1 className="text-center text-5xl logo">glass</h1>
        <h2 className="text-center text-lg font-normal mb-4">
          Gate content with Farcaster Frames
        </h2>

        <video
          className="w-full my-4 rounded-lg shadow-md"
          autoPlay
          loop
          muted
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
              Boost engagement by requiring a post be liked, recasted, or
              followed.
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
