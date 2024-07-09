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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

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

  return typedjson({
    env: getSharedEnv(),
    user,
    invite,
    error,
    activeChannels,
  });
}

export default function Home() {
  const { user, env, error, activeChannels } = useTypedLoaderData<typeof loader>();
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

  return (
    <main
      className="w-full h-full relative"
      style={{
        backgroundImage:
          "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
      }}
    >
      <div className="w-full h-full z-10 relative">
        {/* hero */}
        <div className="flex flex-col items-center justify-center space-y-6 p-7 pb-10 pt-20">
          <section className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl logo text-white mb-4">automod</h1>
            <div className="py-4 sm:py-8">
              <h1
                className="text-center text-5xl sm:text-6xl text-[#f9ffd9] tracking-tighter leading-1"
                style={{
                  fontFamily: "Rubik",
                  fontWeight: 700,
                }}
              >
                Put your channel on autopilot.
              </h1>
              <p className="text-white/80 text-md sm:text-xl mt-2 max-w-2xl mx-auto">
                Choose from 25+ composable rules to automatically curate meaningful content in your channel.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <LoginButton user={user} error={error} env={env} />
            </div>

            <section className="flex flex-col items-center mt-12">
              <p className="mb-2 text-[#f9ffd9]/80 text-xs">
                Used by hundreds of beloved{" "}
                <FarcasterIcon className="-mt-[2px] inline w-3 h-3 text-white/80" /> channels
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
            </section>
          </section>
        </div>

        <div className="p-7 sm:px-12">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full max-w-3xl mx-auto h-full object-cover border-slate-700/80 border-[10px] rounded-[20px] shadow-lg"
            src="/videos/automod-demo-complete.mp4"
            controls
          />
        </div>

        {/* features */}
        <div className="p-7 pt-8 pb-24 sm:px-12">
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
          <div className="pt-16">
            <LoginButton user={user} error={error} env={env} />
          </div>
        </div>

        {/* <div className="py-7 max-w-5xl mx-auto">
          <PricingTable />
        </div> */}

        {/* footer */}

        <footer
          className="p-7 text-xs py-12 w-full"
          style={{
            backgroundImage:
              "radial-gradient( circle farthest-corner at 10% 20%,  rgba(10,3,32,0.87) 20.8%, rgba(10,10,35,0.84) 74.4% )",
          }}
        >
          <div className="max-w-5xl mx-auto flex justify-between">
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
            <p style={{ fontFamily: "Kode Mono" }} className="text-white/20">
              made in tokyo
            </p>
          </div>
        </footer>
      </div>
      <FarcasterIcon className="w-screen h-screen absolute -top-12 left-0 opacity-5 mix-blend-multiply" />
    </main>
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
    <section className="flex flex-col items-center mt-8 w-full">
      {error && (
        <Alert className="mb-8" variant="destructive">
          {error}
        </Alert>
      )}

      {user ? (
        <Button
          asChild
          className="no-underline relative w-full sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
          variant={"outline"}
        >
          <Link to="/~" className="w-full">
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
                      className="relative w-full min-w-[250px] sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
                      variant={"outline"}
                    >
                      {loggingIn ? (
                        <Loader2 className="animate-spin h-4 w-4" />
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

// function PricingTable() {
//   const frequencies = [
//     { value: "monthly", label: "Monthly", priceSuffix: "/month" },
//     { value: "annually", label: "Annually", priceSuffix: "/year" },
//   ];
//   const tiers = [
//     {
//       name: "Basic",
//       id: "tier-freelancer",
//       href: "#",
//       price: { monthly: "FREE", annually: "FREE" },
//       description: "The essentials to provide your best work for clients.",
//       features: ["Process 3000 casts", "Up to 3 channels", "Basic analytics", "1 Moderator Role"],
//       mostPopular: false,
//     },
//     {
//       name: "Prime",
//       id: "tier-startup",
//       href: "#",
//       price: { monthly: "$14.99", annually: "$179.88" },
//       description: "A plan that scales with your rapidly growing channel.",
//       features: ["Process 25,000 casts", "Up to 5 channels", "Webhooks", "Unlimited Moderator Roles"],
//       mostPopular: false,
//     },
//     {
//       name: "Ultra",
//       id: "tier-enterprise",
//       href: "#",
//       price: { monthly: "$39.99", annually: "$479.99" },
//       description: "Channels at scale",
//       features: [
//         "Process 250,000 casts",
//         "Unlimited channels",
//         "Priority Support",
//         "Automod Team Support",
//         "Unlimited Moderator Roles",
//         "Webhooks",
//       ],
//       mostPopular: false,
//     },
//   ];

//   const [frequency, setFrequency] = useState(frequencies[0]);

//   return (
//     <div className="bg-white py-24 sm:py-32">
//       <div className="mx-auto max-w-7xl px-6 lg:px-8">
//         <div className="mx-auto max-w-4xl text-center">
//           <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
//           <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
//             Pricing plans for teams of&nbsp;all&nbsp;sizes
//           </p>
//         </div>
//         <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
//           Choose an affordable plan that’s packed with the best features for engaging your audience, creating
//           customer loyalty, and driving sales.
//         </p>
//         <div className="mt-16 flex justify-center">
//           <fieldset aria-label="Payment frequency">
//             <RadioGroup
//               value={frequency.value}
//               onValueChange={(value) => setFrequency(frequencies.find((f) => f.value === value)!)}
//               className="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs font-semibold leading-5 ring-1 ring-inset ring-gray-200"
//             >
//               {frequencies.map((option) => (
//                 <RadioGroupItem
//                   key={option.value}
//                   value={option.value}
//                   className="cursor-pointer rounded-full px-2.5 py-1 text-gray-500 data-[checked]:bg-indigo-600 data-[checked]:text-white"
//                 >
//                   {option.label}
//                 </RadioGroupItem>
//               ))}
//             </RadioGroup>
//           </fieldset>
//         </div>
//         <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
//           {tiers.map((tier) => (
//             <div
//               key={tier.id}
//               className={cn(
//                 tier.mostPopular ? "ring-2 ring-indigo-600" : "ring-1 ring-gray-200",
//                 "rounded-3xl p-8 xl:p-10"
//               )}
//             >
//               <div className="flex items-center justify-between gap-x-4">
//                 <h3
//                   id={tier.id}
//                   className={cn(
//                     tier.mostPopular ? "text-indigo-600" : "text-gray-900",
//                     "text-lg font-semibold leading-8"
//                   )}
//                 >
//                   {tier.name}
//                 </h3>
//                 {tier.mostPopular ? (
//                   <p className="rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-indigo-600">
//                     Most popular
//                   </p>
//                 ) : null}
//               </div>
//               <p className="mt-4 text-sm leading-6 text-gray-600">{tier.description}</p>
//               <p className="mt-6 flex items-baseline gap-x-1">
//                 <span className="text-4xl font-bold tracking-tight text-gray-900">
//                   {tier.price[frequency.value]}
//                 </span>
//                 <span className="text-sm font-semibold leading-6 text-gray-600">{frequency.priceSuffix}</span>
//               </p>
//               <a
//                 href={tier.href}
//                 aria-describedby={tier.id}
//                 className={cn(
//                   tier.mostPopular
//                     ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"
//                     : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
//                   "mt-6 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
//                 )}
//               >
//                 Buy plan
//               </a>
//               <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600 xl:mt-10">
//                 {tier.features.map((feature) => (
//                   <li key={feature} className="flex gap-x-3">
//                     <Check aria-hidden="true" className="h-6 w-5 flex-none text-indigo-600" />
//                     {feature}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }
