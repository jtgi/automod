/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { db } from "~/lib/db.server";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser, successResponse } from "~/lib/utils.server";
import { Form, Link, useFetcher } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { PlanType, getSubscriptionPlan, refreshAccountStatus, userPlans } from "~/lib/auth.server";
import { Alert } from "~/components/ui/alert";
import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogDescription,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { ArrowUpRight, RefreshCwIcon } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });

  const channels = await db.moderatedChannel.findMany({
    where: {
      OR: [
        {
          comods: {
            some: {
              fid: user.id,
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
      comods: true,
    },
  });

  const createdChannels = channels.filter((channel) => channel.userId === user.id).length;
  const usages = await db.usage.findMany({
    where: {
      userId: user.id,
    },
  });
  const totalCastsProcessed = usages.reduce((acc, usage) => acc + usage.castsProcessed, 0);

  return typedjson({
    user,
    channels,
    usages,
    totalCastsProcessed,
    createdChannels,
    plans: userPlans,
    env: getSharedEnv(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "checkAccountStatus") {
    const plan = await refreshAccountStatus({ fid: user.id });
    return successResponse({
      request,
      message: `Refreshed! You are on the ${plan.plan} plan.`,
    });
  }

  return typedjson({ success: true });
}

export default function FrameConfig() {
  const { channels, user, totalCastsProcessed, createdChannels, plans } = useTypedLoaderData<typeof loader>();

  const plan = plans[user.plan as PlanType];
  const isNearUsage = totalCastsProcessed >= plan.maxCasts - plan.maxCasts * 0.15;
  const isOverUsage = totalCastsProcessed >= plan.maxCasts;
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
                <p className="font-semibold">You're nearing your monthly usage limit.</p>
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
                  </a>{" "}
                  to avoid any disruptions.
                </p>
                <p>
                  If you have any questions, reach out to <a href="https://warpcast.com/jtgi">@jtgi</a>.
                </p>
                <div className="py-2">
                  <hr />
                </div>
                <RefreshAccountButton />
              </>
            </Alert>
          )}

          {isOverUsage && (
            <Alert>
              <>
                <p className="font-semibold">You're over your monthly usage limit.</p>
                <p>
                  Automated moderation is currently paused. Upgrade to{" "}
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
                  .
                </p>
                <p>
                  If you have any questions, reach out to <a href="https://warpcast.com/jtgi">@jtgi</a>.
                </p>
                <div className="py-2">
                  <hr />
                </div>
                <RefreshAccountButton />
              </>
            </Alert>
          )}
          {/* 
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-normal">Casts Processed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCastsProcessed.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">/ {plan.maxCasts.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-normal">Channels Created</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {createdChannels} / {plan.maxChannels === Infinity ? "Infinity" : plan.maxChannels}
                </div>
              </CardContent>
            </Card>
          </section> */}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2>Bots</h2>
              {isMaxChannels || true ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>+ New Bot</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Damn, you're a power user.</DialogTitle>
                      <DialogDescription>
                        The maximum number of bots for the {user.plan} plan is {plan.maxChannels}.
                      </DialogDescription>
                      {user.plan === "basic" || true ? (
                        <div className="py-4 w-full flex flex-col gap-2">
                          <Button asChild>
                            <Link
                              target="_blank"
                              className="no-underline"
                              to="https://hypersub.withfabric.xyz/collection/automod-prime-xn1rknylk4cg"
                              rel="noreferrer"
                            >
                              Prime (5 channels, $7.77/mo)
                            </Link>
                          </Button>
                          <Button asChild>
                            <Link
                              target="_blank"
                              className="no-underline"
                              to="https://hypersub.withfabric.xyz/collection/automod-ultra-owcren2irlkw"
                              rel="noreferrer"
                            >
                              Ultra (Unlimited Channels, $23/mo)
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <p>
                          Reach out to <a href="https://warpcast.com/jtgi">@jtgi</a> to upgrade
                        </p>
                      )}
                    </DialogHeader>
                    <DialogFooter>
                      <div className="flex justify-center text-sm border-t gap-2 items-center w-full pt-4">
                        <p>Already upgraded?</p> <RefreshAccountButton />
                      </div>
                    </DialogFooter>
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

function RefreshAccountButton() {
  const fetcher = useFetcher();
  const loading = fetcher.state === "submitting";

  return (
    <fetcher.Form method="post">
      <Button
        disabled={loading}
        size="sm"
        variant={"secondary"}
        name="intent"
        value="checkAccountStatus"
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <RefreshCwIcon className="animate-spin w-3 h-3 mr-1" /> Refreshing...
          </>
        ) : (
          <>
            <RefreshCwIcon className="w-3 h-3 mr-1" /> Refresh Account Status
          </>
        )}
      </Button>
    </fetcher.Form>
  );
}
