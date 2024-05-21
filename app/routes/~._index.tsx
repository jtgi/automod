/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { PlanType, userPlans } from "~/lib/auth.server";
import { Alert } from "~/components/ui/alert";
import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogDescription,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });

  const channels = await db.moderatedChannel.findMany({
    where: {
      OR: [
        {
          roles: {
            some: {
              permissions: {
                contains: `automod:*`,
              },
              delegates: {
                some: {
                  fid: user.id,
                },
              },
            },
          },
        },
        {
          userId: user.id,
        },
      ],
    },
    include: {
      ruleSets: true,
    },
  });

  const createdChannels = channels.filter((channel) => channel.userId === user.id).length;
  const usage = await db.usage.findFirst({
    where: {
      userId: user.id,
    },
  });

  return typedjson({
    user,
    channels,
    usage,
    createdChannels,
    plans: userPlans,
    env: getSharedEnv(),
  });
}

export default function FrameConfig() {
  const { channels, user, usage, createdChannels, plans } = useTypedLoaderData<typeof loader>();

  const plan = plans[user.plan as PlanType];
  const isNearUsage = usage && usage.castsProcessed >= plan.maxCasts - plan.maxCasts * 0.15;
  const isOverUsage = usage && usage.castsProcessed >= plan.maxCasts;
  const isMaxChannels = createdChannels >= plan.maxChannels;

  return (
    <div className="space-y-4">
      {channels.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Creating a bot for your channel just takes a few seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link className="no-underline" to="/~/channels/new">
                + New Bot
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {channels.length > 0 && (
        <div className="space-y-12">
          {isNearUsage && !isOverUsage && (
            <Alert>
              <>
                <p>
                  You're nearing your monthly usage limit. Upgrade to{" "}
                  <a
                    href="https://hypersub.withfabric.xyz/collection/automod-prime-xn1rknylk4cg"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Prime
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://hypersub.withfabric.xyz/collection/automod-ultra-owcren2irlkw"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ultra
                  </a>{" "}
                  to avoid any disruptions.
                </p>
                <p>
                  If you have any questions, reach out to <a href="https://warpcast.com/jtgi">@jtgi</a>.
                </p>
              </>
            </Alert>
          )}

          {isOverUsage && (
            <Alert>
              <>
                <p>You're over your monthly usage limit. Moderation is currently paused.</p>
                <p>
                  Upgrade to{" "}
                  <a
                    href="https://hypersub.withfabric.xyz/collection/automod-prime-xn1rknylk4cg"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Prime
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://hypersub.withfabric.xyz/collection/automod-ultra-owcren2irlkw"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ultra
                  </a>
                  . If you have any questions, reach out to <a href="https://warpcast.com/jtgi">@jtgi</a>.
                </p>
              </>
            </Alert>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2>Bots</h2>
              {isMaxChannels ? (
                <Dialog>
                  <DialogTrigger>
                    <Button>+ New Bot</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Damn, you're a power user.</DialogTitle>
                      <DialogDescription>
                        The maximum number of bots for the {user.plan} plan is {plan.maxChannels}.
                      </DialogDescription>
                      {user.plan === "basic" ? (
                        <>
                          <p>You can upgrade on hypersub.</p>
                          <Button asChild>
                            <Link className="no-underline" to="/TODO">
                              Upgrade to Power Plan ($9.69/mo)
                            </Link>
                          </Button>
                          <Button asChild>
                            <Link className="no-underline" to="/TODO">
                              Upgrade to Ultra Plan ($29.69/mo)
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <p>
                          Reach out to <a href="https://warpcast.com/jtgi">@jtgi</a> to upgrade
                        </p>
                      )}
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button asChild>
                  <Link className="no-underline" to="/~/channels/new">
                    + New Bot
                  </Link>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {channels.map((channel) => (
                <Link
                  to={`/~/channels/${channel.id}`}
                  className="no-underline"
                  key={channel.id}
                  prefetch="intent"
                >
                  <div className="flex gap-2 rounded-lg p-4 shadow border hover:border-orange-200 hover:shadow-orange-200 transition-all duration-300">
                    <img
                      src={channel.imageUrl ?? undefined}
                      alt={channel.id}
                      className="h-12 w-12 rounded-full block"
                    />
                    <div className="w-full overflow-hidden">
                      <h3
                        title={channel.id}
                        className=" text-ellipsis whitespace-nowrap overflow-hidden"
                        style={{ fontFamily: "Kode Mono" }}
                      >
                        /{channel.id}
                      </h3>
                      <div className="flex w-full justify-between">
                        <p className="text-sm text-gray-400">
                          {channel.ruleSets.length === 0 ? (
                            "No rules yet."
                          ) : (
                            <>
                              {channel.ruleSets.length} {channel.ruleSets.length === 1 ? "rule" : "rules"}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function CopyButton({ frame, env }: { frame: { slug: string }; env: { hostUrl: string } }) {
  const { copy, copied } = useClipboard();

  return (
    <Button
      className="w-[100px]"
      size={"sm"}
      variant={"outline"}
      onClick={() => copy(`${env.hostUrl}/${frame.slug}`)}
    >
      {copied ? "Copied!" : "Copy URL"}
    </Button>
  );
}
