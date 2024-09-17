/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useFetcher } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button, ButtonProps } from "~/components/ui/button";
import { db } from "~/lib/db.server";
import { requireUser, successResponse } from "~/lib/utils.server";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ArrowUpRight, RefreshCwIcon, RocketIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { refreshAccountStatus } from "~/lib/subscription.server";
import { abbreviateNumber } from "js-abbreviation-number";
import { User } from "@prisma/client";
import { userPlans, PlanType, PlanDef } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const [usages, channels] = await Promise.all([
    db.usage.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        monthYear: "desc",
      },
    }),
    db.moderatedChannel.findMany({
      where: {
        userId: user.id,
      },
    }),
  ]);

  return typedjson({
    user,
    usages,
    channels,
    plans: userPlans,
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

export default function Screen() {
  const { user, usages, plans, channels } = useTypedLoaderData<typeof loader>();

  const plan = plans[user.plan as PlanType];
  const currentMonthPretty = new Date().toLocaleString("default", { month: "long" });
  const currentMonthYear = new Date().toISOString().substring(0, 7);
  const currentMonthUsage = usages.filter((usage) => usage.monthYear.includes(currentMonthYear));
  const currentMonthTotal = currentMonthUsage.reduce((acc, usage) => acc + usage.castsProcessed, 0);

  return (
    <div>
      <section className="flex flex-col sm:flex-row gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 items-center">
                <Avatar className="w-11 h-11 border-white border-5 shadow-md">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <CardTitle>@{user.name}</CardTitle>
                  <p className="text-[9px] text-gray-500">#{user.id}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table className="text-xs">
                <TableBody>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>{plan.displayName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Casts Processed</TableCell>
                    <TableCell>
                      {abbreviateNumber(currentMonthTotal, 0)} /{" "}
                      {plan.maxCasts === Infinity
                        ? Infinity.toLocaleString()
                        : abbreviateNumber(plan.maxCasts, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Channels</TableCell>
                    <TableCell>
                      {channels.length} / {plan.maxChannels.toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Expires</TableCell>
                    <TableCell>
                      {user.planExpiry ? new Date(user.planExpiry).toLocaleDateString() : Infinity.toString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {isOnStripe(user) ? (
                <Button asChild size={"xs"} variant={"outline"} className="w-full">
                  <Link
                    to="https://billing.stripe.com/p/login/fZeg1Fc0C5BpbJu144"
                    target="_blank"
                    className="no-underline text-foreground"
                    rel="noreferrer"
                  >
                    Manage Billing <ArrowUpRight className="w-3 h-3 inline ml-1" />
                  </Link>
                </Button>
              ) : (
                <RefreshAccountButton className="w-full sm:w-full" />
              )}
            </CardContent>
          </Card>

          <UpgradePlanButton currentPlan={plan} plans={plans} />
        </div>

        <Card className="flex-auto">
          <CardHeader>
            <CardTitle>{currentMonthPretty} Usage</CardTitle>
            <CardDescription>Casts processed by automod.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Casts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMonthUsage.map((usage) => (
                  <TableRow key={usage.channelId}>
                    <TableCell className="font-medium" style={{ fontFamily: "Kode Mono" }}>
                      /{usage.channelId}
                    </TableCell>
                    <TableCell>{usage.castsProcessed.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell>{currentMonthTotal.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function isOnStripe(user: User) {
  return ["zaak", "jtgi"].includes(user.name);
}

function RefreshAccountButton(props: ButtonProps) {
  const fetcher = useFetcher();
  const loading = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <Button
        {...props}
        disabled={loading}
        size="xs"
        variant={"outline"}
        name="intent"
        value="checkAccountStatus"
        className={"w-full"}
      >
        {loading ? (
          <>
            <RefreshCwIcon className="animate-spin w-3 h-3 mr-1" /> Refreshing...
          </>
        ) : (
          <>
            <RefreshCwIcon className="w-3 h-3 mr-1" /> Refresh
          </>
        )}
      </Button>
    </fetcher.Form>
  );
}

function UpgradePlanButton(props: { currentPlan: PlanDef; plans: typeof userPlans }) {
  const { currentPlan, plans } = props;

  function button(plan: PlanType) {
    if (!("link" in plans[plan])) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2 text-xs p-4 rounded-lg border items-center">
        <RocketIcon className="w-6 h-6" />
        <p>For more casts and more channels</p>
        <Button asChild size={"xs"} variant={"outline"} className="w-full">
          {/* @ts-ignore */}
          <Link to={plans[plan].link} className="no-underline text-inherit" target="_blank" rel="noreferrer">
            Upgrade to {plans[plan].displayName} <ArrowUpRight className="ml-1 w-3 h-3" />
          </Link>
        </Button>
      </div>
    );
  }

  if (currentPlan.id === "prime") {
    return button("ultra");
  } else if (currentPlan.id === "basic") {
    return button("prime");
  } else {
    return null;
  }
}
