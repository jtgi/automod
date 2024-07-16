/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { requireUser } from "~/lib/utils.server";
import { Button } from "~/components/ui/button";
import { db } from "~/lib/db.server";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { banAction, cooldown24Action, likeAction, unlikeAction } from "~/lib/cast-actions.server";
import { actionToInstallLink } from "~/lib/utils";
import { ChannelHeader } from "./~.channels.new.3";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId")!;
  const channel = await db.moderatedChannel.findUniqueOrThrow({
    where: {
      id: channelId,
    },
  });

  const castActions = [banAction, likeAction, unlikeAction, cooldown24Action];

  return typedjson({
    user,
    channel,
    castActions,
  });
}

export default function Screen() {
  const { channel, castActions } = useTypedLoaderData<typeof loader>();
  const dst =
    channel.feedType === "custom"
      ? `/~/channels/${channel.id}/edit?onboarding=true`
      : `/~/channels/${channel.id}`;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <ChannelHeader channel={channel} />
          <CardTitle>Install cast actions to moderate your channel</CardTitle>
          <CardDescription>
            {" "}
            Use cast actions to Curate, Hide, or Ban content directly in your Channel Feed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 text-sm">
            {castActions.map((ca) => (
              <div
                key={ca.name}
                className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{ca.name}</p>
                  <p className="text-gray-600">{ca.description}</p>
                </div>
                <Button variant={"outline"} size={"sm"} asChild>
                  <Link
                    to={actionToInstallLink(ca)}
                    className="no-underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Install <ArrowUpRight className="w-3 h-3 inline" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link to={dst} className="no-underline w-full sm:w-[150px]">
              Done
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
