import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { ClientOnly } from "remix-utils/client-only";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart,
  Bot,
  DollarSign,
  HeartHandshake,
  Loader2,
  Plug,
  Users,
} from "lucide-react";
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
import { User } from "@prisma/client";
import { MagicWandIcon } from "@radix-ui/react-icons";

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

  const [activeChannels] = await Promise.all([
    db.moderatedChannel.findMany({
      select: {
        id: true,
        imageUrl: true,
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
      take: 10,
    }),
  ]);

  const user = await authenticator.isAuthenticated(request);

  return typedjson(
    {
      env: getSharedEnv(),
      user,
      invite,
      error,
      activeChannels,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${60 * 60 * 24}`,
      },
    }
  );
}

export default function Home() {
  const { user, env, error, invite, activeChannels } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const coin = useRef<HTMLAudioElement>();

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

  const cardData = [
    {
      title: "Automated Moderation",
      description:
        "Moderate your channel feed with over 20 different composable rules. Block spam, boost token holders, and more.",
    },
    {
      title: "Farcaster Native Integrations",
      description: "Integrate with your favorite tools like Hypersub, Paragraph, OpenRank and more.",
    },
    {
      title: "Real-time Insights",
      description: "Get real-time insights into your community with detailed analytics.",
    },
    {
      title: "Easy to Use",
      description: "Get started in minutes with our easy-to-use dashboard.",
    },
  ];

  return (
    <>
      <main
        className="w-full h-full"
        style={{
          backgroundImage:
            "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
        }}
      >
        {/* hero */}
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center space-y-6 p-7 pb-20 pt-20">
          <section className="text-center">
            <h1 className="text-3xl logo text-white mb-4">automod</h1>
            <h1
              className="text-center text-5xl sm:text-5xl text-[#f9ffd9] tracking-tighter leading-1"
              style={{
                fontFamily: "Kode Mono",
              }}
            >
              Channel moderation on autopilot.
            </h1>
            <p className="text-white/80 text-lg sm:text-xl mt-4">
              Managing channels is too much work. With automod you decide who and what shows up in your
              channel and let automation take care of the rest.
            </p>

            <div className="flex flex-col items-center justify-center space-y-2">
              <LoginButton user={user} error={error} env={env} />
            </div>

            <section className="flex flex-col items-center mt-8">
              <p className="mb-2 text-white">
                Used by hundreds of beloved <FarcasterIcon className="-mt-[2px] inline w-4 h-4 text-white" />{" "}
                channels
              </p>
              <div className="flex -space-x-1">
                {activeChannels
                  // .filter((c) => !!c.imageUrl)
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
                            className="inline-block shrink-0 h-8 w-8 rounded-full ring-2 ring-white"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="flex gap-1 p-1 pr-4 rounded-full items-center w-auto">
                          <img
                            src={channel.imageUrl ?? "/icons/automod.png"}
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
              <p className="text-xs text-[#f9ffd9] opacity-60 mt-2">Over 1 million automated actions taken</p>
            </section>
          </section>
        </div>

        {/* <video
          className="w-full rounded-lg shadow-md mx-auto max-w-[600px]"
          autoPlay
          loop
          muted
          playsInline
          src="/videos/automod-rules-demo.mp4"
        /> */}

        <div className="py-4 px-8">
          <hr className="border-white/10" />
        </div>

        {/* features */}
        <div className="space-y-20 p-7 py-24 sm:px-12">
          <div className="justify-left mx-auto flex max-w-5xl flex-col items-center space-y-6">
            <div className="grid grid-cols-1 gap-14 gap-y-12 sm:grid-cols-2 sm:gap-12">
              <FeatureCard
                Icon={BadgeDollarSign}
                title="Token gate your channel"
                description="Full support for ERC-721, ERC-1155, and ERC-20 tokens across all major networks."
              />
              <FeatureCard
                Icon={Bot}
                title="Fully customizable moderation rules"
                description="25+ composable rules to automatically filter out and promote meaningful content in your channel."
              />
              <FeatureCard
                Icon={Users}
                title="Team based moderation"
                description="Distribute work between teammates and community members with Moderation Roles."
              />
              <FeatureCard
                Icon={MagicWandIcon}
                title="Moderate directly in Warpcast"
                description="Use cast actions to ban, hide, curate, or whitelist any account, directly in Warpcast."
              />
              <FeatureCard
                Icon={Plug}
                title="Farcaster native integrations"
                description="Support for Hypersub, Paragraph, OpenRank, Warpcast and more."
              />
              <FeatureCard
                Icon={HeartHandshake}
                title="Collaborate with Teams"
                description="Grant your teammates access to your channel and work together to moderate your community."
              />
              <FeatureCard
                Icon={BarChart}
                title="Measure your success"
                description="Real time analytics to help you understand how your community is growing and how your moderation is performing."
              />
              <FeatureCard
                Icon={DollarSign}
                title="Generous pricing"
                description="Automod has a generous free tier fit for 90% of channels on Farcaster."
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2">
            <LoginButton user={user} error={error} env={env} />
          </div>
        </div>

        {/* footer */}

        <footer className="p-7 max-w-5xl mx-auto text-center text-xs py-12 flex items-center gap-8 justify-between">
          <p className="flex items-center gap-4">
            <Link to="/disclosure" className="text-white/40 no-underline">
              Disclosure
            </Link>
            <Link to="/privacy" className="text-white/40 no-underline">
              Privacy
            </Link>
            <Link to="/tos" className="text-white/40 no-underline">
              Terms
            </Link>
          </p>
        </footer>
      </main>
    </>
  );
}

function FeatureCard(props: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-start justify-normal gap-x-4 space-y-2 sm:text-left text-[#f9ffd9]">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-orange-100/20">
        <props.Icon className="h-8 w-8" />
      </div>
      <div>
        <p className="font-semibold text-white">{props.title}</p>
        <p className="text-[#f9ffd9]/60">{props.description}</p>
      </div>
    </div>
  );
}

function LoginButton(props: {
  user: User | null;
  error: string | null;
  env: ReturnType<typeof getSharedEnv>;
}) {
  const { user, error, env } = props;
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

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

    navigate(`/auth/farcaster?${params}`, {
      replace: true,
    });
  }, []);

  return (
    <section className="flex flex-col items-center mt-8">
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
            Use Automod <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      ) : (
        <>
          <div>
            <ClientOnly>
              {() => {
                return (
                  <AuthKitProvider config={farcasterConfig}>
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
                          <div id="fc-btn-wrap" className="absolute w-full sm:w-[250px]">
                            <SignInButton onSuccess={handleSuccess} />
                          </div>
                        </>
                      )}
                    </Button>
                  </AuthKitProvider>
                );
              }}
            </ClientOnly>
          </div>
        </>
      )}
    </section>
  );
}
