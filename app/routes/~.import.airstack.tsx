/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Form, Link, useNavigation } from "@remix-run/react";
import { v4 as uuid } from "uuid";
import { db } from "~/lib/db.server";
import { errorResponse, requireUser } from "~/lib/utils.server";
import { getWarpcastChannels } from "~/lib/warpcast.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { FieldLabel } from "~/components/ui/fields";
import { getChannelModerationConfig, migrateModerationConfig } from "~/lib/airstack.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { castsByChannelUrl } from "~/lib/castVolumeSnapshot";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { GemIcon, MessageCircleWarningIcon } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const fidOverride = new URL(request.url).searchParams.get("fid");
  const [moderatedChannels, allChannels] = await Promise.all([
    db.moderatedChannel.findMany({
      where: {
        userId: user.id,
      },
    }),
    getWarpcastChannels(),
  ]);

  const airstackChannels = allChannels.filter((channel) => {
    if (fidOverride) {
      return channel.moderatorFid === 440220 && channel.leadFid === +fidOverride;
    } else {
      return channel.moderatorFid === 440220 && channel.leadFid === +user.id;
    }
  });

  async function projectUsage({ channels }: { channels: string[] }) {
    let sum = 0;

    for (const c of channels) {
      const channel = castsByChannelUrl.find((stat: any) => stat.url === c);
      sum += Number(channel?.count || 0);
    }

    return sum;
  }

  const projectedUsage = await projectUsage({
    channels: [...airstackChannels.map((c) => c.url), ...moderatedChannels.map((mc) => mc.url)].filter(
      Boolean
    ) as string[],
  });

  return typedjson({
    airstackChannels,
    moderatedChannels,
    projectedUsage,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const formData = await request.formData();
  const channelIds = formData.getAll("channelIds") as string[];

  const failed = [];
  for (const channelId of channelIds) {
    const config = await getChannelModerationConfig({ channelId });
    if (!config) {
      failed.push(channelId);
      continue;
    }

    await migrateModerationConfig({ config, userId: user.id });
  }

  if (failed.length) {
    return errorResponse({
      request,
      message: `Failed to import ${failed.join(", ")}`,
    });
  } else {
    const session = await getSession(request.headers.get("Cookie"));

    session.flash("message", {
      id: uuid(),
      type: "success",
      message: "All channels imported successfully",
    });

    return redirect("/~", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

export default function ImportAirstack() {
  const { airstackChannels, moderatedChannels, projectedUsage } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();
  const aboveFreeTier = projectedUsage > 3_000 || moderatedChannels.length + airstackChannels.length > 3;

  if (airstackChannels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Airstack Channels Found</CardTitle>
          <CardDescription>There are no Airstack channels available for import.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/~" className="no-underline">
              Okay
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Airstack Channels</CardTitle>
        <CardDescription>Select the channels you want to import from Airstack to Automod</CardDescription>
      </CardHeader>
      <Form method="post">
        <fieldset disabled={navigation.state !== "idle"}>
          <CardContent className="space-y-4">
            {airstackChannels.map((channel) => {
              const isExisting = moderatedChannels.some((mc) => mc.id === channel.id);
              return (
                <div key={channel.id} className="flex gap-2">
                  <Checkbox
                    name="channelIds"
                    id={channel.id}
                    value={channel.id}
                    defaultChecked={!isExisting}
                  />
                  <label htmlFor={channel.id}>
                    <div className="flex gap-2">
                      <img
                        src={channel.imageUrl}
                        className="w-5 h-5 rounded-full shrink-0 outline-white outline-5 shadow-md"
                      />
                      <div>
                        <p className="font-mono" style={{ fontFamily: "Kode Mono" }}>
                          /{channel.id}
                        </p>
                        {isExisting && (
                          <p className="text-muted-foreground text-xs">
                            This channel already has a configuration in Automod, importing it will overwrite
                            existing settings.
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              );
            })}
          </CardContent>
        </fieldset>

        {aboveFreeTier && (
          <Alert className="my-6">
            <AlertTitle>
              <GemIcon className="w-4 h-4 mr-1" /> Your usage is above Automod's free tier
            </AlertTitle>
            <AlertDescription>
              To ease the transition from Airstack, you'll be granted 3 months of{" "}
              <Link to="https://www.hypersub.xyz/s/automod" target="_blank" rel="noreferrer">
                Automod Prime
              </Link>{" "}
              for free. For more about usage and thresholds, visit{" "}
              <Link to="/~/account">your account page</Link>
            </AlertDescription>
          </Alert>
        )}

        <CardFooter>
          <Button disabled={navigation.state !== "idle"} type="submit" className="w-full sm:w-auto">
            {navigation.state !== "idle" ? "Importing..." : "Import"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
