import { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Form, useSubmit, Link, useNavigation } from "@remix-run/react";
import { v4 as uuid } from "uuid";
import { db } from "~/lib/db.server";
import { errorResponse, requireUser, successResponse } from "~/lib/utils.server";
import { getWarpcastChannels } from "~/lib/warpcast.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { FieldLabel } from "~/components/ui/fields";
import { getChannelModerationConfig, migrateModerationConfig } from "~/lib/airstack.server";
import { commitSession, getSession } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const [moderatedChannels, allChannels] = await Promise.all([
    db.moderatedChannel.findMany({
      where: {
        userId: user.id,
      },
    }),
    getWarpcastChannels(),
  ]);

  const airstackChannels = allChannels.filter(
    (channel) => channel.moderatorFid === 440220 && channel.leadFid === 234616 //+user.id
  );

  return typedjson({
    airstackChannels,
    moderatedChannels,
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
  const { airstackChannels, moderatedChannels } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (airstackChannels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Airstack Channels Found</CardTitle>
          <CardDescription>There are no Airstack channels available for import.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link to="/~" className="no-underline">
              Back to Dashboard
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
                <FieldLabel
                  key={channel.id}
                  label={`${channel.id} ${isExisting ? "(Overwrite existing Automod settings)" : ""}`}
                  position="right"
                  labelProps={{
                    className: "ml-1 text-sm",
                  }}
                >
                  <Checkbox name="channelIds" value={channel.id} defaultChecked={!isExisting} />
                </FieldLabel>
              );
            })}
          </CardContent>
        </fieldset>
        <CardFooter>
          <Button disabled={navigation.state !== "idle"} type="submit">
            {navigation.state !== "idle" ? "Importing..." : "Import"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
