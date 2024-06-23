import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { ClientOnly } from "remix-utils/client-only";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { ArrowRight, ArrowUpRight, Loader2, Zap } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/lib/auth.server";
import { getSharedEnv } from "~/lib/utils.server";
import { Farcaster } from "~/components/icons/farcaster";
import { useCallback, useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { FarcasterIcon } from "~/components/FarcasterIcon";

// export meta
export const meta: MetaFunction<typeof loader> = (data) => {
  return [
    { title: "automod" },
    {
      property: "og:title",
      content: "automod",
    },
    {
      name: "description",
      content: "Automate channel spam with bots",
    },
    {
      name: "fc:frame",
      content: "vNext",
    },
    {
      name: "og:image",
      content: `${data.data.env.hostUrl}/preview.png`,
    },
  ];
};

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

  const [activeChannels, totalChannels, totalModerationActions] = await Promise.all([
    db.moderatedChannel.findMany({
      select: {
        id: true,
        imageUrl: true,
        _count: {
          select: {
            moderationLogs: true,
          },
        },
      },
      where: {
        id: {
          in: [
            "samantha",
            "base",
            "coop-recs",
            "rainbow",
            "seaport",
            "farcasther",
            "degen",
            "fitness",
            "higher",
            "zk",
            "replyguys",
            "ogs",
            "wake",
          ],
        },
      },
      orderBy: {
        moderationLogs: {
          _count: "desc",
        },
      },
      take: 10,
    }),
    db.moderatedChannel.count({
      where: {
        active: true,
        moderationLogs: {
          some: {},
        },
      },
    }),
    db.moderationLog.count({}),
  ]);

  const user = await authenticator.isAuthenticated(request);

  return typedjson(
    {
      env: getSharedEnv(),
      user,
      invite,
      error,
      activeChannels,
      totalChannels,
      totalModerationActions,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${60 * 60 * 24}`,
      },
    }
  );
}

export default function Home() {
  const { user, env, error, invite, totalChannels, activeChannels, totalModerationActions } =
    useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);
  const coin = useRef<HTMLAudioElement>();

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  const handleSuccess = useCallback((res: StatusAPIResponse) => {
    setLoggingIn(true);
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

  useEffect(() => {
    if (!coin.current) {
      coin.current = new Audio("/1up.wav");
    }
    const audio = coin.current;
    audio.preload = "auto";
    audio.load();
  }, []);

  const playSound = () => {
    // Clone the audio node and play it
    const audioClone = coin.current?.cloneNode() as HTMLAudioElement;
    audioClone.play().catch((error) => console.error("Error playing the sound:", error));
  };

  return (
    <AuthKitProvider config={farcasterConfig}>
      <div
        className="h-full w-full flex flex-col items-center justify-center min-h-screen"
        style={{
          backgroundImage:
            "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
        }}
      >
        <div className="max-w-xl flex flex-col justify-center items-center gap-8">
          <div className="flex flex-col items-center">
            <Link to="/~" className="no-underline">
              <h1 className="text-6xl logo text-white opacity-80">automod</h1>
            </Link>
            <h2 className="font-normal mb-8 opacity-50 text-white">Enforce channel norms with bots</h2>
          </div>

          {error && (
            <Alert className="mb-8" variant="destructive">
              {error}
            </Alert>
          )}

          {user ? (
            <Button
              asChild
              className="no-underline relative w-full sm:w-[250px] text-white/80 hover:text-white/100 active:translate-y-[2px] bg-primary/80 hover:bg-primary transition-all duration-100"
              variant={"outline"}
            >
              <Link to="/~">
                Go to App <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <>
              <div>
                <ClientOnly>
                  {() => {
                    return (
                      <Button
                        className="relative w-full sm:w-[250px] text-white/80 hover:text-white/100 active:translate-y-[2px] bg-primary/80 hover:bg-primary transition-all duration-100"
                        variant={"outline"}
                      >
                        {loggingIn ? (
                          <Loader2 className=" animate-spin h-4 w-4" />
                        ) : (
                          <>
                            <Farcaster className="mr-2 h-5 w-5" />
                            <span>Login with Farcaster</span>
                            <div id="fc-btn-wrap" className="absolute">
                              <SignInButton onSuccess={handleSuccess} />
                            </div>
                          </>
                        )}
                      </Button>
                    );
                  }}
                </ClientOnly>
              </div>

              <section className="flex flex-col items-center mt-8">
                <p className="mb-2 text-xs text-white opacity-60">
                  Used by beloved <FarcasterIcon className="-mt-[2px] inline w-3 h-3 text-white" /> channels
                </p>
                <div className="flex -space-x-1">
                  {activeChannels
                    .filter((c) => !!c.imageUrl)
                    .map((channel, index) => {
                      return (
                        <Popover key={channel.id}>
                          <PopoverTrigger
                            className="hover:-translate-y-1 transition-all duration-400 z-auto"
                            onMouseEnter={playSound}
                            style={{
                              zIndex: index,
                            }}
                            onClick={playSound}
                          >
                            <img
                              key={channel.id}
                              src={channel.imageUrl ?? undefined}
                              className="inline-block shrink-0 h-6 w-6 rounded-full ring-2 ring-white"
                            />
                          </PopoverTrigger>
                          <PopoverContent className="flex gap-1 p-1 pr-4 rounded-full items-center w-auto">
                            <img
                              src={channel.imageUrl ?? undefined}
                              className="h-8 w-8 rounded-full block flex-1"
                            />
                            <div>
                              <h3 className="text-sm font-bold font-mono" style={{ fontFamily: "Kode Mono" }}>
                                /{channel.id}
                              </h3>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                </div>
                <p className="text-xs text-white opacity-60 mt-2">
                  {totalModerationActions.toLocaleString()} automated actions taken
                </p>
              </section>

              <footer className="absolute bottom-5 text-center text-xs py-12 flex items-center gap-8 justify-between">
                <p className="flex items-center gap-4">
                  <Link to="/disclosure" className="text-white/20 no-underline">
                    Disclosure
                  </Link>
                  <Link to="/privacy" className="text-white/20 no-underline">
                    Privacy
                  </Link>
                  <Link to="/tos" className="text-white/20 no-underline">
                    Terms
                  </Link>
                </p>
              </footer>
            </>
          )}
        </div>
      </div>
    </AuthKitProvider>
  );
}
