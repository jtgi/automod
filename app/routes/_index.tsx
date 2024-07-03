import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { ClientOnly } from "remix-utils/client-only";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart,
  Bot,
  Check,
  DollarSign,
  FileSearch,
  Globe,
  HeartHandshake,
  Lightbulb,
  Loader2,
  LucideProps,
  Merge,
  Plug,
  Receipt,
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
import { Container } from "~/components/container";
import { MarketingPage } from "~/components/marketing";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { User } from "@prisma/client";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";

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
      <main className="w-full h-full">
        <div
          style={{
            backgroundImage:
              "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
          }}
        >
          <div className="relative flex flex-col items-center justify-center space-y-8 bg-gray-100 pb-0 shadow-[inset_0_-100px_1000px_rgba(0,0,0,0.1)]">
            <nav className="left-0 top-0 flex w-full items-center justify-between p-4 pb-0 pl-6 sm:absolute sm:p-6"></nav>
          </div>

          {/* hero */}
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center space-y-8 p-7 pb-20">
            <h1 className="text-2xl logo text-white">automod</h1>
            <h1
              className="text-center text-3xl sm:text-5xl sm:leading-[70px] text-white tracking-tighter leading-1"
              style={{
                fontFamily: "Kode Mono",
              }}
            >
              Power tools for Farcaster channels.
            </h1>
            <p className="text-center text-2xl tracking-tight text-white opacity-80">
              Curate, monetize, and reward your channel on Farcaster.
            </p>

            <div className="flex flex-col items-center justify-center space-y-2">
              <LoginButton user={user} error={error} env={env} />

              <small className="text-xs text-gray-400">(free to try; no credit cards, no bs)</small>
            </div>

            <section className="flex flex-col items-center mt-8">
              <p className="mb-2 text-white">
                Used by 100's of beloved <FarcasterIcon className="-mt-[2px] inline w-4 h-4 text-white" />{" "}
                channels
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
              <p className="text-xs text-white opacity-60 mt-2">Over 1 million automated actions taken</p>
            </section>
          </div>
        </div>

        {/* demo video */}
        <div className="bg-gray-50 p-7 py-24 sm:px-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-center space-y-6 ">
            <p className="w-full text-3xl">How it Works</p>
            <iframe
              className="h-full min-h-[300px] w-full rounded-lg sm:min-h-[500px]"
              src="https://www.youtube.com/embed/W8Hgz5Rd-B8?si=ZdQibh7ljDYwPH_i&amp;color=white"
              title="Divide Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </div>

        <div
          className="sm:px-8 h-full w-full flex flex-col items-center justify-center min-h-screen relative"
          style={{
            background:
              "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
          }}
        >
          <Button variant={"ghost"} className="absolute top-2 right-2">
            <Link to="/~" className="no-underline">
              Login
            </Link>
          </Button>
          <div className="max-w-4xl w-full mt-12 p-8 shadow-xl rounded-3xl space-y-8">
            <section>
              <h1 className="text-center text-4xl logo mt-4 mb-4 text-white drop-shadow-md">automod</h1>
              <div className="flex flex-col items-center max-w-xl mx-auto">
                <h2 className="text-4xl sm:text-5xl font-black mb-1 text-center text-white">
                  Powerful channel tools for Farcaster communities.
                  <br />
                </h2>
                <h3 className="text-2xl text-black/50 text-center">Zero code required.</h3>
              </div>
            </section>

            <LoginButton user={user} error={error} env={env} />

            <div className="py-8">
              <hr />
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-center">Reward real fans, not a bunch of bots.</h2>
                <p className="text-xl text-center text-gray-500">
                  15+ gating options to make sure your campaigns go to the right people.
                </p>
              </div>

              <div className="space-y-2 grid grid-cols-1 w-full">
                {[
                  "Require holding ERC-721, ERC-1155, or ERC-20 tokens.",
                  "Require accounts be Active Status, Top Casters, or have a low fid.",
                  "Require like, recast, or follow any account",
                  "Require users to follow any channel",
                ].map((benefit, index) => (
                  <div key={index} className="flex mx-auto gap-2 align-top">
                    <Check className="shrink-0 text-green-500" />
                    <p>{benefit}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-gray-500">Mix and match any requirements together</p>
            </div>

            <div className="py-8">
              <hr />
            </div>

            <div className="space-y-6">
              <div className="sm:px-8">
                <h2 className="text-3xl font-bold text-center">Limit your channels to</h2>
                <p className="text-center text-gray-500">
                  Distribute redemption codes for use with providers like Stripe, Shopify, Wix and just about
                  everywhere else.
                </p>
                <img src="/codes1.png" alt="Redemption codes" className="mx-auto" />
              </div>

              <div className="space-y-2 grid grid-cols-1 w-full">
                <h4 className="text-center font-bold">Real World Examples</h4>
                {[
                  "Run a secure, onframe mint with Manifold",
                  "Give free shipping to followers on your Shopify store",
                  "Give a one month free trial on your saas product",
                ].map((benefit, index) => (
                  <div key={index} className="flex mx-auto gap-2 align-top">
                    <Lightbulb className="text-yellow-500 w-5 h-5" />
                    <p>{benefit}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-gray-500">
                Integrate with any provider that supports coupon or promotion codes.
              </p>
            </div>

            <div className="py-8">
              <hr />
            </div>

            <div>
              <h2 className="text-3xl font-bold text-center">Start now.</h2>
              <p className="text-center text-gray-500">$6.99 / month. Cancel anytime.</p>
            </div>

            <div className="pt-2 flex flex-col justify-center space-y-2 pb-20">
              <Button asChild className="w-full sm:w-auto">
                <Link
                  className="no-underline"
                  to="https://buy.stripe.com/00g29J5ex2AB4A8fYY"
                  target="_blank"
                  rel="noreferrer"
                >
                  Order with Credit Card <ArrowTopRightIcon className="ml-1" />
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link
                  className="no-underline"
                  to="https://checkout.loopcrypto.xyz/eef429bc-2e43-4b8a-8f7d-f8d67f6c67ab/92c043a0-9483-4c40-8d5e-8c0d5211f47a"
                  target="_blank"
                  rel="noreferrer"
                >
                  Order with Crypto <ArrowTopRightIcon className="ml-1" />
                </Link>
              </Button>
            </div>

            <footer className="text-center text-sm text-gray-500 py-12 flex items-center gap-8 justify-between">
              <p>
                glass by <a href="https://warpcast.com/jtgi">jtgi</a>
              </p>
              <p className="flex items-center gap-4">
                <a href="mailto:help@glass.cx" className="no-underline">
                  Support
                </a>
                <Link to="/x/disclosure" className="no-underline">
                  Disclosure
                </Link>
                <Link to="/x/privacy" className="no-underline">
                  Privacy
                </Link>
                <Link to="x/tos" className="no-underline">
                  Terms of Service
                </Link>
              </p>
            </footer>
          </div>
        </div>

        {/* features */}
        <div className="space-y-20 p-7 py-24 sm:px-12">
          <div className="justify-left mx-auto flex max-w-5xl flex-col items-center space-y-6">
            <p className="mb-8 w-full text-xl font-bold">Features</p>
            <div className="grid grid-cols-1 gap-14 gap-y-12 sm:grid-cols-2 sm:gap-12">
              <FeatureCard
                Icon={BadgeDollarSign}
                title="Token gate your channel"
                description="Full support for ERC-721, ERC-1155, and ERC-20 tokens across all major networks."
              />
              <FeatureCard
                Icon={Plug}
                title="Farcaster native integrations"
                description="Support for Hypersub, Paragraph, OpenRank, Warpcast and more."
              />
              <FeatureCard
                Icon={Bot}
                title="Put your moderation on autopilot"
                description="20+ composable rules to automatically filter out and promote meaningful content in your channel."
              />
              <FeatureCard
                Icon={Users}
                title="Role based moderation"
                description="Allow community members to take on moderation responsibilities by creating roles with just the right amount of permissions."
              />
              <FeatureCard
                Icon={FileSearch}
                title="Full Activity Log"
                description="Any action taken by automod is available in the Activity Log."
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
                description="Automod is a usage based pricing model. You only pay for what you use."
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2">
            <LoginButton user={user} error={error} env={env} />
            <small className="text-xs text-gray-400">
              (free to try; no credit cards, no downloads, no bs)
            </small>
          </div>
        </div>

        {/* footer */}

        <footer className="text-center text-xs py-12 flex items-center gap-8 justify-between">
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
      </main>

      <div
        className="h-full w-full flex flex-col items-center justify-center min-h-screen"
        style={{
          backgroundImage:
            "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
        }}
      >
        <div className="max-w-xl flex flex-col justify-center items-center gap-8">
          <div className="flex flex-col items-center">
            <Link to="/~" className="no-underline"></Link>
          </div>

          <Container className="pb-16 text-center">
            <h1 className="mb-4 text-3xl logo text-white opacity-80">automod</h1>
            <h1 className="mx-auto max-w-4xl font-display text-3xl font-medium tracking-tight sm:text-5xl text-white">
              Powerful channel tools for communities.
            </h1>

            <div className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-white"></div>
          </Container>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cardData.map((card, index) => (
              <div key={index} className="rounded-lg bg-white/10 p-8">
                <h2 className="text-white/80 text-lg font-bold">{card.title}</h2>
                <p className="text-white/60 mt-2">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    <div className="flex flex-row items-center justify-normal gap-x-4 space-y-2 sm:text-left">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-gray-100">
        <props.Icon className="h-8 w-8" />
      </div>
      <div>
        <p className="font-semibold">{props.title}</p>
        <p className="text-gray-500">{props.description}</p>
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
