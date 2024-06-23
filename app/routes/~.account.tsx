/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs, defer, json } from "@remix-run/node";
import { Await, Form, useLoaderData } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { PlanType, commitSession, getSession, refreshAccountStatus, userPlans } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, requireUser, successResponse } from "~/lib/utils.server";
import { isRecoverActive, recover } from "./~.channels.$id.tools";
import { recoverQueue } from "~/lib/bullish.server";
import { FormEvent, Suspense } from "react";
import axios from "axios";
import { automodFid } from "./~.channels.$id";
import { FullModeratedChannel } from "./api.webhooks.neynar";
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
        <Card>
          <CardHeader>
            <CardTitle>{plan.displayName} Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Monthly Casts</TableCell>
                  <TableCell>
                    {currentMonthTotal.toLocaleString()} / {plan.maxCasts.toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Max Channels</TableCell>
                  <TableCell>
                    {channels.length} / {plan.maxChannels.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="flex-auto">
          <CardHeader>
            <CardTitle>{currentMonthPretty} Usage</CardTitle>
            <CardDescription>Casts processed by automod</CardDescription>
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
